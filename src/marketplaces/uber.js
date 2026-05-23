import { AppError } from '../errors.js';
import { arrayProp, getString, localized, numberValue, parseDisplayPrice, parseJson, summarizeFailures } from '../utils/parser.js';
import { extractScriptContentById } from '../utils/html-scraper.js';
import { USER_AGENT } from '../constants.js';

export async function parseUberMenu(marketplaceUrl, { logger } = {}) {
  const url = new URL(marketplaceUrl);
  const storeSlug = extractStoreSlug(url);
  const failures = [];

  try {
    const html = await fetchUberHtml(url.toString());
    const state = extractReactQueryState(html);
    await hydrateUberItemDetails(state, { logger });
    const menu = normalizeUberData(state, storeSlug);
    if (menu.categories.length > 0 && menu.items.length > 0) return menu;
  } catch (error) {
    failures.push(`${url}: ${error.message}`);
  }

  logger?.warn?.('Uber Eats parser could not extract menu data from embedded page state.');
  throw new AppError(
    `Could not extract Uber Eats menu data. Tried ${failures.length || 1} source.${summarizeFailures(failures) ? ` First failures: ${summarizeFailures(failures)}` : ''}`,
    'UBER_PARSE_ERROR',
    failures,
  );
}

async function hydrateUberItemDetails(data, { logger } = {}) {
  const items = getCatalogSections(data)
    .flatMap((section) => section.catalogItems)
    .filter((item) => item?.hasCustomizations);
  if (items.length === 0) return;

  const tasks = items.map((item) => async () => {
    try {
      const detail = await fetchUberItemDetail(data, item);
      if (detail) Object.assign(item, detail);
    } catch (error) {
      logger?.warn?.(`Uber Eats item additions unavailable for ${item.title || item.uuid}: ${error.message}`);
    }
  });

  await runWithConcurrency(tasks, 4);
}

async function fetchUberItemDetail(data, item) {
  const response = await fetch('https://www.ubereats.com/_p/api/getMenuItemV1', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'x-csrf-token': 'x',
      'x-uber-client-name': 'ubereats_com',
    },
    body: JSON.stringify({
      itemRequestType: 'ITEM',
      storeUuid: getString(data, ['uuid']),
      sectionUuid: item.sectionUuid,
      subsectionUuid: item.subsectionUuid,
      menuItemUuid: item.uuid,
      diningMode: 'DELIVERY',
      isEditFlow: false,
      cbType: 'EATER_ENDORSED',
      includeCheaperAlternatives: true,
      contextReferences: [
        {
          type: 'GROUP_ITEMS',
          payload: {
            type: 'groupItemsContextReferencePayload',
            groupItemsContextReferencePayload: {},
          },
          pageContext: 'STORE',
        },
      ],
    }),
  });
  const text = await response.text();
  const parsed = parseJson(text);
  if (!response.ok || parsed?.status === 'failure') {
    throw new Error(`HTTP ${response.status}: ${formatUberApiError(parsed) || text.slice(0, 300)}`);
  }
  return parsed?.data;
}

async function runWithConcurrency(tasks, concurrency) {
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async (_, workerIndex) => {
    for (let index = workerIndex; index < tasks.length; index += concurrency) {
      await tasks[index]();
    }
  });
  await Promise.all(workers);
}

function extractStoreSlug(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const storeIndex = parts.indexOf('store');
  if (storeIndex >= 0 && parts[storeIndex + 1]) return parts[storeIndex + 1];
  throw new AppError(`Uber Eats URL does not contain a store slug: ${url}`, 'UBER_INVALID_URL');
}

async function fetchUberHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': USER_AGENT,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return text;
}

function extractReactQueryState(html) {
  const raw = extractScriptContentById(html, '__REACT_QUERY_STATE__');
  const state = parseUberEscapedJson(raw);
  const storeQuery = state.queries?.find((query) => {
    const key = query.queryKey;
    return Array.isArray(key) && key[0] === 'getStoreV1' && query.state?.data;
  });
  if (!storeQuery) throw new Error('No Uber Eats getStoreV1 query state found');
  return storeQuery.state.data;
}

function parseUberEscapedJson(raw) {
  const json = raw
    .replace(/%5C\\u0022/g, '%5C\\\\u0022')
    .replace(/\\u005[Cc]\\u0022/g, '\\\\u005C\\u0022')
    .replace(/\\u(?!005[Cc])([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return JSON.parse(json);
}

function normalizeUberData(data, storeSlug) {
  const sectionId = getString(data, ['uuid']) || storeSlug;
  const rawSections = getCatalogSections(data);
  const categories = normalizeCategories(rawSections);
  const items = normalizeItems(rawSections);
  const optionGroups = normalizeOptionGroups(items);

  return {
    marketplace: 'uber',
    sourceId: sectionId,
    currency: getString(data, ['currencyCode']),
    sections: [
      {
        id: sectionId,
        name: getString(data, ['title', 'sanitizedTitle']) || 'Main menu',
        description: getString(data.seoMeta, ['description']),
        schedule: normalizeSchedule(data.hours || data.meta?.sectionHoursInfo),
        showOutsideSchedule: false,
      },
    ],
    categories,
    items,
    optionGroups,
  };
}

function getCatalogSections(data) {
  const map = data.catalogSectionsMap || {};
  return Object.values(map)
    .flat()
    .map((entry) => entry?.payload?.standardItemsPayload)
    .filter((payload) => Array.isArray(payload?.catalogItems));
}

function normalizeCategories(rawSections) {
  return rawSections.map((section, index) => ({
    id: getCategoryId(section, index),
    sectionId: 'main',
    name: localized(section.title) || `Category ${index + 1}`,
    active: true,
    raw: section,
  }));
}

function normalizeItems(rawSections) {
  const items = [];
  for (const [categoryIndex, section] of rawSections.entries()) {
    const categoryId = getCategoryId(section, categoryIndex);
    for (const [itemIndex, item] of section.catalogItems.entries()) {
      const active = !isUnavailable(item);
      const itemId = getString(item, ['uuid']) || `item-${categoryIndex + 1}-${itemIndex + 1}`;
      items.push({
        id: `${categoryId}-${itemId}`,
        categoryId,
        name: getString(item, ['title']) || localized(item.titleBadge) || `Item ${categoryIndex + 1}-${itemIndex + 1}`,
        description: getString(item, ['itemDescription']) || localized(item.itemDescriptionBadge),
        price: extractRegularPrice(item),
        imageUrl: getString(item, ['imageUrl']),
        active,
        soldOut: !active,
        optionGroupIds: extractOptionGroupIds(item),
        raw: item,
      });
    }
  }
  return items;
}

function getCategoryId(section, index) {
  const sectionId = getString(section, ['sectionUUID']) || 'section';
  const title = localized(section.title) || `category-${index + 1}`;
  return `${sectionId}-${index + 1}-${title}`;
}

function normalizeOptionGroups(items) {
  const groups = [];
  const seen = new Set();

  for (const item of items) {
    for (const group of extractRawOptionGroups(item.raw)) {
      const normalized = normalizeOptionGroup(group, groups.length);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      groups.push(normalized);
    }
  }

  return groups;
}

function normalizeOptionGroup(group, index) {
  const options = arrayProp(group, ['customizationOptions', 'options', 'items', 'choices']).map((option, optionIndex) => ({
    id: getString(option, ['uuid', 'id']) || `option-${index + 1}-${optionIndex + 1}`,
    name: getString(option, ['title', 'name']) || localized(option.titleBadge) || `Option ${optionIndex + 1}`,
    price: extractRegularPrice(option) ?? 0,
    active: !isUnavailable(option),
    default: Boolean(option.isDefault || option.default),
    raw: option,
  }));

  if (options.length === 0) return null;
  const min = numberValue(group.minPermitted ?? group.min ?? group.minimum);
  const maxUnique = numberValue(group.maxPermittedUnique);
  const max = maxUnique && maxUnique > 0 ? maxUnique : numberValue(group.maxPermitted ?? group.max ?? group.maximum);
  return {
    id: getString(group, ['uuid', 'id']) || `group-${index + 1}`,
    sectionId: 'main',
    name: getString(group, ['title', 'name']) || localized(group.titleBadge) || `Options ${index + 1}`,
    type: max === 1 ? 'single' : 'multiple',
    required: Boolean(group.isRequired || group.required || min > 0),
    min,
    max,
    active: !isUnavailable(group),
    options,
    raw: group,
  };
}

function extractRawOptionGroups(item) {
  return [
    ...arrayProp(item, ['customizationsList', 'customizations', 'modifierGroups', 'optionGroups']),
    ...arrayProp(item.purchaseInfo, ['customizationsList', 'customizations', 'modifierGroups', 'optionGroups']),
  ];
}

function extractOptionGroupIds(item) {
  return extractRawOptionGroups(item)
    .map((group) => getString(group, ['uuid', 'id']))
    .filter(Boolean);
}

function extractRegularPrice(value) {
  const display = parseDisplayPrice(
    value?.priceTagline?.text ??
      value?.priceTagline ??
      value?.displayPrice ??
      value?.priceDisplay,
  );
  if (display !== undefined) return display;
  const direct = numberValue(value?.price);
  if (direct !== undefined) return fromUberMinorUnits(direct);
  const discounted = numberValue(value?.discountedPrice);
  const original = numberValue(value?.originalPrice);
  if (original !== undefined) return fromUberMinorUnits(original);
  if (discounted !== undefined) return fromUberMinorUnits(discounted);
  const purchaseOption = arrayProp(value?.purchaseInfo, ['purchaseOptions'])[0];
  const purchasePrice = numberValue(purchaseOption?.price ?? purchaseOption?.basePrice);
  return purchasePrice === undefined ? undefined : fromUberMinorUnits(purchasePrice);
}

function fromUberMinorUnits(value) {
  return value / 100;
}

function isUnavailable(value) {
  const status = String(value?.itemAvailabilityState || value?.availability || value?.status || '').toLowerCase();
  return Boolean(
    value?.isSoldOut ||
      value?.isAvailable === false ||
      value?.available === false ||
      status.includes('sold') ||
      status.includes('unavailable') ||
      status.includes('inactive'),
  );
}

function normalizeSchedule(hours) {
  if (!Array.isArray(hours)) return undefined;
  const result = [];
  for (const block of hours) {
    const days = daysFromRange(block.dayRange);
    for (const range of block.sectionHours || []) {
      for (const dayOfWeek of days) {
        result.push({
          dayOfWeek,
          active: true,
          from: minutesToTime(range.startTime),
          till: minutesToTime(range.endTime),
        });
      }
    }
  }
  return result.length > 0 ? result : undefined;
}

function daysFromRange(dayRange) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (!dayRange) return [];
  const [start, end] = String(dayRange).split('-').map((part) => part.trim());
  const startIndex = days.findIndex((day) => day.toLowerCase() === start?.toLowerCase());
  const endIndex = days.findIndex((day) => day.toLowerCase() === end?.toLowerCase());
  if (startIndex === -1) return [];
  if (endIndex === -1) return [startIndex];

  const result = [];
  for (let day = startIndex; ; day = (day + 1) % 7) {
    result.push(day);
    if (day === endIndex) break;
  }
  return result;
}

function minutesToTime(minutes) {
  const safeMinutes = Math.max(0, Math.min(1439, Number(minutes) || 0));
  const hours = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
  const mins = String(safeMinutes % 60).padStart(2, '0');
  return `${hours}:${mins}:00`;
}

function formatUberApiError(parsed) {
  if (!parsed) return '';
  return parsed.message || parsed.error || JSON.stringify(parsed).slice(0, 300);
}

export const __test__ = {
  extractReactQueryState,
  normalizeUberData,
  parseUberEscapedJson,
};
