import crypto from 'node:crypto';
import { AppError } from '../errors.js';
import { numberValue, parseDisplayPrice, parseJson, summarizeFailures } from '../utils/parser.js';
import { GLOVO_DEFAULT_API_BASE_URL, GLOVO_DEFAULT_APP_VERSION, USER_AGENT } from '../constants.js';

export async function parseGlovoMenu(marketplaceUrl, { logger } = {}) {
  const url = new URL(marketplaceUrl);
  const context = parseGlovoUrl(url);
  const sessionId = crypto.randomUUID();
  const failures = [];

  try {
    const html = await fetchGlovoHtml(url.toString());
    const ids = extractStoreIds(html, url);
    const city = await resolveCity(context, sessionId);
    const coordinates = resolveCoordinates(city);
    const [store, content] = await Promise.all([
      fetchGlovoJson(`/v3/stores/${ids.storeId}?includeClosed=true&includeDisabled=false`, {
        context,
        sessionId,
        coordinates,
      }),
      fetchGlovoJson(`/v3/stores/${ids.storeId}/addresses/${ids.storeAddressId}/content`, {
        context,
        sessionId,
        coordinates,
      }),
    ]);

    const menu = normalizeGlovoData({ store, content, ids });
    if (menu.categories.length > 0 && menu.items.length > 0) return menu;
  } catch (error) {
    failures.push(error.message);
  }

  logger?.warn?.('Glovo parser could not extract menu data from public API.');
  throw new AppError(
    `Could not extract Glovo menu data. Tried ${failures.length || 1} source.${summarizeFailures(failures) ? ` First failures: ${summarizeFailures(failures)}` : ''}`,
    'GLOVO_PARSE_ERROR',
    failures,
  );
}

function parseGlovoUrl(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const storeIndex = parts.indexOf('stores');
  if (storeIndex === -1 || !parts[storeIndex + 1]) {
    throw new AppError(`Glovo URL does not contain a store slug: ${url}`, 'GLOVO_INVALID_URL');
  }

  return {
    language: parts[0] || 'en',
    countryCode: (parts[1] || '').toUpperCase(),
    citySlug: parts[2] || '',
    storeSlug: parts[storeIndex + 1],
    referer: url.toString(),
  };
}

async function fetchGlovoHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': USER_AGENT,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Glovo page failed with HTTP ${response.status}`);
  return text;
}

function extractStoreIds(html, url) {
  const storeId = firstNumber([
    url.searchParams.get('store_id'),
    matchValue(html, /store_id=(\d+)/),
    matchValue(html, /"storeId"\s*:\s*(\d+)/),
    matchValue(html, /storeId\\?":\\?(\d+)/),
  ]);
  const storeAddressId = firstNumber([
    matchValue(html, /"storeAddressId"\s*:\s*(\d+)/),
    matchValue(html, /storeAddressId\\?":\\?"?(\d+)/),
    matchValue(html, /"addressId"\s*:\s*(\d+)/),
    matchValue(html, /addressId\\?":\\?"?(\d+)/),
  ]);

  if (!storeId || !storeAddressId) {
    throw new Error('No Glovo storeId/storeAddressId found in page state');
  }
  return { storeId, storeAddressId };
}

async function resolveCity(context, sessionId) {
  const settings = await fetchGlovoJson(`/v3/cities/summarized_settings?language=${encodeURIComponent(context.language)}`, {
    context,
    sessionId,
  });
  const cityCode = findCityCode(settings?.cities, context);
  if (!cityCode) return null;
  return fetchGlovoJson(`/v3/customers/cities?city_code=${encodeURIComponent(cityCode)}`, {
    context,
    sessionId,
  });
}

function findCityCode(cities, context) {
  if (!cities || typeof cities !== 'object') return undefined;
  const wantedSlug = slugify(context.citySlug);
  const wantedCountry = context.countryCode;
  for (const [code, city] of Object.entries(cities)) {
    if (wantedCountry && city.countryCode !== wantedCountry) continue;
    const names = [city.name, city.displayName, ...Object.values(city.translations || {})];
    if (names.some((name) => slugify(name) === wantedSlug)) return code;
  }
  return undefined;
}

function resolveCoordinates(cityResponse) {
  const latitude = numberValue(process.env.GLOVO_DELIVERY_LATITUDE);
  const longitude = numberValue(process.env.GLOVO_DELIVERY_LONGITUDE);
  if (latitude !== undefined && longitude !== undefined) return { latitude, longitude };

  const center = cityResponse?.city?.geolocation?.searchZone?.center;
  if (numberValue(center?.lat) !== undefined && numberValue(center?.lng) !== undefined) {
    return { latitude: Number(center.lat), longitude: Number(center.lng) };
  }
  throw new Error('Glovo delivery coordinates unavailable. Set GLOVO_DELIVERY_LATITUDE and GLOVO_DELIVERY_LONGITUDE.');
}

async function fetchGlovoJson(path, { context, sessionId, coordinates } = {}) {
  const baseUrl = (process.env.GLOVO_API_BASE_URL || GLOVO_DEFAULT_API_BASE_URL).replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: glovoHeaders({ context, sessionId, coordinates }),
  });
  const text = await response.text();
  const parsed = parseJson(text);
  if (!response.ok) {
    throw new Error(`Glovo API ${path} failed with HTTP ${response.status}: ${formatGlovoError(parsed) || text.slice(0, 500)}`);
  }
  return parsed;
}

function glovoHeaders({ context, sessionId, coordinates } = {}) {
  return {
    Accept: 'application/json',
    'Accept-Language': context?.language || 'en',
    'User-Agent': USER_AGENT,
    Origin: 'https://glovoapp.com',
    Referer: context?.referer || 'https://glovoapp.com/',
    'Glovo-App-Platform': 'web',
    'Glovo-App-Type': 'customer',
    'Glovo-App-Version': process.env.GLOVO_APP_VERSION || GLOVO_DEFAULT_APP_VERSION,
    'Glovo-Language-Code': context?.language || 'en',
    'Glovo-Perseus-Session-Id': sessionId,
    'Glovo-Perseus-Client-Id': sessionId,
    ...(coordinates
      ? {
          'Glovo-Delivery-Location-Latitude': String(coordinates.latitude),
          'Glovo-Delivery-Location-Longitude': String(coordinates.longitude),
          'Glovo-Delivery-Location-Accuracy': '0',
          'Glovo-Delivery-Location-Timestamp': String(Date.now()),
        }
      : {}),
  };
}

function normalizeGlovoData({ store, content, ids }) {
  const body = Array.isArray(content?.data?.body) ? content.data.body : [];
  const categories = normalizeCategories(body);
  const items = normalizeItems(categories);
  const optionGroups = normalizeOptionGroups(items);

  return {
    marketplace: 'glovo',
    sourceId: String(store?.id || ids.storeId),
    currency: store?.currency || findCurrency(items),
    sections: [
      {
        id: String(store?.id || ids.storeId),
        name: store?.name || 'Main menu',
        description: store?.note || store?.description,
        showOutsideSchedule: false,
      },
    ],
    categories,
    items,
    optionGroups,
  };
}

function normalizeCategories(body) {
  return body
    .filter((block) => block?.type === 'LIST' && Array.isArray(block.data?.elements))
    .filter((block) => block.data.tracking?.collectionType !== 'TOP_SELLERS')
    .map((block, index) => ({
      id: String(block.data.slug || block.data.tracking?.sectionId || `category-${index + 1}`),
      sectionId: 'main',
      name: block.data.title || `Category ${index + 1}`,
      active: true,
      raw: block.data,
    }));
}

function normalizeItems(categories) {
  const items = [];
  for (const [categoryIndex, category] of categories.entries()) {
    const products = category.raw.elements
      .filter((element) => element?.type === 'PRODUCT_ROW' || element?.type === 'PRODUCT_TILE')
      .map((element) => element.data)
      .filter(Boolean);

    for (const [itemIndex, product] of products.entries()) {
      const active = isActive(product);
      const itemId = String(product.id || product.storeProductId || product.externalId || `item-${categoryIndex + 1}-${itemIndex + 1}`);
      items.push({
        id: itemId,
        categoryId: category.id,
        name: product.name || `Item ${categoryIndex + 1}-${itemIndex + 1}`,
        description: product.description,
        price: extractPrice(product),
        imageUrl: getImageUrl(product),
        active,
        soldOut: !active,
        optionGroupIds: extractAttributeGroups(product).map((group, groupIndex) => groupId(group, itemId, groupIndex)),
        raw: product,
      });
    }
  }
  return items;
}

function normalizeOptionGroups(items) {
  const groups = [];
  const seen = new Set();
  for (const item of items) {
    for (const [groupIndex, group] of extractAttributeGroups(item.raw).entries()) {
      const normalized = normalizeOptionGroup(group, item.id, groupIndex);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      groups.push(normalized);
    }
  }
  return groups;
}

function normalizeOptionGroup(group, itemId, groupIndex) {
  const options = (group.attributes || []).map((attribute, optionIndex) => ({
    id: String(attribute.id || attribute.attributeId || attribute.externalId || `${groupId(group, itemId, groupIndex)}-${optionIndex + 1}`),
    name: attribute.name || `Option ${optionIndex + 1}`,
    price: extractPriceImpact(attribute),
    active: isActive(attribute),
    default: attribute.selected === true || attribute.default === true,
    raw: attribute,
  }));

  if (options.length === 0) return null;
  const min = numberValue(group.min);
  const max = numberValue(group.max);
  return {
    id: groupId(group, itemId, groupIndex),
    sectionId: 'main',
    name: group.name || `Options ${groupIndex + 1}`,
    type: max === 1 ? 'single' : 'multiple',
    required: Boolean((min ?? 0) > 0 || group.required),
    min,
    max,
    active: isActive(group),
    options,
    raw: group,
  };
}

function groupId(group, itemId, groupIndex) {
  return String(group.id || group.attributeGroupId || group.externalId || `${itemId}-group-${groupIndex + 1}`);
}

function extractAttributeGroups(product) {
  return Array.isArray(product?.attributeGroups) ? product.attributeGroups : [];
}

function extractPrice(product) {
  const display = parseDisplayPrice(product?.priceInfo?.displayText);
  if (display !== undefined) return display;
  const amount = numberValue(product?.priceInfo?.amount ?? product?.price);
  return amount === undefined ? undefined : amount;
}

function extractPriceImpact(attribute) {
  const display = parseDisplayPrice(attribute?.priceInfo?.displayText);
  if (display !== undefined) return display;
  const amount = numberValue(attribute?.priceInfo?.amount ?? attribute?.priceImpact ?? attribute?.price);
  return amount ?? 0;
}

function getImageUrl(product) {
  if (product?.imageUrl) return product.imageUrl;
  if (Array.isArray(product?.images)) {
    const image = product.images.find((entry) => typeof entry === 'string' || entry?.url);
    if (typeof image === 'string') return image;
    if (image?.url) return image.url;
  }
  if (typeof product?.imageId === 'string' && product.imageId.startsWith('dh:')) {
    return `https://glovo.dhmedia.io/image/${product.imageId.slice(3)}`;
  }
  return undefined;
}

function isActive(value) {
  const status = String(value?.availability || value?.status || value?.state || '').toLowerCase();
  return !(
    value?.available === false ||
    value?.enabled === false ||
    value?.soldOut === true ||
    status.includes('sold') ||
    status.includes('unavailable') ||
    status.includes('disabled')
  );
}

function findCurrency(items) {
  for (const item of items) {
    const currency = item.raw?.priceInfo?.currencyCode;
    if (currency) return currency;
  }
  return undefined;
}

function firstNumber(values) {
  for (const value of values) {
    const number = numberValue(value);
    if (number !== undefined) return String(Math.trunc(number));
  }
  return undefined;
}

function matchValue(text, pattern) {
  return text.match(pattern)?.[1];
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatGlovoError(parsed) {
  if (!parsed) return '';
  return parsed.error?.message || parsed.message || parsed.error || JSON.stringify(parsed).slice(0, 500);
}

export const __test__ = {
  extractStoreIds,
  findCityCode,
  normalizeGlovoData,
  slugify,
};
