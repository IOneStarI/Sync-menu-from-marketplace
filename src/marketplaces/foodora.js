import { AppError } from '../errors.js';
import { arrayProp, getString, localized, numberValue, parseDisplayPrice, parseJson, fromMinorUnits, summarizeFailures, walk } from '../utils/parser.js';
import { extractWindowAssignments } from '../utils/html-scraper.js';
import { USER_AGENT, FOODORA_DEFAULT_API_BASE_URL } from '../constants.js';

export async function parseFoodoraMenu(marketplaceUrl, { logger } = {}) {
  const url = new URL(marketplaceUrl);
  const vendorCode = extractVendorCode(url);
  const partnerConfig = loadPartnerConfig();

  if (partnerConfig) {
    const menu = await parseFoodoraPartnerCatalog(partnerConfig, vendorCode);
    if (menu.categories.length > 0 && menu.items.length > 0) return menu;
  }

  const candidates = buildCandidateUrls(url, vendorCode);
  const failures = [];

  for (const candidate of candidates) {
    try {
      const data = await fetchFoodoraJson(candidate);
      const menu = normalizeFoodoraData(data, vendorCode);
      if (menu.categories.length > 0 && menu.items.length > 0) return menu;
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
      if (error.code === 'FOODORA_BLOCKED') break;
    }
  }

  try {
    const html = await fetchFoodoraText(url.toString());
    const data = extractFoodoraState(html);
    const menu = normalizeFoodoraData(data, vendorCode);
    if (menu.categories.length > 0 && menu.items.length > 0) return menu;
  } catch (error) {
    failures.push(`${url}: ${error.message}`);
  }

  logger?.warn?.('Foodora parser could not extract menu data from public sources.');
  throw new AppError(
    `Could not extract Foodora menu data. Tried ${failures.length} sources.${summarizeFailures(failures) ? ` First failures: ${summarizeFailures(failures)}` : ''}`,
    'FOODORA_PARSE_ERROR',
    failures,
  );
}

function extractVendorCode(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const restaurantIndex = parts.indexOf('restaurant');
  if (restaurantIndex >= 0 && parts[restaurantIndex + 1]) return parts[restaurantIndex + 1];
  throw new AppError(`Foodora URL does not contain a vendor code: ${url}`, 'FOODORA_INVALID_URL');
}

function buildCandidateUrls(originalUrl, vendorCode) {
  const origin = originalUrl.origin;
  const encoded = encodeURIComponent(vendorCode);
  return [
    `${origin}/api/v5/vendors/${encoded}/menu`,
    `${origin}/api/v5/vendors/${encoded}/menu?language=${encodeURIComponent(languageFromUrl(originalUrl))}`,
    `${origin}/api/v5/vendors/${encoded}`,
  ];
}

function languageFromUrl(url) {
  const first = url.pathname.split('/').filter(Boolean)[0];
  return first && first.length <= 5 ? first : 'en';
}

async function fetchFoodoraJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });
  const text = await response.text();
  if (isFoodoraCaptcha(text)) {
    throw new AppError(
      'Foodora blocked the request with a PerimeterX captcha challenge.',
      'FOODORA_BLOCKED',
    );
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return JSON.parse(text);
}

async function fetchFoodoraText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': USER_AGENT,
    },
  });
  const text = await response.text();
  if (isFoodoraCaptcha(text)) {
    throw new AppError(
      'Foodora blocked the page request with a PerimeterX captcha challenge.',
      'FOODORA_BLOCKED',
    );
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return text;
}

function isFoodoraCaptcha(text) {
  return text.includes('PXlJuB4eTB') || text.includes('px-captcha') || text.includes('Access to this page has been denied');
}

function loadPartnerConfig() {
  const chainId = process.env.FOODORA_CHAIN_ID;
  const vendorId = process.env.FOODORA_VENDOR_ID;
  const bearerToken = process.env.FOODORA_BEARER_TOKEN;
  if (!chainId && !vendorId && !bearerToken) return null;
  if (!chainId || !vendorId || !bearerToken) {
    throw new AppError(
      'FOODORA_CHAIN_ID, FOODORA_VENDOR_ID, and FOODORA_BEARER_TOKEN are all required for Foodora Partner API imports.',
      'FOODORA_CONFIG_ERROR',
    );
  }

  return {
    baseUrl: (process.env.FOODORA_API_BASE_URL || FOODORA_DEFAULT_API_BASE_URL).replace(/\/$/, ''),
    chainId,
    vendorId,
    bearerToken,
    locale: process.env.FOODORA_LOCALE || 'en_CZ',
    pageSize: Number(process.env.FOODORA_PAGE_SIZE || 500),
  };
}

async function parseFoodoraPartnerCatalog(config, vendorCode) {
  const [categoriesResponse, products] = await Promise.all([
    fetchPartnerJson(
      config,
      `/v2/chains/${encodeURIComponent(config.chainId)}/vendors/${encodeURIComponent(config.vendorId)}/categories`,
    ),
    fetchAllPartnerProducts(config),
  ]);

  return normalizeFoodoraData({
    code: vendorCode,
    categories: unwrapArray(categoriesResponse),
    products,
  }, vendorCode);
}

async function fetchAllPartnerProducts(config) {
  const products = [];
  for (let page = 1; ; page += 1) {
    const path = `/v2/chains/${encodeURIComponent(config.chainId)}/vendors/${encodeURIComponent(config.vendorId)}/catalog`;
    const url = new URL(path, `${config.baseUrl}/`);
    url.searchParams.set('locale', config.locale);
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', String(config.pageSize));
    const response = await fetchPartnerJson(config, `${url.pathname}${url.search}`);
    const batch = unwrapArray(response);
    products.push(...batch);
    if (batch.length < config.pageSize) break;
  }
  return products;
}

async function fetchPartnerJson(config, path) {
  const response = await fetch(new URL(path, `${config.baseUrl}/`), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.bearerToken}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new AppError(
      `Foodora Partner API ${path} failed with HTTP ${response.status}: ${text.slice(0, 500)}`,
      'FOODORA_PARTNER_API_ERROR',
      { status: response.status, response: parseJson(text) ?? text },
    );
  }
  return parseJson(text);
}

function unwrapArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.products)) return value.products;
  if (Array.isArray(value?.categories)) return value.categories;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

function extractFoodoraState(html) {
  const states = extractWindowAssignments(html, ['__PRELOADED_STATE__', '__PROVIDER_PROPS__']);

  if (states.length === 0) throw new Error('No Foodora embedded state object found');
  return states.length === 1 ? states[0] : states;
}

function normalizeFoodoraData(data, vendorCode) {
  const root = findFoodoraMenuRoot(data);
  const sectionName = localized(root.name) || localized(root.title) || 'Main menu';
  const categories = normalizeCategories(root);
  const items = normalizeItems(root, categories);
  const optionGroups = normalizeOptionGroups(root, items);

  return {
    marketplace: 'foodora',
    sourceId: getString(root, ['id', 'code', 'vendor_code', 'vendorCode']) || vendorCode,
    currency: getString(root, ['currency', 'currency_code', 'currencyCode']) || undefined,
    sections: [
      {
        id: getString(root, ['id', 'code', 'vendor_code', 'vendorCode']) || vendorCode,
        name: sectionName,
        description: localized(root.description),
      },
    ],
    categories,
    items,
    optionGroups,
  };
}

function findFoodoraMenuRoot(data) {
  const candidates = [];
  walk(data, (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const categories = arrayProp(value, ['categories', 'menu_categories', 'product_categories']);
    const products = arrayProp(value, ['products', 'items', 'menu_items']);
    const embeddedProducts = categories.reduce((sum, category) => {
      return sum + arrayProp(category, ['products', 'items', 'menu_items']).length;
    }, 0);
    if (categories.length > 0 || products.length > 0) {
      candidates.push({
        value,
        score: categories.length * 3 + products.length + embeddedProducts * 2,
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0]) return candidates[0].value;
  throw new Error('No Foodora menu-like object found');
}

function normalizeCategories(root) {
  const rawCategories = arrayProp(root, ['categories', 'menu_categories', 'product_categories']);
  return rawCategories.map((category, index) => ({
    id: getString(category, ['id', 'code', 'uuid', 'global_id', 'globalId', 'globalID', 'slug']) || `category-${index + 1}`,
    sectionId: 'main',
    name: localized(category.name) || localized(category.title) || `Category ${index + 1}`,
    description: localized(category.description),
    active: !isUnavailable(category),
    raw: category,
  }));
}

function normalizeItems(root, categories) {
  const rawProducts = arrayProp(root, ['products', 'items', 'menu_items']);
  const productsById = new Map(
    rawProducts
      .map((product) => [getProductId(product), product])
      .filter(([id]) => id),
  );
  const productsByCategory = new Map();

  for (const product of rawProducts) {
    const categoryId = getProductCategoryId(product);
    if (!categoryId) continue;
    if (!productsByCategory.has(categoryId)) productsByCategory.set(categoryId, []);
    productsByCategory.get(categoryId).push(product);
  }

  const items = [];
  for (const [categoryIndex, category] of categories.entries()) {
    const embeddedProducts = arrayProp(category.raw, ['products', 'items', 'menu_items']);
    const linkedIds = arrayProp(category.raw, ['product_ids', 'productIds', 'item_ids', 'itemIds']);
    const linkedProducts = linkedIds.map((id) => productsById.get(String(id))).filter(Boolean);
    const categoryProducts = embeddedProducts.length > 0
      ? embeddedProducts
      : linkedProducts.length > 0
        ? linkedProducts
        : productsByCategory.get(category.id) || [];

    for (const [productIndex, product] of categoryProducts.entries()) {
      items.push(normalizeProduct(product, category.id, `${categoryIndex + 1}-${productIndex + 1}`));
    }
  }

  if (items.length === 0 && rawProducts.length > 0) {
    const fallbackCategory = categories[0]?.id || 'category-1';
    rawProducts.forEach((product, index) => {
      items.push(normalizeProduct(product, fallbackCategory, `1-${index + 1}`));
    });
  }

  return items;
}

function normalizeProduct(product, categoryId, fallbackId) {
  const variation = firstVariation(product);
  const price = extractRegularPrice(variation) ?? extractRegularPrice(product);
  return {
    id: getProductId(product) || `item-${fallbackId}`,
    categoryId,
    name: localized(product.name) || localized(product.title) || localized(product.defaultTitle) || `Item ${fallbackId}`,
    description: localized(product.description),
    price,
    imageUrl: getImageUrl(product),
    active: !isUnavailable(product),
    soldOut: isUnavailable(product),
    optionGroupIds: extractOptionGroupIds(product),
    raw: product,
  };
}

function normalizeOptionGroups(root, items) {
  const groups = [];
  const byId = new Map();
  for (const raw of arrayProp(root, ['toppings', 'modifiers', 'options', 'option_groups', 'product_options'])) {
    const group = normalizeOptionGroup(raw, groups.length);
    if (group && !byId.has(group.id)) {
      byId.set(group.id, group);
      groups.push(group);
    }
  }

  for (const item of items) {
    for (const raw of arrayProp(item.raw, ['toppings', 'modifiers', 'options', 'option_groups', 'product_options'])) {
      const group = normalizeOptionGroup(raw, groups.length);
      if (group && !byId.has(group.id)) {
        byId.set(group.id, group);
        groups.push(group);
      }
    }
  }

  return groups;
}

function normalizeOptionGroup(group, index) {
  const options = arrayProp(group, ['options', 'items', 'products', 'toppings', 'values', 'choices']).map((option, optionIndex) => ({
    id: getString(option, ['id', 'code', 'uuid', 'sku']) || `option-${index + 1}-${optionIndex + 1}`,
    name: localized(option.name) || localized(option.title) || `Option ${optionIndex + 1}`,
    price: extractRegularPrice(option) ?? 0,
    active: !isUnavailable(option),
    default: Boolean(option.default || option.is_default || option.selected_by_default),
    raw: option,
  }));

  if (options.length === 0) return null;
  const min = numberValue(group.minimum || group.min || group.min_selection || group.minSelection);
  const max = numberValue(group.maximum || group.max || group.max_selection || group.maxSelection);
  return {
    id: getString(group, ['id', 'code', 'uuid']) || `group-${index + 1}`,
    sectionId: 'main',
    name: localized(group.name) || localized(group.title) || `Options ${index + 1}`,
    type: max === 1 ? 'single' : 'multiple',
    required: Boolean(group.required || min > 0),
    min,
    max,
    active: !isUnavailable(group),
    options,
    raw: group,
  };
}

function getProductId(product) {
  return getString(product, ['id', 'code', 'uuid', 'sku', 'product_code', 'productCode']);
}

function getProductCategoryId(product) {
  const direct = getString(product, ['category_id', 'categoryId', 'category_global_id', 'categoryGlobalId', 'category_global_ids', 'categoryGlobalIds']);
  if (direct) return direct;
  if (product.category && typeof product.category === 'object') {
    return getString(product.category, ['id', 'code', 'uuid', 'global_id', 'globalId']);
  }
  if (Array.isArray(product.categories) && product.categories[0]) {
    return getString(product.categories[0], ['id', 'code', 'uuid', 'global_id', 'globalId']);
  }
  if (Array.isArray(product.category_global_ids) && product.category_global_ids[0]) {
    return String(product.category_global_ids[0]);
  }
  if (Array.isArray(product.categoryGlobalIds) && product.categoryGlobalIds[0]) {
    return String(product.categoryGlobalIds[0]);
  }
  return undefined;
}

function extractRegularPrice(value) {
  if (!value || typeof value !== 'object') return undefined;
  const display = parseDisplayPrice(
    value.price?.displayText ??
      value.price?.formatted ??
      value.price?.price_str ??
      value.display_price ??
      value.displayPrice,
  );
  if (display !== undefined) return display;
  const direct = numberValue(value.price ?? value.unit_price ?? value.unitPrice ?? value.price_cents);
  if (direct !== undefined) return fromMinorUnits(direct);
  if (value.price && typeof value.price === 'object') {
    return fromMinorUnits(value.price.amount ?? value.price.value ?? value.price.centAmount);
  }
  return undefined;
}

function firstVariation(product) {
  return arrayProp(product, ['product_variations', 'productVariations', 'variations', 'variants'])[0];
}

function extractOptionGroupIds(product) {
  return arrayProp(product, ['toppings', 'modifiers', 'options', 'option_groups', 'product_options'])
    .map((option) => getString(option, ['id', 'code', 'uuid', 'option_id', 'optionId']))
    .filter(Boolean);
}

function getImageUrl(product) {
  const direct = getString(product, ['image_url', 'imageUrl', 'image', 'photo_url', 'photoUrl']);
  if (direct) return direct;
  if (Array.isArray(product.imageUrls) && product.imageUrls[0]) return String(product.imageUrls[0]);
  if (Array.isArray(product.images)) {
    const image = product.images.find((entry) => typeof entry === 'string' || getString(entry, ['url', 'src']));
    if (typeof image === 'string') return image;
    if (image) return getString(image, ['url', 'src']);
  }
  return undefined;
}

function isUnavailable(value) {
  const status = String(value.status || value.availability || '').toLowerCase();
  return Boolean(
    value.active === false ||
      value.is_active === false ||
      value.isActive === false ||
      value.available === false ||
      value.is_available === false ||
      value.sold_out ||
      value.soldOut ||
      status.includes('sold') ||
      status.includes('unavailable') ||
      status.includes('inactive'),
  );
}

export const __test__ = {
  normalizeFoodoraData,
};
