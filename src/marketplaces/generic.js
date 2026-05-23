import { AppError } from '../errors.js';
import { USER_AGENT } from '../constants.js';
import { readLocalEnv } from '../config.js';

export async function parseGenericMenu(marketplaceUrl, { logger } = {}) {
  const response = await fetch(marketplaceUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new AppError(`Failed to fetch page: HTTP ${response.status}`, 'GENERIC_FETCH_ERROR');
  }

  const html = await response.text();

  const structured = trySchemaOrgMenu(html);
  if (structured && structured.categories.length > 0 && structured.items.length > 0) {
    logger?.info?.(`Schema.org: extracted ${structured.categories.length} categories, ${structured.items.length} items`);
    return structured;
  }

  const env = getOpenAIEnv();
  if (!env.apiKey) {
    throw new AppError(
      'No structured menu data found on this page and OPENAI_API_KEY is not configured for AI extraction.',
      'GENERIC_NO_AI_KEY',
    );
  }

  const content = buildAiContent(html);
  logger?.info?.('Sending page content to AI for menu extraction');

  const extracted = await callOpenAI(content, marketplaceUrl, env);

  if (!extracted.isMenu) {
    throw new AppError(
      `This page does not appear to contain a restaurant menu: ${marketplaceUrl}`,
      'GENERIC_NOT_A_MENU',
    );
  }

  const categories = (extracted.categories || []).filter((c) => c.id && c.name);
  const items = (extracted.items || []).filter((item) => item.id && item.name && item.categoryId);

  if (categories.length === 0 || items.length === 0) {
    throw new AppError(
      `AI could not extract menu items from: ${marketplaceUrl}`,
      'GENERIC_EMPTY_MENU',
    );
  }

  logger?.info?.(`AI extracted ${categories.length} categories, ${items.length} items`);

  return {
    sections: [],
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      active: true,
    })),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || undefined,
      price: item.price,
      categoryId: item.categoryId,
      active: true,
    })),
    optionGroups: [],
  };
}

function trySchemaOrgMenu(html) {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const data = JSON.parse(script[1]);
      const menu = extractFromSchemaOrg(Array.isArray(data['@graph']) ? data['@graph'] : [data]);
      if (menu) return menu;
    } catch {
      // keep trying other scripts
    }
  }
  return null;
}

function extractFromSchemaOrg(nodes) {
  for (const node of nodes) {
    const types = [].concat(node['@type'] || []);
    const restaurantTypes = ['Restaurant', 'FoodEstablishment', 'FastFoodRestaurant', 'BarOrPub', 'CafeOrCoffeeShop', 'Bakery', 'FoodTruck'];

    if (types.includes('Menu')) {
      return normalizeSchemaOrgMenu(node);
    }

    if (types.some((t) => restaurantTypes.includes(t))) {
      const menuRef = node.hasMenu;
      if (menuRef) {
        const menuNode = Array.isArray(menuRef) ? menuRef[0] : menuRef;
        const result = normalizeSchemaOrgMenu(menuNode);
        if (result) return result;
      }
    }
  }
  return null;
}

function normalizeSchemaOrgMenu(menuNode) {
  if (!menuNode) return null;
  const sections = [].concat(menuNode.hasMenuSection || []);
  const categories = [];
  const items = [];

  for (const section of sections) {
    const catId = `cat-${categories.length}`;
    const catName = section.name || `Category ${categories.length + 1}`;
    categories.push({ id: catId, name: catName, active: true });

    for (const entry of [].concat(section.hasMenuItem || [])) {
      const price = parseSchemaOrgPrice(entry.offers);
      if (price === undefined) continue;
      items.push({
        id: `item-${items.length}`,
        name: entry.name || `Item ${items.length + 1}`,
        description: entry.description || undefined,
        price,
        categoryId: catId,
        active: true,
      });
    }
  }

  return categories.length > 0 && items.length > 0 ? { sections: [], categories, items, optionGroups: [] } : null;
}

function parseSchemaOrgPrice(offers) {
  if (!offers) return undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const raw = offer?.price ?? offer?.priceRange;
  if (raw === undefined || raw === null) return undefined;
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) ? num : undefined;
}

function buildAiContent(html) {
  const ldJson = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .join('\n');

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [ldJson, text].filter(Boolean).join('\n\n').slice(0, 16_000);
}

async function callOpenAI(content, url, env) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.model,
      input: [
        {
          role: 'system',
          content: [
            'You extract restaurant menu data from web page content.',
            'If the page contains a restaurant menu, set isMenu to true and extract all categories and items.',
            'If the page is not a restaurant menu page, set isMenu to false and return empty arrays.',
            'Prices must be in decimal major units (e.g. 12.50 for $12.50 or €12.50). Use 0 if price is unavailable.',
            'Each item must reference a valid category by categoryId.',
            'Use short unique IDs like "cat-1", "item-1".',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Extract the menu from this page (URL: ${url}):\n\n${content}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'extracted_menu',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['isMenu', 'categories', 'items'],
            properties: {
              isMenu: { type: 'boolean' },
              categories: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'name'],
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'name', 'description', 'price', 'categoryId'],
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                    price: { type: 'number' },
                    categoryId: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(
      `AI menu extraction failed: ${response.status} ${text.slice(0, 200)}`,
      'GENERIC_AI_ERROR',
    );
  }

  const data = await response.json();
  const outputText = data.output_text
    || data.output?.flatMap((item) => item.content || []).find((c) => c.type === 'output_text')?.text;

  return JSON.parse(outputText || '{}');
}

function getOpenAIEnv() {
  const env = { ...readLocalEnv(), ...process.env };
  return {
    apiKey: String(env.OPENAI_API_KEY || '').trim(),
    model: String(env.OPENAI_MODEL || 'gpt-4.1-mini').trim(),
  };
}
