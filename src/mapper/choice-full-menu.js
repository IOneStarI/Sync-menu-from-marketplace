import { makePosId } from '../utils/pos-id.js';

export function mapToChoiceFullMenu(menu) {
  const warnings = [];
  const failedItems = [];
  const sectionMap = new Map();
  const categoryMap = new Map();
  const optionMap = new Map();

  const sections = (menu.sections.length > 0 ? menu.sections : [{ id: 'main', name: 'Main menu' }]).map(
    (section, index) => {
      const posID = makePosId('section', section.id || section.name || index);
      sectionMap.set(section.id || 'main', posID);
      if (index === 0) sectionMap.set('main', posID);
      return cleanObject({
        posID,
        name: section.name || `Section ${index + 1}`,
        description: section.description,
        showOutsideSchedule: section.showOutsideSchedule,
        schedule: section.schedule,
      });
    },
  );

  const categories = menu.categories.map((category, index) => {
    const sectionPosID = sectionMap.get(category.sectionId) || sections[0].posID;
    const posID = makePosId('category', category.id || category.name || index);
    categoryMap.set(category.id, posID);
    return {
      name: category.name || `Category ${index + 1}`,
      posID,
      sectionPosID,
      active: category.active !== false,
    };
  });
  const usedCategorySectionPosIDs = new Set(categories.map((category) => category.sectionPosID));
  const payloadSections = categories.length > 0
    ? sections.filter((section) => usedCategorySectionPosIDs.has(section.posID))
    : sections;
  const defaultSectionPosID = payloadSections[0]?.posID || sections[0]?.posID;

  const uniqueOptionGroups = dedupeOptionGroups(menu.optionGroups);
  const dishOptions = uniqueOptionGroups.map((group, index) => {
    const groupSectionPosID = sectionMap.get(group.sectionId) || defaultSectionPosID;
    const sectionPosID = usedCategorySectionPosIDs.has(groupSectionPosID) ? groupSectionPosID : defaultSectionPosID;
    const posID = makePosId('option', group.id || group.name || index);
    const list = group.options.map((option, optionIndex) =>
      cleanObject({
        name: option.name || `Option ${optionIndex + 1}`,
        active: option.active !== false,
        default: option.default === true ? true : undefined,
        price: toChoiceMinorUnits(option.price ?? 0),
        posID: makePosId('option-item', option.id || `${group.id}-${optionIndex}`),
      }),
    );

    for (const alias of group.aliasIds) {
      optionMap.set(alias, { posID, list });
    }
    return cleanObject({
      posID,
      sectionPosID,
      active: group.active !== false,
      type: group.type === 'single' ? 'single' : 'multiple',
      required: group.required === true ? true : undefined,
      countable: group.countable === true ? true : undefined,
      menuMinCount: group.min,
      menuMaxCount: group.max,
      name: group.name || `Options ${index + 1}`,
      list,
    });
  });

  const dishes = [];
  for (const [index, item] of menu.items.entries()) {
    const categoryPosID = categoryMap.get(item.categoryId);
    if (!categoryPosID) {
      failedItems.push({
        name: item.name || item.id || `Item ${index + 1}`,
        reason: `Missing category mapping: ${item.categoryId}`,
      });
      continue;
    }

    if (item.price === undefined) {
      failedItems.push({
        name: item.name || item.id || `Item ${index + 1}`,
        reason: 'Missing required regular price',
      });
      continue;
    }

    if (!item.imageUrl) warnings.push(`Missing image for item: ${item.name}`);

    const active = item.active !== false && item.soldOut !== true;
    dishes.push(
      cleanObject({
        posID: makePosId('dish', item.id || item.name || index),
        categoryPosID,
        name: item.name || `Item ${index + 1}`,
        description: item.description,
        price: toChoiceMinorUnits(item.price),
        active,
        attributes: active ? [] : ['SOLD_OUT'],
        media: item.imageUrl,
        dishOptions: mapDishOptions(item.optionGroupIds, optionMap),
      }),
    );
  }

  return {
    payload: {
      sections: payloadSections,
      categories,
      dishOptions,
      dishes,
    },
    warnings,
    failedItems,
    sourceCounts: {
      items: menu.items.length,
    },
  };
}

function dedupeOptionGroups(optionGroups) {
  const bySignature = new Map();
  for (const group of optionGroups) {
    const signature = optionGroupSignature(group);
    const existing = bySignature.get(signature);
    if (existing) {
      existing.aliasIds.add(group.id);
      continue;
    }
    bySignature.set(signature, {
      ...group,
      aliasIds: new Set([group.id]),
    });
  }

  return [...bySignature.values()].map((group) => ({
    ...group,
    aliasIds: [...group.aliasIds],
  }));
}

function optionGroupSignature(group) {
  const list = group.options
    .map((option) => [
      normalizeSignatureText(option.name),
      toChoiceMinorUnits(option.price ?? 0),
      option.active !== false,
    ])
    .sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify({
    name: normalizeSignatureText(group.name),
    type: group.type === 'single' ? 'single' : 'multiple',
    required: group.required === true,
    list,
  });
}

function normalizeSignatureText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapDishOptions(optionGroupIds, optionMap) {
  const refs = [];
  const seen = new Set();
  for (const id of optionGroupIds || []) {
    const group = optionMap.get(id);
    if (!group) continue;
    if (seen.has(group.posID)) continue;
    seen.add(group.posID);
    refs.push({
      posID: group.posID,
      list: group.list.map((item) => ({ posID: item.posID })),
    });
  }
  return refs.length > 0 ? refs : undefined;
}

function toChoiceMinorUnits(value) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 100);
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && !(Array.isArray(entry) && entry.length === 0)),
  );
}
