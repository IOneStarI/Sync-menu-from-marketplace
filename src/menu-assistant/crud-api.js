export async function executeCrudAction({ client, language, menu, action, logger }) {
  const ctx = { client, language, menu, logger };
  switch (action.type) {
    case 'create_section': return createSection(ctx, action);
    case 'update_section': return updateSection(ctx, action);
    case 'delete_section': return deleteSection(ctx, action);
    case 'create_category': return createCategory(ctx, action);
    case 'update_category': return updateCategory(ctx, action);
    case 'delete_category': return deleteCategory(ctx, action);
    case 'create_item': return createItem(ctx, action);
    case 'update_item':
    case 'set_item_active': return updateItem(ctx, action);
    case 'delete_item': return deleteItem(ctx, action);
    case 'create_modifier_group': return createModifierGroup(ctx, action);
    case 'update_modifier_group': return updateModifierGroup(ctx, action);
    case 'delete_modifier_group': return deleteModifierGroup(ctx, action);
    case 'clarification': return { type: 'clarification', target: '' };
    default: throw new Error(`Unsupported CRUD action: ${action.type}`);
  }
}

// --- Sections ---

async function createSection({ client, language, menu, logger }, action) {
  const payload = clean({
    name: action.sectionName,
    description: action.description || undefined,
    active: action.active !== false,
  });
  const result = await apiCall(logger, 'POST', `/menu/${language}/sections`, payload,
    () => client.createSection(language, payload));
  if (result?._id) menu.sections.push({ _id: result._id, name: payload.name, posID: result.posID });
  return { type: action.type, target: payload.name };
}

async function updateSection({ client, language, menu, logger }, action) {
  const section = requireSection(menu, action);
  const payload = clean({
    name: action.sectionName || section.name,
    description: action.description !== undefined && action.description !== null ? action.description : section.description,
    active: action.active !== null && action.active !== undefined ? action.active : section.active,
  });
  await apiCall(logger, 'PUT', `/menu/${language}/sections/${section._id}`, payload,
    () => client.updateSection(language, section._id, payload));
  Object.assign(section, payload);
  return { type: action.type, target: section.name };
}

async function deleteSection({ client, language, menu, logger }, action) {
  const section = requireSection(menu, action);
  await apiCall(logger, 'DELETE', `/menu/${language}/sections/${section._id}`, undefined,
    () => client.deleteSection(language, section._id));
  menu.categories = menu.categories.filter((c) => c.section !== section._id);
  menu.sections = menu.sections.filter((s) => s._id !== section._id);
  return { type: action.type, target: section.name };
}

// --- Categories ---

async function createCategory({ client, language, menu, logger }, action) {
  const section = await ensureSection({ client, language, menu, logger }, action);
  const payload = clean({
    name: action.categoryName,
    section: section._id,
    description: action.description || undefined,
    active: action.active !== false,
    posID: action.categoryPosID || undefined,
  });
  const result = await apiCall(logger, 'POST', `/menu/${language}/categories`, payload,
    () => client.createCategory(language, payload));
  if (result?._id) menu.categories.push({ _id: result._id, name: payload.name, section: section._id, posID: payload.posID });
  return { type: action.type, target: payload.name };
}

async function updateCategory({ client, language, menu, logger }, action) {
  const category = requireCategory(menu, action);
  const payload = clean({
    name: action.categoryName || category.name,
    active: action.active !== null && action.active !== undefined ? action.active : category.active,
    posID: action.categoryPosID || category.posID || undefined,
  });
  await apiCall(logger, 'PUT', `/menu/${language}/categories/${category._id}`, payload,
    () => client.updateCategory(language, category._id, payload));
  Object.assign(category, payload);
  return { type: action.type, target: category.name };
}

async function deleteCategory({ client, language, menu, logger }, action) {
  const category = requireCategory(menu, action);
  await apiCall(logger, 'DELETE', `/menu/${language}/categories/${category._id}`, undefined,
    () => client.deleteCategory(language, category._id));
  menu.dishes = menu.dishes.filter((d) => d.category !== category._id);
  menu.categories = menu.categories.filter((c) => c._id !== category._id);
  return { type: action.type, target: category.name };
}

// --- Dishes ---

async function createItem({ client, language, menu, logger }, action) {
  const category = await ensureCategory({ client, language, menu, logger }, action);
  const payload = clean({
    name: action.itemName,
    category: category._id,
    price: toMinor(action.price ?? 0),
    description: action.description || undefined,
    active: action.active !== false,
    attributes: action.active === false ? ['SOLD_OUT'] : undefined,
    posID: action.itemPosID || undefined,
    media: action.imageUrl || undefined,
  });
  const result = await apiCall(logger, 'POST', `/menu/${language}/dishes`, payload,
    () => client.createDish(language, payload));
  if (result?._id) menu.dishes.push({ _id: result._id, name: payload.name, category: category._id, posID: payload.posID });
  return { type: action.type, target: payload.name };
}

async function updateItem({ client, language, menu, logger }, action) {
  const dish = requireDish(menu, action);
  const payload = {};

  // name is always required by the API; use new name if provided, otherwise keep current
  payload.name = (action.itemName && action.itemName !== dish.name) ? action.itemName : dish.name;

  // If the AI put name/description inside translations instead of top-level fields, extract them
  const primaryTranslation = Array.isArray(action.translations) && action.translations.length > 0
    ? (action.translations.find((t) => t.language === 'en') || action.translations[0])
    : null;

  const effectiveDescription = present(action.description)
    ? action.description
    : (primaryTranslation && present(primaryTranslation.description) ? primaryTranslation.description : null);

  if (effectiveDescription !== null) payload.description = effectiveDescription;

  // If translations contained a new name (and action.itemName was the lookup key), apply it
  if (primaryTranslation && present(primaryTranslation.name) && primaryTranslation.name !== dish.name) {
    payload.name = primaryTranslation.name;
  }
  if (action.price !== null && action.price !== undefined) payload.price = toMinor(action.price);
  if (action.active !== null && action.active !== undefined) {
    payload.active = action.active;
    payload.attributes = action.active === false ? ['SOLD_OUT'] : [];
  }
  if (action.imageUrl) payload.media = action.imageUrl;
  if (action.itemPosID) payload.posID = action.itemPosID;

  // Translations: AI may put name/description updates here for multi-language support
  if (Array.isArray(action.translations) && action.translations.length > 0) {
    payload.translations = translationsToObject(action.translations);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error(`No fields to update for dish "${dish.name}".`);
  }

  await apiCall(logger, 'PATCH', `/menu/${language}/dishes/${dish._id}`, payload,
    () => client.patchDish(language, dish._id, payload));
  Object.assign(dish, payload);
  return { type: action.type, target: dish.name };
}

async function deleteItem({ client, language, menu, logger }, action) {
  const dish = requireDish(menu, action);
  await apiCall(logger, 'DELETE', `/menu/${language}/dishes/${dish._id}`, undefined,
    () => client.deleteDish(language, dish._id));
  menu.dishes = menu.dishes.filter((d) => d._id !== dish._id);
  return { type: action.type, target: dish.name };
}

// --- Modifier groups ---

async function createModifierGroup({ client, language, menu, logger }, action) {
  const section = await ensureSection({ client, language, menu, logger }, action);
  const payload = clean({
    name: action.modifierGroupName,
    type: 'multiple',
    section: section._id,
    active: action.active !== false,
    posID: action.modifierGroupPosID || undefined,
    optionList: Array.isArray(action.options)
      ? action.options.map((opt) => clean({ name: opt.name, price: toMinor(opt.price ?? 0), active: opt.active !== false }))
      : [],
  });
  const result = await apiCall(logger, 'POST', `/menu/${language}/options`, payload,
    () => client.createOption(language, payload));
  if (result?._id) menu.dishOptions = [...(menu.dishOptions || []), { _id: result._id, name: payload.name, section: section._id }];
  return { type: action.type, target: payload.name };
}

async function updateModifierGroup({ client, language, menu, logger }, action) {
  const optionId = findOptionId(menu, action);
  const existing = await apiCall(logger, 'GET', `/menu/${language}/options/${optionId}`, undefined,
    () => client.getOptionById(language, optionId));
  const payload = clean({
    name: action.modifierGroupName || existing.name,
    type: existing.type || 'multiple',
    section: existing.section,
    active: action.active !== null && action.active !== undefined ? action.active : existing.active,
    optionList: Array.isArray(action.options) && action.options.length > 0
      ? action.options.map((opt) => clean({ name: opt.name, price: toMinor(opt.price ?? 0), active: opt.active !== false }))
      : existing.optionList,
  });
  await apiCall(logger, 'PUT', `/menu/${language}/options/${optionId}`, payload,
    () => client.updateOption(language, optionId, payload));
  return { type: action.type, target: payload.name };
}

async function deleteModifierGroup({ client, language, menu, logger }, action) {
  const optionId = findOptionId(menu, action);
  await apiCall(logger, 'DELETE', `/menu/${language}/options/${optionId}`, undefined,
    () => client.deleteOption(language, optionId));
  return { type: action.type, target: action.modifierGroupName || optionId };
}

// --- Helpers ---

async function ensureSection({ client, language, menu, logger }, action) {
  if (action.sectionName) {
    const found = byName(menu.sections, action.sectionName);
    if (found) return found;
  }
  if (menu.sections.length > 0) return menu.sections[0];
  const payload = { name: 'Main menu', active: true };
  const result = await apiCall(logger, 'POST', `/menu/${language}/sections`, payload,
    () => client.createSection(language, payload));
  const section = { _id: result._id, name: payload.name };
  menu.sections.push(section);
  return section;
}

async function ensureCategory({ client, language, menu, logger }, action) {
  const found = findCategoryByAction(menu, action);
  if (found) return found;
  if (!action.categoryName && menu.categories.length > 0) return menu.categories[0];
  const section = await ensureSection({ client, language, menu, logger }, action);
  const catName = action.categoryName || 'Menu';
  const payload = { name: catName, section: section._id, active: true };
  const result = await apiCall(logger, 'POST', `/menu/${language}/categories`, payload,
    () => client.createCategory(language, payload));
  const category = { _id: result._id, name: catName, section: section._id };
  menu.categories.push(category);
  return category;
}

function requireSection(menu, action) {
  const s = action.id
    ? menu.sections.find((x) => x._id === action.id || x.posID === action.id)
    : byName(menu.sections, action.sectionName);
  if (!s) throw new Error(`Section not found: ${action.sectionName || action.id}`);
  return s;
}

function requireCategory(menu, action) {
  const c = findCategoryByAction(menu, action);
  if (!c) throw new Error(`Category not found: ${action.categoryName || action.categoryPosID}`);
  return c;
}

function findCategoryByAction(menu, action) {
  if (action.categoryPosID) return menu.categories.find((c) => c.posID === action.categoryPosID);
  if (action.categoryName) return byName(menu.categories, action.categoryName);
  return null;
}

function requireDish(menu, action) {
  if (action.itemPosID) {
    const d = menu.dishes.find((x) => x.posID === action.itemPosID);
    if (!d) throw new Error(`Dish not found: ${action.itemPosID}`);
    return d;
  }
  const n = String(action.itemName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const matches = menu.dishes.filter((x) => String(x.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === n);
  if (matches.length === 0) throw new Error(`Dish not found: ${action.itemName}`);
  if (matches.length === 1) return matches[0];
  const paths = matches.map((d) => {
    const cat = menu.categories.find((c) => c._id === d.category);
    const sec = cat ? menu.sections.find((s) => s._id === cat.section) : null;
    const path = [sec?.name, cat?.name].filter(Boolean).join(' > ');
    return `• ${path ? `${path} > ` : ''}${d.name} (posID: ${d.posID || d._id})`;
  });
  throw new Error(
    `Multiple dishes named "${action.itemName}" found. Specify which one by posID or location:\n${paths.join('\n')}`,
  );
}

function findOptionId(menu, action) {
  if (action.modifierGroupPosID) {
    const opt = (menu.dishOptions || []).find((o) => o.posID === action.modifierGroupPosID);
    if (opt) return opt._id;
  }
  if (action.modifierGroupName) {
    const allOptions = collectOptions(menu);
    const opt = byName(allOptions, action.modifierGroupName);
    if (opt) return opt._id;
  }
  throw new Error(`Modifier group not found: ${action.modifierGroupName || action.modifierGroupPosID}`);
}

function collectOptions(menu) {
  const seen = new Map();
  for (const dish of menu.dishes || []) {
    for (const opt of dish.menuOptions || []) {
      if (opt._id && !seen.has(opt._id)) seen.set(opt._id, opt);
    }
  }
  for (const opt of menu.dishOptions || []) {
    if (opt._id && !seen.has(opt._id)) seen.set(opt._id, opt);
  }
  return [...seen.values()];
}

function byName(list, name) {
  if (!name) return undefined;
  const n = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
  return list.find((item) => String(item.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === n);
}

function toMinor(value) {
  if (value === null || value === undefined) return 0;
  return Math.round(Number(value) * 100);
}

function present(value) {
  return value !== null && value !== undefined && value !== '';
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));
}

function translationsToObject(array) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  return Object.fromEntries(
    array.map(({ language, name, description }) => [language, clean({ name, description })]),
  );
}

async function apiCall(logger, method, apiPath, payload, run) {
  await logger.write('choice.request', { method, path: apiPath, body: payload });
  const result = await run();
  await logger.write('choice.response', { method, path: apiPath, body: result ?? null });
  return result;
}
