import { makePosId } from '../utils/pos-id.js';

export function normalizeFullMenu(value) {
  const data = value?.data && typeof value.data === 'object' ? value.data : value;
  return {
    sections: Array.isArray(data?.sections) ? structuredClone(data.sections) : [defaultSection()],
    categories: Array.isArray(data?.categories) ? structuredClone(data.categories) : [],
    dishOptions: Array.isArray(data?.dishOptions) ? structuredClone(data.dishOptions) : [],
    dishes: Array.isArray(data?.dishes) ? structuredClone(data.dishes) :
      Array.isArray(data?.menu) ? structuredClone(data.menu) : [],
  };
}

export function applyActionPlan(menu, plan) {
  const next = normalizeFullMenu(menu);
  const changes = [];

  for (const action of plan.actions) {
    switch (action.type) {
      case 'create_section':
        createSection(next, action, changes);
        break;
      case 'update_section':
        updateSection(next, action, changes);
        break;
      case 'delete_section':
        deleteSection(next, action, changes);
        break;
      case 'create_category':
        createCategory(next, action, changes);
        break;
      case 'update_category':
        updateCategory(next, action, changes);
        break;
      case 'delete_category':
        deleteCategory(next, action, changes);
        break;
      case 'create_item':
        createItem(next, action, changes);
        break;
      case 'update_item':
        updateItem(next, action, changes);
        break;
      case 'delete_item':
        deleteItem(next, action, changes);
        break;
      case 'set_item_active':
        updateItem(next, action, changes);
        break;
      case 'create_modifier_group':
        createModifierGroup(next, action, changes);
        break;
      case 'update_modifier_group':
        updateModifierGroup(next, action, changes);
        break;
      case 'delete_modifier_group':
        deleteModifierGroup(next, action, changes);
        break;
      case 'clarification':
        break;
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  pruneUnusedSections(next);
  return { menu: next, changes };
}

function defaultSection() {
  return { posID: 'section-main', name: 'Main menu', description: '' };
}

function ensureSection(menu, sectionName) {
  if (menu.sections.length === 0) menu.sections.push(defaultSection());
  if (!sectionName) return menu.sections[0];
  const existing = findByName(menu.sections, sectionName);
  if (existing) return existing;
  const section = { posID: uniquePosID(menu.sections, 'section', sectionName), name: sectionName, description: '' };
  menu.sections.push(section);
  return section;
}

function createSection(menu, action, changes) {
  if (findByName(menu.sections, action.sectionName)) {
    throw new Error(`Section already exists: ${action.sectionName}`);
  }
  const section = {
    posID: uniquePosID(menu.sections, 'section', action.sectionName),
    name: action.sectionName,
    description: action.description || '',
    active: action.active !== false,
  };
  menu.sections.push(section);
  changes.push({ type: action.type, target: section.name, posID: section.posID });
}

function updateSection(menu, action, changes) {
  const section = requireSection(menu, action);
  if (action.sectionName) section.name = action.sectionName;
  if (action.description !== null && action.description !== undefined && action.description !== '') {
    section.description = action.description;
  }
  if (action.active !== null && action.active !== undefined) section.active = action.active;
  changes.push({ type: action.type, target: section.name, posID: section.posID });
}

function deleteSection(menu, action, changes) {
  const section = requireSection(menu, action);
  const sectionPosID = section.posID;
  const removedCategoryPosIDs = new Set(
    menu.categories.filter((cat) => cat.sectionPosID === sectionPosID).map((cat) => cat.posID),
  );
  menu.dishes = menu.dishes.filter((dish) => !removedCategoryPosIDs.has(dish.categoryPosID));
  menu.categories = menu.categories.filter((cat) => cat.sectionPosID !== sectionPosID);
  menu.sections = menu.sections.filter((s) => s.posID !== sectionPosID);
  changes.push({ type: action.type, target: section.name, posID: sectionPosID });
}

function requireSection(menu, action) {
  const section = action.id
    ? menu.sections.find((s) => s.posID === action.id || s._id === action.id)
    : findByName(menu.sections, action.sectionName);
  if (!section) throw new Error(`Section not found: ${action.sectionName || action.id}`);
  return section;
}

function createCategory(menu, action, changes) {
  if (findByName(menu.categories, action.categoryName)) {
    throw new Error(`Category already exists: ${action.categoryName}`);
  }
  const section = ensureSection(menu, action.sectionName);
  const category = {
    posID: uniquePosID(menu.categories, 'category', action.categoryName),
    sectionPosID: section.posID,
    name: action.categoryName,
    active: action.active !== false,
  };
  menu.categories.push(category);
  changes.push({ type: action.type, target: category.name, posID: category.posID });
}

function updateCategory(menu, action, changes) {
  const category = requireCategory(menu, action);
  if (action.categoryName) category.name = action.categoryName;
  if (action.active !== null && action.active !== undefined) category.active = action.active;
  if (action.sectionName) category.sectionPosID = ensureSection(menu, action.sectionName).posID;
  changes.push({ type: action.type, target: category.name, posID: category.posID });
}

function deleteCategory(menu, action, changes) {
  const category = requireCategory(menu, action);
  const categoryPosID = category.posID;
  menu.dishes = menu.dishes.filter((dish) => dish.categoryPosID !== categoryPosID);
  menu.categories = menu.categories.filter((entry) => entry.posID !== categoryPosID);
  changes.push({ type: action.type, target: category.name, posID: categoryPosID });
}

function createItem(menu, action, changes) {
  if (findByName(menu.dishes, action.itemName)) {
    throw new Error(`Item already exists: ${action.itemName}`);
  }
  const category = findCategory(menu, action) || createImplicitCategory(menu, action);
  const dish = cleanObject({
    posID: uniquePosID(menu.dishes, 'dish', action.itemName),
    categoryPosID: category.posID,
    name: action.itemName,
    description: action.description || undefined,
    price: toMinorUnits(action.price),
    active: action.active !== false,
    attributes: action.active === false ? ['SOLD_OUT'] : undefined,
    media: action.imageUrl || undefined,
    translations: translationsToObject(action.translations),
  });
  menu.dishes.push(dish);
  changes.push({ type: action.type, target: dish.name, posID: dish.posID });
}

function updateItem(menu, action, changes) {
  const dish = requireDish(menu, action);
  if (action.itemName) dish.name = action.itemName;
  if (action.description) dish.description = action.description;
  if (action.price !== null && action.price !== undefined) dish.price = toMinorUnits(action.price);
  if (action.active !== null && action.active !== undefined) {
    dish.active = action.active;
    dish.attributes = action.active ? [] : ['SOLD_OUT'];
  }
  if (action.imageUrl) dish.media = action.imageUrl;
  if (action.categoryName || action.categoryPosID) dish.categoryPosID = requireCategory(menu, action).posID;
  const newTranslations = translationsToObject(action.translations);
  if (newTranslations) {
    dish.translations = { ...(dish.translations || {}), ...newTranslations };
  }
  changes.push({ type: action.type, target: dish.name, posID: dish.posID });
}

function deleteItem(menu, action, changes) {
  const dish = requireDish(menu, action);
  menu.dishes = menu.dishes.filter((entry) => entry.posID !== dish.posID);
  changes.push({ type: action.type, target: dish.name, posID: dish.posID });
}

function createModifierGroup(menu, action, changes) {
  if (findByName(menu.dishOptions, action.modifierGroupName)) {
    throw new Error(`Modifier group already exists: ${action.modifierGroupName}`);
  }
  const section = ensureSection(menu, action.sectionName);
  const group = {
    posID: uniquePosID(menu.dishOptions, 'option', action.modifierGroupName),
    sectionPosID: section.posID,
    active: action.active !== false,
    type: 'multiple',
    name: action.modifierGroupName,
    list: action.options.map((option) => cleanObject({
      posID: uniquePosID([], 'option-item', `${action.modifierGroupName}-${option.name}`),
      name: option.name,
      price: toMinorUnits(option.price || 0),
      active: option.active !== false,
    })),
  };
  menu.dishOptions.push(group);
  changes.push({ type: action.type, target: group.name, posID: group.posID });
}

function updateModifierGroup(menu, action, changes) {
  const group = requireModifierGroup(menu, action);
  if (action.modifierGroupName) group.name = action.modifierGroupName;
  if (action.active !== null && action.active !== undefined) group.active = action.active;
  if (Array.isArray(action.options) && action.options.length > 0) {
    group.list = action.options.map((option) => cleanObject({
      posID: uniquePosID(group.list || [], 'option-item', `${group.name}-${option.name}`),
      name: option.name,
      price: toMinorUnits(option.price || 0),
      active: option.active !== false,
    }));
  }
  changes.push({ type: action.type, target: group.name, posID: group.posID });
}

function deleteModifierGroup(menu, action, changes) {
  const group = requireModifierGroup(menu, action);
  menu.dishOptions = menu.dishOptions.filter((entry) => entry.posID !== group.posID);
  for (const dish of menu.dishes) {
    dish.dishOptions = (dish.dishOptions || []).filter((entry) => entry.posID !== group.posID);
    if (dish.dishOptions.length === 0) delete dish.dishOptions;
  }
  changes.push({ type: action.type, target: group.name, posID: group.posID });
}

function createImplicitCategory(menu, action) {
  if (!action.categoryName && !action.categoryPosID) {
    if (menu.categories.length > 0) return menu.categories[0];
    const categoryName = 'Menu';
    createCategory(menu, { ...action, categoryName }, []);
    return menu.categories[0];
  }
  createCategory(menu, { ...action, categoryName: action.categoryName || 'Menu' }, []);
  return findCategory(menu, action);
}

function requireCategory(menu, action) {
  const category = findCategory(menu, action);
  if (!category) throw new Error(`Category not found: ${action.categoryName || action.categoryPosID}`);
  return category;
}

function findCategory(menu, action) {
  if (action.categoryPosID) return menu.categories.find((entry) => entry.posID === action.categoryPosID);
  return findByName(menu.categories, action.categoryName);
}

function requireDish(menu, action) {
  const dish = action.itemPosID
    ? menu.dishes.find((entry) => entry.posID === action.itemPosID)
    : findByName(menu.dishes, action.itemName);
  if (!dish) throw new Error(`Item not found: ${action.itemName || action.itemPosID}`);
  return dish;
}

function requireModifierGroup(menu, action) {
  const group = action.modifierGroupPosID
    ? menu.dishOptions.find((entry) => entry.posID === action.modifierGroupPosID)
    : findByName(menu.dishOptions, action.modifierGroupName);
  if (!group) throw new Error(`Modifier group not found: ${action.modifierGroupName || action.modifierGroupPosID}`);
  return group;
}

function findByName(list, name) {
  if (!name) return undefined;
  const normalized = normalizeName(name);
  return list.find((entry) => normalizeName(entry.name) === normalized);
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function uniquePosID(list, prefix, name) {
  const base = makePosId(prefix, name);
  const existing = new Set(list.map((entry) => entry.posID));
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function toMinorUnits(value) {
  if (value === null || value === undefined) return undefined;
  return Math.round(Number(value) * 100);
}

function pruneUnusedSections(menu) {
  const used = new Set(menu.categories.map((category) => category.sectionPosID).filter(Boolean));
  if (used.size === 0) return;
  menu.sections = menu.sections.filter((section) => used.has(section.posID));
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && !(Array.isArray(entry) && entry.length === 0)),
  );
}

function translationsToObject(value) {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return Object.fromEntries(value.map(({ language, name, description }) => [language, { name, description }]));
}
