import { AppError } from '../errors.js';

const GATEWAY = 'https://gateway.shaketopay.com.ua';

export async function parseExpirenzaMenu(marketplaceUrl, { logger } = {}) {
  const { restaurantId, menuId } = parseExpirenzaUrl(marketplaceUrl);
  logger?.info?.(`Expirenza: restaurantId=${restaurantId}${menuId ? `, menuId=${menuId}` : ''}`);

  const session = await createSession();
  const data = await apiGet(session, `/api/clients/menu/menu/v2/${restaurantId}`);
  const result = data?.result;

  if (!result?.dishes?.length) {
    throw new AppError(`Expirenza API returned no dishes for ${restaurantId}`, 'EXPIRENZA_EMPTY');
  }

  const menus = result.menus || [];
  const allCategories = result.categories || [];
  const allDishes = result.dishes || [];

  const targetMenuIds = menuId
    ? new Set([menuId])
    : new Set(menus.map((m) => m.id));

  const categories = allCategories.filter((c) => targetMenuIds.has(c.menuId));
  const validCategoryIds = new Set(categories.map((c) => c.id));
  const dishes = allDishes.filter((d) => targetMenuIds.has(d.menuId) && validCategoryIds.has(d.categoryId));

  logger?.info?.(`Expirenza: ${categories.length} categories, ${dishes.length} dishes`);

  const sections = menus
    .filter((m) => targetMenuIds.has(m.id))
    .map((m) => ({
      id: String(m.id),
      name: m.name,
    }));

  return {
    sections,
    categories: categories.map((cat) => ({
      id: String(cat.id),
      name: cat.name,
      sectionId: String(cat.menuId),
      active: true,
    })),
    items: dishes.map((dish) => {
      const variant = dish.dishVariants?.[0];
      const price = variant?.price ?? dish.minPrice ?? 0;
      const soldOut = variant?.stopList === true || dish.active === false;
      return {
        id: String(dish.id),
        name: dish.title,
        description: dish.description || undefined,
        price,
        categoryId: String(dish.categoryId),
        imageUrl: dish.imageUrl || undefined,
        active: !soldOut,
        soldOut,
      };
    }),
    optionGroups: [],
  };
}

function parseExpirenzaUrl(input) {
  const url = new URL(input);
  const parts = url.pathname.split('/').filter(Boolean);
  const restaurantId = parts[0];
  if (!restaurantId) {
    throw new AppError(`Cannot extract restaurant ID from Expirenza URL: ${input}`, 'EXPIRENZA_INVALID_URL');
  }
  const menuId = url.searchParams.has('menuId') ? Number(url.searchParams.get('menuId')) : null;
  return { restaurantId, menuId };
}

async function createSession() {
  const resp = await fetch(`${GATEWAY}/api/sync`, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new AppError(`Expirenza sync failed: ${resp.status}`, 'EXPIRENZA_SYNC_ERROR');
  const { serverId, serverTime } = await resp.json();

  const clientKey = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverKeyBytes = base64urlToBytes(serverId);
  const serverKey = await crypto.subtle.importKey('raw', serverKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const sharedSecretBuf = await crypto.subtle.deriveBits({ name: 'ECDH', namedCurve: 'P-256', public: serverKey }, clientKey.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuf);
  const browserId = bytesToBase64url(await crypto.subtle.exportKey('raw', clientKey.publicKey));
  const timeShift = serverTime - Date.now();

  return { sharedSecret, browserId, timeShift };
}

async function apiGet(session, path) {
  const xTime = String(Date.now() + (Math.abs(session.timeShift) < 20 ? 0 : session.timeShift));
  const keyMaterial = await crypto.subtle.digest('SHA-256', new Uint8Array([
    ...session.sharedSecret,
    ...new TextEncoder().encode(path.split('?')[0]),
    ...new TextEncoder().encode(xTime),
  ]));
  const aesKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-CBC' }, false, ['decrypt']);

  const resp = await fetch(`${GATEWAY}${path}`, {
    headers: { 'x-browser-id': session.browserId, 'x-time': xTime, 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok && resp.status !== 400) {
    throw new AppError(`Expirenza API error: ${resp.status} ${path}`, 'EXPIRENZA_API_ERROR');
  }

  const buf = await resp.arrayBuffer();
  let decrypted;
  try {
    decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, aesKey, buf);
  } catch {
    throw new AppError(`Expirenza decryption failed for ${path}`, 'EXPIRENZA_DECRYPT_ERROR');
  }

  const json = JSON.parse(new TextDecoder().decode(decrypted));
  if (json.errCode || json.errText) {
    throw new AppError(`Expirenza API returned error: ${json.errText || json.errCode}`, 'EXPIRENZA_API_ERROR');
  }
  return json;
}

function base64urlToBytes(str) {
  return new Uint8Array(atob(str.replace(/-/g, '+').replace(/_/g, '/')).split('').map((c) => c.charCodeAt(0)));
}

function bytesToBase64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
