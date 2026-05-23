import { AppError } from '../errors.js';
import { arrayProp, fromMinorUnits, getString, localized, numberValue, parseDisplayPrice, summarizeFailures, walk } from '../utils/parser.js';
import { extractJsonScripts, extractScriptJsonById } from '../utils/html-scraper.js';
import { USER_AGENT } from '../constants.js';

export async function parseWoltMenu(marketplaceUrl, { logger } = {}) {
  const url = new URL(marketplaceUrl);
  const slug = extractSlug(url);
  const candidates = buildCandidateUrls(url, slug);
  const failures = [];

  for (const candidate of candidates) {
    try {
      const data = await fetchJson(candidate);
      const menu = normalizeWoltData(data, slug);
      if (menu.categories.length > 0 && menu.items.length > 0) return menu;
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }

  try {
    const html = await fetchText(url.toString());
    const data = extractJsonFromHtml(html);
    const menu = normalizeWoltData(data, slug);
    if (menu.categories.length > 0 && menu.items.length > 0) return menu;
  } catch (error) {
    failures.push(`${url}: ${error.message}`);
  }

  logger?.warn?.('Wolt parser could not find menu data in known public endpoints.');
  throw new AppError(
    `Could not extract Wolt menu data. Tried ${failures.length} sources.${summarizeFailures(failures) ? ` First failures: ${summarizeFailures(failures)}` : ''}`,
    'WOLT_PARSE_ERROR',
    failures,
  );
}

function extractSlug(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const restaurantIndex = parts.indexOf('restaurant');
  if (restaurantIndex >= 0 && parts[restaurantIndex + 1]) return parts[restaurantIndex + 1];
  return parts.at(-1);
}

function buildCandidateUrls(originalUrl, slug) {
  const encodedSlug = encodeURIComponent(slug);
  const language = originalUrl.pathname.split('/').filter(Boolean)[0] || 'en';
  return [
    `https://restaurant-api.wolt.com/v1/pages/venue/slug/${encodedSlug}?language=${encodeURIComponent(language)}`,
    `https://restaurant-api.wolt.com/v1/pages/venue/${encodedSlug}?language=${encodeURIComponent(language)}`,
    `https://restaurant-api.wolt.com/v1/venues/slug/${encodedSlug}/menu?language=${encodeURIComponent(language)}`,
  ];
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function extractJsonFromHtml(html) {
  try {
    return extractScriptJsonById(html, '__NEXT_DATA__');
  } catch {
    // Keep searching other JSON script tags.
  }
  const [scriptJson] = extractJsonScripts(html, { contains: 'menu' });
  if (scriptJson) return scriptJson;

  throw new Error('No embedded JSON menu data found');
}

function normalizeWoltData(data, slug) {
  const root = findMenuRoot(data);
  const categories = normalizeCategories(root);
  const items = normalizeItems(root, categories);
  const optionGroups = normalizeOptionGroups(root, items);

  return {
    marketplace: 'wolt',
    sourceId: getString(root, ['id', 'venue_id', 'venueId']) || slug,
    currency: getString(root, ['currency']) || undefined,
    sections: [
      {
        id: getString(root, ['id']) || slug,
        name: getString(root, ['name', 'title']) || 'Main menu',
        description: getString(root, ['description']),
      },
    ],
    categories,
    items,
    optionGroups,
  };
}

function findMenuRoot(data) {
  const candidates = [];
  walk(data, (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const categoryCount = arrayProp(value, ['categories', 'menu_categories']).length;
    const itemCount = arrayProp(value, ['items', 'menu_items']).length;
    if (categoryCount > 0 || itemCount > 0) {
      candidates.push({ value, score: categoryCount * 2 + itemCount });
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0]) return candidates[0].value;
  throw new Error('No menu-like object found');
}

function normalizeCategories(root) {
  const rawCategories = arrayProp(root, ['categories', 'menu_categories']);
  return rawCategories.map((category, index) => ({
    id: getString(category, ['id', 'pos_id', 'posId', 'sku']) || `category-${index + 1}`,
    sectionId: 'main',
    name: localized(category.name) || localized(category.title) || `Category ${index + 1}`,
    description: localized(category.description),
    active: !isUnavailable(category),
    raw: category,
  }));
}

function normalizeItems(root, categories) {
  const rawItems = arrayProp(root, ['items', 'menu_items']);
  const itemsByCategory = new Map();
  const itemsById = new Map(
    rawItems
      .map((item) => [getString(item, ['id', 'pos_id', 'posId', 'sku']), item])
      .filter(([id]) => id),
  );

  for (const item of rawItems) {
    const categoryId = getString(item, ['category_id', 'categoryId', 'category', 'parent_category_id']);
    if (!categoryId) continue;
    if (!itemsByCategory.has(categoryId)) itemsByCategory.set(categoryId, []);
    itemsByCategory.get(categoryId).push(item);
  }

  const items = [];
  for (const [categoryIndex, category] of categories.entries()) {
    const itemIds = arrayProp(category.raw, ['item_ids', 'itemIds']);
    const linkedItems = itemIds.map((id) => itemsById.get(String(id))).filter(Boolean);
    const embeddedItems = arrayProp(category.raw, ['items', 'menu_items']);
    const categoryItems = linkedItems.length > 0
      ? linkedItems
      : embeddedItems.length > 0
        ? embeddedItems
        : itemsByCategory.get(category.id) || [];
    for (const [itemIndex, item] of categoryItems.entries()) {
      items.push(normalizeItem(item, category.id, `${categoryIndex + 1}-${itemIndex + 1}`));
    }
  }

  if (items.length === 0 && rawItems.length > 0) {
    const fallbackCategory = categories[0]?.id || 'category-1';
    rawItems.forEach((item, index) => items.push(normalizeItem(item, fallbackCategory, `1-${index + 1}`)));
  }

  return items;
}

function normalizeItem(item, categoryId, fallbackId) {
  const price = extractRegularPrice(item);
  return {
    id: getString(item, ['id', 'pos_id', 'posId', 'sku']) || `item-${fallbackId}`,
    categoryId,
    name: localized(item.name) || localized(item.title) || `Item ${fallbackId}`,
    description: localized(item.description),
    price,
    imageUrl: getImageUrl(item),
    active: !isUnavailable(item),
    soldOut: isUnavailable(item),
    optionGroupIds: extractOptionGroupIds(item),
    raw: item,
  };
}

function normalizeOptionGroups(root, items) {
  const rawGroups = arrayProp(root, ['options', 'option_groups', 'dishOptions', 'modifiers']);
  const groups = rawGroups.map(normalizeOptionGroup).filter(Boolean);
  const byId = new Map(groups.map((group) => [group.id, group]));

  for (const item of items) {
    for (const embedded of arrayProp(item.raw, ['options', 'option_groups', 'modifiers'])) {
      const group = normalizeOptionGroup(embedded);
      if (group && !byId.has(group.id)) {
        byId.set(group.id, group);
        groups.push(group);
      }
    }
  }

  return groups;
}

function normalizeOptionGroup(group, index = 0) {
  const options = arrayProp(group, ['values', 'items', 'options', 'list']).map((option, optionIndex) => ({
    id: getString(option, ['id', 'pos_id', 'posId', 'sku']) || `option-${index + 1}-${optionIndex + 1}`,
    name: localized(option.name) || localized(option.title) || `Option ${optionIndex + 1}`,
    price: extractRegularPrice(option) ?? 0,
    active: !isUnavailable(option),
    default: Boolean(option.default || option.is_default || option.selected_by_default),
    raw: option,
  }));

  if (options.length === 0) return null;
  const max = numberValue(group.max || group.maximum || group.max_selections || group.maxSelection);
  const min = numberValue(group.min || group.minimum || group.min_selections || group.minSelection);
  return {
    id: getString(group, ['id', 'pos_id', 'posId', 'sku']) || `group-${index + 1}`,
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

function extractRegularPrice(value) {
  const display = parseDisplayPrice(
    value.price?.displayText ??
      value.price?.formatted ??
      value.price?.price_str ??
      value.display_price ??
      value.displayPrice,
  );
  if (display !== undefined) return display;
  const direct = numberValue(value.price);
  if (direct !== undefined) return fromMinorUnits(direct);
  const regular = numberValue(value.base_price ?? value.unit_price ?? value.original_price ?? value.regular_price);
  if (regular !== undefined) return fromMinorUnits(regular);
  if (value.price && typeof value.price === 'object') {
    return fromMinorUnits(value.price.amount ?? value.price.value ?? value.price.integer);
  }
  return undefined;
}

function extractOptionGroupIds(item) {
  const ids = [];
  for (const binding of arrayProp(item, ['option_bindings', 'optionBindings', 'options', 'option_groups', 'modifiers'])) {
    const id = getString(binding, ['option_id', 'optionId', 'group_id', 'groupId', 'pos_id', 'posId', 'id']);
    if (id) ids.push(id);
  }
  return ids;
}

function getImageUrl(item) {
  const direct = getString(item, ['image', 'image_url', 'imageUrl', 'photo', 'photo_url']);
  if (direct) return direct;
  if (item.image && typeof item.image === 'object') return getString(item.image, ['url', 'src']);
  if (Array.isArray(item.images)) {
    const image = item.images.find((entry) => getString(entry, ['url', 'src']));
    if (image) return getString(image, ['url', 'src']);
  }
  if (Array.isArray(item.photos)) {
    const image = item.photos.find((entry) => getString(entry, ['url', 'src']));
    if (image) return getString(image, ['url', 'src']);
  }
  return undefined;
}

function isUnavailable(value) {
  const status = String(value.status || value.availability || '').toLowerCase();
  return Boolean(
    value.disabled ||
      value.sold_out ||
      value.soldOut ||
      value.available === false ||
      value.enabled === false ||
      status.includes('sold') ||
      status.includes('unavailable') ||
      status.includes('disabled'),
  );
}

export const __test__ = {
  normalizeWoltData,
};
