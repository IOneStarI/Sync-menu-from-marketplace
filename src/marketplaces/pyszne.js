import { AppError } from '../errors.js';
import { localized, numberValue, parseDisplayPrice, parseJson, summarizeFailures } from '../utils/parser.js';
import {
  PYSZNE_DEFAULT_API_BASE_URL,
  PYSZNE_DEFAULT_API_VERSION,
  PYSZNE_DEFAULT_API_VERSIONS,
  USER_AGENT,
} from '../constants.js';

export async function parsePyszneMenu(marketplaceUrl, { logger } = {}) {
  const url = new URL(marketplaceUrl);
  const context = parsePyszneUrl(url);
  const failures = [];

  try {
    const data = await fetchPyszneRestaurant(context);
    const menu = normalizePyszneData(data, context);
    if (menu.categories.length > 0 && menu.items.length > 0) return menu;
  } catch (error) {
    failures.push(error.message);
  }

  logger?.warn?.('Pyszne/Just Eat parser could not extract menu data from public API.');
  throw new AppError(
    `Could not extract Pyszne/Just Eat menu data. Tried ${failures.length || 1} source.${summarizeFailures(failures) ? ` First failures: ${summarizeFailures(failures)}` : ''}`,
    'PYSZNE_PARSE_ERROR',
    failures,
  );
}

function parsePyszneUrl(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const menuIndex = parts.indexOf('menu');
  const slug = menuIndex >= 0 ? parts[menuIndex + 1] : parts.at(-1);
  if (!slug) throw new AppError(`Pyszne/Just Eat URL does not contain a restaurant slug: ${url}`, 'PYSZNE_INVALID_URL');

  return {
    slug,
    language: parts[0] && parts[0].length <= 5 ? parts[0] : process.env.PYSZNE_LANGUAGE || 'en',
    countryCode: countryCodeFromHost(url.hostname),
    referer: url.toString(),
  };
}

function countryCodeFromHost(hostname) {
  const host = hostname.toLowerCase();
  if (host.endsWith('.pl')) return 'pl';
  if (host.endsWith('.fr')) return 'fr';
  if (host.endsWith('.de')) return 'de';
  if (host.endsWith('.nl')) return 'nl';
  if (host.endsWith('.be')) return 'be';
  return process.env.PYSZNE_COUNTRY_CODE || 'pl';
}

async function fetchPyszneRestaurant(context) {
  const failures = [];
  for (const url of pyszneApiCandidates(context)) {
    const response = await fetch(url, { headers: pyszneHeaders(context) });
    const text = await response.text();
    const parsed = parseJson(text);
    if (response.ok && parsed) return parsed;

    failures.push(`${url} -> HTTP ${response.status}: ${formatPyszneError(parsed, text)}`);
    if (isBlockedResponse(response, text)) {
      continue;
    }
  }

  throw new Error(`Pyszne/Just Eat API did not return usable menu JSON. ${failures.join(' | ')}`);
}

function pyszneApiCandidates(context) {
  const versions = process.env.PYSZNE_API_VERSION
    ? [process.env.PYSZNE_API_VERSION]
    : PYSZNE_DEFAULT_API_VERSIONS;
  const bases = [process.env.PYSZNE_API_BASE_URL || PYSZNE_DEFAULT_API_BASE_URL];
  if (process.env.PYSZNE_TRY_SITE_API === 'true') bases.push(originFromReferer(context.referer));

  const paths = [];
  for (const version of versions) {
    const cleanVersion = version || PYSZNE_DEFAULT_API_VERSION;
    paths.push(`/api/${cleanVersion}/restaurant?slug=${encodeURIComponent(context.slug)}`);
    paths.push(`/api/${cleanVersion}/restaurants/${encodeURIComponent(context.slug)}`);
    paths.push(`/api/${cleanVersion}/restaurant/${encodeURIComponent(context.slug)}`);
    paths.push(`/api/${cleanVersion}/restaurants?slug=${encodeURIComponent(context.slug)}`);
  }

  return bases.flatMap((base) => paths.map((path) => new URL(path, `${base.replace(/\/$/, '')}/`).toString()));
}

function pyszneHeaders(context) {
  return {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': USER_AGENT,
    'x-requested-with': 'XMLHttpRequest',
    'x-country-code': process.env.PYSZNE_COUNTRY_CODE || context.countryCode,
    'x-language-code': process.env.PYSZNE_LANGUAGE || context.language,
    Origin: originFromReferer(context.referer),
    Referer: context.referer,
    ...(process.env.PYSZNE_COOKIE ? { Cookie: process.env.PYSZNE_COOKIE } : {}),
  };
}

function originFromReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return 'https://www.pyszne.pl';
  }
}

function normalizePyszneData(data, context = {}) {
  const restaurant = data.restaurant || data;
  const menu = restaurant.menu || data.menu || {};
  const productsById = toObjectMap(menu.products || menu.items || restaurant.products || {});
  const optionGroupsById = toObjectMap(menu.optionGroups || menu.modifierGroups || menu.toppingGroups || {});
  const categories = normalizeCategories(menu, productsById);
  const items = normalizeItems(categories, productsById, optionGroupsById);
  const optionGroups = normalizeOptionGroups(items, optionGroupsById);

  return {
    marketplace: 'pyszne',
    sourceId: String(restaurant.id || restaurant.restaurantId || context.slug || 'pyszne'),
    currency: restaurant.currency || menu.currency || findCurrency(items),
    sections: [
      {
        id: String(restaurant.id || restaurant.restaurantId || context.slug || 'pyszne'),
        name: restaurant.name || restaurant.brandName || context.slug || 'Main menu',
        description: restaurant.description,
        showOutsideSchedule: false,
      },
    ],
    categories,
    items,
    optionGroups,
  };
}

function normalizeCategories(menu, productsById) {
  const rawCategories = toArray(menu.categories || menu.productCategories || menu.itemsGroups);
  if (rawCategories.length > 0) {
    return rawCategories.map((category, index) => ({
      id: String(category.id || category.categoryId || category.name || `category-${index + 1}`),
      sectionId: 'main',
      name: localized(category.name) || `Category ${index + 1}`,
      active: isActive(category),
      raw: category,
    }));
  }

  return [
    {
      id: 'main',
      sectionId: 'main',
      name: 'Main menu',
      active: true,
      raw: { productIds: Object.keys(productsById) },
    },
  ];
}

function normalizeItems(categories, productsById, optionGroupsById) {
  const items = [];
  const used = new Set();

  for (const [categoryIndex, category] of categories.entries()) {
    const products = productsForCategory(category.raw, productsById);
    for (const [itemIndex, product] of products.entries()) {
      const id = productId(product, categoryIndex, itemIndex);
      used.add(id);
      items.push(normalizeItem(product, category.id, id, itemIndex, optionGroupsById));
    }
  }

  for (const [itemIndex, product] of Object.values(productsById).filter((product) => !used.has(productId(product))).entries()) {
    items.push(normalizeItem(product, categories[0]?.id || 'main', productId(product, 0, itemIndex), itemIndex, optionGroupsById));
  }

  return items;
}

function productsForCategory(category, productsById) {
  const ids = [
    ...toArray(category.productIds),
    ...toArray(category.products).map((product) => (typeof product === 'object' ? product.id || product.productId : product)),
  ]
    .map((id) => String(id))
    .filter(Boolean);
  if (ids.length > 0) return ids.map((id) => productsById[id]).filter(Boolean);

  const categoryId = String(category.id || category.categoryId || '');
  return Object.values(productsById).filter((product) => {
    const productCategoryIds = toArray(product.categoryIds || product.categories).map(String);
    return String(product.categoryId || product.category || '') === categoryId || productCategoryIds.includes(categoryId);
  });
}

function normalizeItem(product, categoryId, id, index, optionGroupsById) {
  const active = isActive(product);
  const variantGroups = normalizeVariantGroup(product, id);
  const rawGroupIds = extractRawOptionGroups(product, optionGroupsById).map((group, groupIndex) => optionGroupId(group, id, groupIndex));
  return {
    id,
    categoryId,
    name: localized(product.name) || `Item ${index + 1}`,
    description: localized(product.description),
    price: extractPrice(product),
    imageUrl: imageUrl(product),
    active,
    soldOut: !active,
    optionGroupIds: [...variantGroups.map((group) => group.id), ...rawGroupIds],
    raw: {
      ...product,
      __variantOptionGroups: variantGroups,
    },
  };
}

function normalizeOptionGroups(items, optionGroupsById) {
  const groups = [];
  const seen = new Set();
  for (const item of items) {
    for (const group of item.raw.__variantOptionGroups || []) {
      if (seen.has(group.id)) continue;
      seen.add(group.id);
      groups.push(group);
    }
    for (const [groupIndex, group] of extractRawOptionGroups(item.raw, optionGroupsById).entries()) {
      const normalized = normalizeOptionGroup(group, item.id, groupIndex);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      groups.push(normalized);
    }
  }
  return groups;
}

function normalizeVariantGroup(product, itemId) {
  const variants = toArray(product.variants || product.variations || product.sizes);
  if (variants.length <= 1) return [];
  const basePrice = extractPrice(product) ?? Math.min(...variants.map((variant) => extractPrice(variant)).filter(Number.isFinite));
  const options = variants.map((variant, index) => {
    const price = extractPrice(variant) ?? basePrice;
    return {
      id: String(variant.id || variant.productId || variant.name || `${itemId}-variant-${index + 1}`),
      name: localized(variant.name) || localized(variant.size) || `Variant ${index + 1}`,
      price: Number.isFinite(price) && Number.isFinite(basePrice) ? price - basePrice : 0,
      active: isActive(variant),
      default: index === 0,
      raw: variant,
    };
  });

  return [
    {
      id: `${itemId}-variants`,
      sectionId: 'main',
      name: 'Choose variant',
      type: 'single',
      required: true,
      min: 1,
      max: 1,
      active: true,
      options,
      raw: variants,
    },
  ];
}

function normalizeOptionGroup(group, itemId, groupIndex) {
  const options = toArray(group.options || group.items || group.products || group.choices || group.toppings).map((option, optionIndex) => ({
    id: String(option.id || option.productId || option.optionId || option.name || `${optionGroupId(group, itemId, groupIndex)}-${optionIndex + 1}`),
    name: localized(option.name) || `Option ${optionIndex + 1}`,
    price: extractPrice(option) ?? extractPriceImpact(option) ?? 0,
    active: isActive(option),
    default: option.selected === true || option.default === true,
    raw: option,
  }));

  if (options.length === 0) return null;
  const min = numberValue(group.min ?? group.minimum ?? group.minAmount);
  const max = numberValue(group.max ?? group.maximum ?? group.maxAmount);
  return {
    id: optionGroupId(group, itemId, groupIndex),
    sectionId: 'main',
    name: localized(group.name) || localized(group.title) || `Options ${groupIndex + 1}`,
    type: max === 1 ? 'single' : 'multiple',
    required: Boolean(group.required || (min ?? 0) > 0),
    min,
    max,
    active: isActive(group),
    options,
    raw: group,
  };
}

function extractRawOptionGroups(product, optionGroupsById) {
  const direct = [
    ...toArray(product.optionGroups),
    ...toArray(product.modifierGroups),
    ...toArray(product.toppingGroups),
    ...toArray(product.addonGroups),
  ].filter((group) => typeof group === 'object');
  const ids = [
    ...toArray(product.optionGroupIds),
    ...toArray(product.modifierGroupIds),
    ...toArray(product.toppingGroupIds),
  ].map(String);
  return [...direct, ...ids.map((id) => optionGroupsById[id]).filter(Boolean)];
}

function optionGroupId(group, itemId, groupIndex) {
  return String(group.id || group.groupId || group.optionGroupId || group.name || `${itemId}-group-${groupIndex + 1}`);
}

function productId(product, categoryIndex = 0, itemIndex = 0) {
  return String(product.id || product.productId || product.externalId || `item-${categoryIndex + 1}-${itemIndex + 1}`);
}

function extractPrice(value) {
  const display = parseDisplayPrice(
    value?.priceInfo?.displayText ??
      value?.displayPrice ??
      value?.display_price ??
      value?.price?.displayText ??
      value?.price?.formatted,
  );
  if (display !== undefined) return display;
  const candidates = [
    value?.price,
    value?.priceInfo?.amount,
    value?.prices?.delivery,
    value?.prices?.pickup,
    value?.prices?.default,
    value?.variants?.[0]?.price,
    value?.variations?.[0]?.price,
  ];
  for (const candidate of candidates) {
    const number = numberValue(candidate);
    if (number !== undefined) return fromMinorIfNeeded(number);
  }
  return undefined;
}

function extractPriceImpact(value) {
  const display = parseDisplayPrice(value?.priceInfo?.displayText ?? value?.displayPrice ?? value?.display_price);
  if (display !== undefined) return display;
  const number = numberValue(value?.priceImpact ?? value?.extraPrice ?? value?.additionalPrice);
  return number === undefined ? undefined : fromMinorIfNeeded(number);
}

function fromMinorIfNeeded(value) {
  return Number.isInteger(value) ? value / 100 : value;
}

function imageUrl(product) {
  return product.imageUrl || product.image || product.images?.[0]?.url || product.images?.[0];
}

function isActive(value) {
  const status = String(value?.availability || value?.status || value?.state || '').toLowerCase();
  return !(
    value?.available === false ||
    value?.enabled === false ||
    value?.soldOut === true ||
    status.includes('sold') ||
    status.includes('unavailable') ||
    status.includes('closed') ||
    status.includes('disabled')
  );
}

function findCurrency(items) {
  for (const item of items) {
    const currency = item.raw?.currency || item.raw?.priceInfo?.currencyCode;
    if (currency) return currency;
  }
  return undefined;
}

function toObjectMap(value) {
  if (!value) return {};
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((entry, index) => [String(entry.id || entry.productId || index), entry]));
  }
  if (typeof value === 'object') return value;
  return {};
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.values(value);
  return [value];
}

function formatPyszneError(parsed, text) {
  if (parsed) return parsed.message || parsed.error || JSON.stringify(parsed).slice(0, 500);
  if (/cloudflare|challenge|rate limited|enable javascript/i.test(text)) {
    return 'blocked by Cloudflare/rate limiting';
  }
  return text.slice(0, 500);
}

function isBlockedResponse(response, text) {
  return response.status === 403 || response.status === 429 || /cloudflare|challenge|rate limited|enable javascript/i.test(text);
}

export const __test__ = {
  normalizePyszneData,
  parsePyszneUrl,
  pyszneApiCandidates,
};
