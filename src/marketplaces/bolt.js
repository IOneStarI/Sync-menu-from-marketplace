import { AppError } from '../errors.js';
import { parseDisplayPrice, parseJson, localized, numberValue, summarizeFailures, walk } from '../utils/parser.js';
import { BOLT_DEFAULT_API_BASE_URL, BOLT_DEFAULT_VERSION, USER_AGENT } from '../constants.js';

export async function parseBoltMenu(marketplaceUrl, { logger } = {}) {
  const url = new URL(marketplaceUrl);
  const { providerId, cityId } = extractBoltIds(url);
  const query = createBoltQuery({ providerId, cityId });
  const failures = [];

  try {
    const [providerResponse, menuResponse] = await Promise.all([
      fetchBoltJson('/deliveryClient/public/getProviderDetails', query),
      fetchBoltJson('/deliveryClient/public/getMenuCategories', query),
    ]);
    const menu = normalizeBoltData({
      provider: providerResponse.data?.provider,
      menu: menuResponse.data,
      providerId,
    });
    if (menu.categories.length > 0 && menu.items.length > 0) return menu;
  } catch (error) {
    failures.push(error.message);
  }

  logger?.warn?.('Bolt parser could not extract menu data from public API.');
  throw new AppError(
    `Could not extract Bolt menu data. Tried ${failures.length || 1} source.${summarizeFailures(failures) ? ` First failures: ${summarizeFailures(failures)}` : ''}`,
    'BOLT_PARSE_ERROR',
    failures,
  );
}

function extractBoltIds(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const cityPart = parts.find((part) => /^\d+-/.test(part));
  const providerPartIndex = parts.indexOf('p');
  const providerSlug = providerPartIndex >= 0 ? parts[providerPartIndex + 1] : undefined;
  const providerId = numberFromStart(providerSlug);
  const cityId = numberFromStart(cityPart);

  if (!providerId) {
    throw new AppError(`Bolt URL does not contain a provider ID: ${url}`, 'BOLT_INVALID_URL');
  }

  return {
    providerId,
    cityId,
  };
}

function createBoltQuery({ providerId, cityId }) {
  return {
    provider_id: providerId,
    city_id: cityId,
    deviceId: process.env.BOLT_DEVICE_ID || 'web',
    deviceType: process.env.BOLT_DEVICE_TYPE || 'web',
    device_name: process.env.BOLT_DEVICE_NAME || 'web',
    device_os_version: process.env.BOLT_DEVICE_OS_VERSION || 'web',
    language: process.env.BOLT_LANGUAGE || 'uk-UA',
    session_id: process.env.BOLT_SESSION_ID || 'sync-menu-from-marketplace',
    version: process.env.BOLT_VERSION || BOLT_DEFAULT_VERSION,
  };
}

async function fetchBoltJson(path, query) {
  const baseUrl = (process.env.BOLT_API_BASE_URL || BOLT_DEFAULT_API_BASE_URL).replace(/\/$/, '');
  const url = new URL(path, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      Origin: 'https://food.bolt.eu',
    },
  });
  const text = await response.text();
  const parsed = parseJson(text);
  if (!response.ok) throw new Error(`Bolt API ${path} failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  if (!parsed || parsed.code !== 0) {
    throw new Error(`Bolt API ${path} returned error: ${formatBoltError(parsed)}`);
  }
  return parsed;
}

function normalizeBoltData({ provider, menu, providerId }) {
  const itemsById = menu?.items || {};
  const root = itemsById[menu?.root_id];
  const categories = normalizeCategories(itemsById, root);
  const dishes = normalizeDishes(itemsById, categories);
  const optionGroups = normalizeOptionGroups(itemsById, dishes);

  return {
    marketplace: 'bolt',
    sourceId: String(provider?.provider_id || providerId),
    currency: findCurrency(dishes),
    sections: [
      {
        id: String(provider?.provider_id || providerId),
        name: localized(provider?.name) || 'Main menu',
        description: localized(provider?.description),
        schedule: normalizeSchedule(provider?.schedule),
        showOutsideSchedule: false,
      },
    ],
    categories,
    items: dishes,
    optionGroups,
  };
}

function normalizeCategories(itemsById, root) {
  const rootChildIds = root?.child_ids || [];
  return rootChildIds
    .map((id) => itemsById[id])
    .filter((item) => item?.type === 'category')
    .sort(byIndex)
    .map((category, index) => ({
      id: String(category.id || category.product_id || `category-${index + 1}`),
      sectionId: 'main',
      name: localized(category.name) || `Category ${index + 1}`,
      description: localized(category.description),
      active: isActive(category),
      raw: category,
    }));
}

function normalizeDishes(itemsById, categories) {
  const dishes = [];
  for (const [categoryIndex, category] of categories.entries()) {
    const categoryDishes = (category.raw.child_ids || [])
      .map((id) => itemsById[id])
      .filter((item) => item?.type === 'dish')
      .sort(byIndex);

    for (const [dishIndex, dish] of categoryDishes.entries()) {
      dishes.push({
        id: String(dish.id || dish.product_id || `dish-${categoryIndex + 1}-${dishIndex + 1}`),
        categoryId: category.id,
        name: localized(dish.name) || `Item ${categoryIndex + 1}-${dishIndex + 1}`,
        description: localized(dish.description),
        price: extractBoltPrice(dish.price),
        imageUrl: getImageUrl(dish),
        active: isActive(dish),
        soldOut: !isActive(dish),
        optionGroupIds: (dish.child_ids || [])
          .map((id) => itemsById[id])
          .filter((item) => isOptionGroup(item))
          .map((item) => String(item.id)),
        raw: dish,
      });
    }
  }
  return dishes;
}

function normalizeOptionGroups(itemsById, dishes) {
  const groups = [];
  const byId = new Set();
  for (const dish of dishes) {
    for (const groupId of dish.optionGroupIds) {
      const group = itemsById[groupId];
      if (!isOptionGroup(group) || byId.has(String(group.id))) continue;
      byId.add(String(group.id));
      groups.push(normalizeOptionGroup(group, itemsById, groups.length));
    }
  }
  return groups.filter(Boolean);
}

function normalizeOptionGroup(group, itemsById, index) {
  const options = (group.child_ids || [])
    .map((id) => itemsById[id])
    .filter((item) => item && (item.type === 'option_select' || item.type === 'option_multi_select'))
    .sort(byIndex)
    .map((option, optionIndex) => ({
      id: String(option.id || option.product_id || `option-${index + 1}-${optionIndex + 1}`),
      name: localized(option.name) || `Option ${optionIndex + 1}`,
      price: extractBoltPrice(option.price) ?? 0,
      active: isActive(option),
      default: false,
      raw: option,
    }));

  if (options.length === 0) return null;

  return {
    id: String(group.id || `group-${index + 1}`),
    sectionId: 'main',
    name: localized(group.name) || `Options ${index + 1}`,
    type: group.type === 'option_select_group' ? 'single' : 'multiple',
    required: Boolean(group.is_required || numberValue(group.min) > 0),
    min: numberValue(group.min),
    max: group.type === 'option_select_group' ? 1 : numberValue(group.max),
    active: isActive(group),
    options,
    raw: group,
  };
}

function normalizeSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return undefined;
  const result = [];
  for (const [day, ranges] of Object.entries(schedule)) {
    for (const range of ranges || []) {
      result.push({
        dayOfWeek: Number(day),
        active: true,
        from: minutesToTime(range.start_at_minutes_from_midnight),
        till: minutesToTime(range.stop_at_minutes_from_midnight),
      });
    }
  }
  return result.length > 0 ? result : undefined;
}

function minutesToTime(minutes) {
  const safeMinutes = Math.max(0, Math.min(1439, Number(minutes) || 0));
  const hours = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
  const mins = String(safeMinutes % 60).padStart(2, '0');
  return `${hours}:${mins}:00`;
}

function getImageUrl(item) {
  const images = item.images || {};
  const candidates = [];
  walk(images, (value) => {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) candidates.push(value);
  });
  return candidates[0];
}

function isOptionGroup(item) {
  return item?.type === 'option_select_group' || item?.type === 'option_multi_select_group';
}

function isActive(item) {
  return !['sold_out', 'unavailable', 'disabled'].includes(String(item?.availability || '').toLowerCase());
}

function numberFromStart(value) {
  const match = String(value || '').match(/^-?\d+/);
  return match ? Number(match[0]) : undefined;
}

function findCurrency(items) {
  return items.find((item) => item.raw?.price?.currency)?.raw.price.currency;
}

function extractBoltPrice(price) {
  return parseDisplayPrice(price?.price_str) ?? numberValue(price?.value);
}

function byIndex(a, b) {
  return (a.index ?? 0) - (b.index ?? 0);
}

function formatBoltError(parsed) {
  if (!parsed) return 'empty or invalid JSON response';
  if (Array.isArray(parsed.validation_errors)) {
    return parsed.validation_errors.map((error) => `${error.property}: ${error.error}`).join('; ');
  }
  return parsed.message || JSON.stringify(parsed).slice(0, 500);
}

export const __test__ = {
  normalizeBoltData,
};
