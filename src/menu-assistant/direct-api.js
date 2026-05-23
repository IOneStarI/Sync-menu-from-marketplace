export async function executeDirectApiAction({ client, language, action, logger }) {
  switch (action.type) {
    case 'attach_modifier_group':
      return request(logger, 'PUT', `/menu/${language}/options/${action.id}/attach`, { dish: action.dishId }, () =>
        client.attachOptionToDish(language, action.id, action.dishId));
    case 'detach_modifier_group':
      return request(logger, 'PUT', `/menu/${language}/options/${action.id}/detach`, { dish: action.dishId }, () =>
        client.detachOptionFromDish(language, action.id, action.dishId));
    case 'update_cutlery':
      return request(logger, 'PUT', `/menu/${language}/cutlery`, cleanObject({
        show: action.show,
        showPersonNumber: action.showPersonNumber,
        requiredCutlery: action.requiredCutlery,
        posID: action.itemPosID || undefined,
        price: toMinorUnits(action.price),
      }), () => client.updateCutlery(language, cleanObject({
        show: action.show,
        showPersonNumber: action.showPersonNumber,
        requiredCutlery: action.requiredCutlery,
        posID: action.itemPosID || undefined,
        price: toMinorUnits(action.price),
      })));
    case 'create_pack':
      return request(logger, 'POST', `/menu/${language}/pack`, packPayload(action), () => client.createPack(language, packPayload(action)));
    case 'update_pack':
      return request(logger, 'PUT', `/menu/${language}/pack/${action.id}`, packPayload(action), () => client.updatePack(language, action.id, packPayload(action)));
    case 'delete_pack':
      return request(logger, 'DELETE', `/menu/${language}/pack/${action.id}`, undefined, () => client.deletePack(language, action.id));
    case 'sync_availability': {
      const availability = parseJsonField(action.availability);
      return request(logger, 'POST', `/menu/${language}/full/availability`, availability, () =>
        client.syncAvailability(language, availability, { skipMissing: action.skipMissing ?? true }));
    }
    case 'sync_marketplace_data': {
      const dishes = parseJsonField(action.marketplaceDishes);
      return request(logger, 'POST', `/menu/${language}/full/marketplace/data`, { dishes }, () =>
        client.syncMarketplaceData(language, { dishes }));
    }
    case 'get_marketplace_sync_status':
      return request(logger, 'GET', `/menu/${language}/full/marketplace/data/status/${action.id}`, undefined, () =>
        client.getMarketplaceDataStatus(language, action.id));
    case 'list_dish_labels':
      return request(logger, 'GET', `/menu/${language}/dish-labels/list`, undefined, () => client.listDishLabels(language));
    case 'get_section_info':
      return request(logger, 'GET', `/menu/${language}/section-info/${action.id}`, undefined, () => client.getSectionInfo(language, action.id));
    default:
      throw new Error(`Unsupported direct API action: ${action.type}`);
  }
}

function packPayload(action) {
  return cleanObject({
    name: action.packName,
    posID: action.itemPosID || undefined,
    price: toMinorUnits(action.price),
    categories: Array.isArray(action.options)
      ? action.options.map((option) => cleanObject({ _id: option.id, posID: option.name }))
      : [],
  });
}

async function request(logger, method, apiPath, payload, run) {
  await logger.write('choice.request', { method, path: apiPath, body: payload });
  const response = await run();
  await logger.write('choice.response', { method, path: apiPath, body: response ?? null });
  return response;
}

function parseJsonField(value) {
  if (typeof value !== 'string' || !value.trim()) return value ?? null;
  try { return JSON.parse(value); } catch { return null; }
}

function toMinorUnits(value) {
  if (value === null || value === undefined) return undefined;
  return Math.round(Number(value) * 100);
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null),
  );
}
