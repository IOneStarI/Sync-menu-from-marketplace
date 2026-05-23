import { readLocalEnv } from '../config.js';
import { choiceMenuCapabilities } from './capabilities.js';

const actionTypes = [
  'create_section',
  'update_section',
  'delete_section',
  'create_category',
  'update_category',
  'delete_category',
  'create_item',
  'update_item',
  'delete_item',
  'set_item_active',
  'create_modifier_group',
  'update_modifier_group',
  'delete_modifier_group',
  'attach_modifier_group',
  'detach_modifier_group',
  'update_cutlery',
  'create_pack',
  'update_pack',
  'delete_pack',
  'sync_availability',
  'sync_marketplace_data',
  'get_marketplace_sync_status',
  'list_dish_labels',
  'get_section_info',
  'clarification',
];

const destructiveTypes = new Set(['delete_section', 'delete_category', 'delete_item', 'delete_modifier_group', 'delete_pack']);
const directApiTypes = new Set([
  'attach_modifier_group',
  'detach_modifier_group',
  'update_cutlery',
  'create_pack',
  'update_pack',
  'delete_pack',
  'sync_availability',
  'sync_marketplace_data',
  'get_marketplace_sync_status',
  'list_dish_labels',
  'get_section_info',
]);

export function isDestructiveAction(action) {
  return destructiveTypes.has(action?.type);
}

export function isDirectApiAction(action) {
  return directApiTypes.has(action?.type);
}

export function validateActionPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') {
    return { ok: false, errors: ['Plan must be an object.'] };
  }

  if (!Array.isArray(plan.actions)) {
    errors.push('Plan actions must be an array.');
  } else {
    plan.actions.forEach((action, index) => validateAction(action, index, errors));
  }

  if (plan.clarificationRequired && !plan.clarificationQuestion) {
    errors.push('clarificationQuestion is required when clarificationRequired is true.');
  }

  return { ok: errors.length === 0, errors };
}

function validateAction(action, index, errors) {
  const path = `actions[${index}]`;
  if (!action || typeof action !== 'object') {
    errors.push(`${path} must be an object.`);
    return;
  }

  if (!actionTypes.includes(action.type)) {
    errors.push(`${path}.type is unsupported: ${action.type}`);
    return;
  }

  if (action.type === 'clarification') return;

  if (action.type === 'create_section' && !action.sectionName) {
    errors.push(`${path}.sectionName is required.`);
  }

  if (['update_section', 'delete_section'].includes(action.type) && !hasAny(action, ['sectionName', 'id'])) {
    errors.push(`${path} requires sectionName or id.`);
  }

  if (['attach_modifier_group', 'detach_modifier_group'].includes(action.type) && (!action.id || !action.dishId)) {
    errors.push(`${path} requires id (option _id) and dishId (dish _id).`);
  }

  if (['update_category', 'delete_category'].includes(action.type) && !hasAny(action, ['categoryName', 'categoryPosID'])) {
    errors.push(`${path} requires categoryName or categoryPosID.`);
  }

  if (['update_item', 'delete_item', 'set_item_active'].includes(action.type) && !hasAny(action, ['itemName', 'itemPosID'])) {
    errors.push(`${path} requires itemName or itemPosID.`);
  }

  if (['update_modifier_group', 'delete_modifier_group'].includes(action.type) && !hasAny(action, ['modifierGroupName', 'modifierGroupPosID'])) {
    errors.push(`${path} requires modifierGroupName or modifierGroupPosID.`);
  }

  if (['update_pack', 'delete_pack', 'get_marketplace_sync_status', 'get_section_info'].includes(action.type) && !action.id) {
    errors.push(`${path}.id is required.`);
  }

  if (action.type === 'create_category' && !action.categoryName) {
    errors.push(`${path}.categoryName is required.`);
  }

  if (action.type === 'create_item') {
    if (!action.itemName) errors.push(`${path}.itemName is required.`);
    if (action.price === undefined) errors.push(`${path}.price is required.`);
  }

  if (action.type === 'create_modifier_group') {
    if (!action.modifierGroupName) errors.push(`${path}.modifierGroupName is required.`);
    if (!Array.isArray(action.options) || action.options.length === 0) {
      errors.push(`${path}.options must contain at least one option.`);
    }
  }

  if (action.type === 'update_cutlery' && action.show === null && action.showPersonNumber === null && action.requiredCutlery === null && action.price === null) {
    errors.push(`${path} requires at least one cutlery field.`);
  }

  if (['create_pack', 'update_pack'].includes(action.type) && !action.packName) {
    errors.push(`${path}.packName is required.`);
  }

  if (action.type === 'sync_availability' && !action.availability) {
    errors.push(`${path}.availability is required.`);
  }

  if (action.type === 'sync_marketplace_data' && !action.marketplaceDishes) {
    errors.push(`${path}.marketplaceDishes is required.`);
  }

  if (action.price !== undefined && action.price !== null && !isFiniteNumber(action.price)) {
    errors.push(`${path}.price must be a number in major currency units.`);
  }
}

function hasAny(value, keys) {
  return keys.some((key) => typeof value[key] === 'string' && value[key].trim());
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function parseMenuInstructionsWithAI(text) {
  const env = getOpenAIEnv();
  if (!env.apiKey) {
    return {
      clarificationRequired: true,
      clarificationQuestion: 'OPENAI_API_KEY is not configured. Add it to .env or Render environment variables.',
      actions: [{ type: 'clarification', reason: 'missing_openai_api_key' }],
    };
  }

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
            'You convert plain-language restaurant menu instructions into a strict ChoiceQR menu action plan.',
            `Known Choice menu API capabilities: ${choiceMenuCapabilities.join('; ')}.`,
            'Use only supported action types from the schema.',
            'Prices are major currency units, for example 220 UAH is 220.',
            'If an instruction is ambiguous, unsafe, or lacks the target item/category, return clarificationRequired true and do not include dangerous actions.',
            'CRITICAL: For update_item, always put the new value directly into the top-level action field. "Change description to X" → description: "X". "Change price to 150" → price: 150. "Rename to Y" → itemName: "Y". Never route these through the translations array.',
            'Use the translations array ONLY when the user explicitly requests a translation into a specific language code like "uk" or "de". For English or default-language changes, use the direct fields.',
            'For broad translation requests, create update_item actions only when specific target text is provided; otherwise ask for clarification.',
            'For images, only set imageUrl/media when the user provides a direct URL.',
            'For availability, encode the payload as a JSON string in the availability field.',
            'For marketplaceDishes, encode the array as a JSON string in the marketplaceDishes field.',
            'When creating a dish without a specified category, leave categoryName and categoryPosID empty — the system places it in the first available category automatically. Do not ask for clarification about section or category unless the user explicitly names one.',
            'Use create_section/update_section/delete_section for menu section (tab) management.',
            'Use update_cutlery for cutlery settings.',
            'Use sync_availability for active/inactive or area availability changes when the user gives posIDs.',
            'Use sync_marketplace_data for marketplace-specific names/prices when the user gives dish posIDs and marketplace names.',
            'Use attach_modifier_group/detach_modifier_group only when the user provides both the option MongoDB _id (id field) and the dish MongoDB _id (dishId field).',
            'For update_item, delete_item, and set_item_active: if the user gives a dish name (no posID), set itemName and leave itemPosID empty — do NOT ask for clarification. The system will find the dish by name and ask the user to specify if there are multiple matches.',
          ].join(' '),
        },
        { role: 'user', content: text },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'choice_menu_action_plan',
          strict: true,
          schema: actionPlanSchema(),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI action planning failed: ${response.status} ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  const outputText = data.output_text || data.output?.flatMap((item) => item.content || [])
    .find((content) => content.type === 'output_text')?.text;
  return JSON.parse(outputText || '{}');
}

function getOpenAIEnv() {
  const env = { ...readLocalEnv(), ...process.env };
  return {
    apiKey: String(env.OPENAI_API_KEY || '').trim(),
    model: String(env.OPENAI_MODEL || 'gpt-5.4-mini').trim(),
  };
}

function actionPlanSchema() {
  const action = {
    type: 'object',
    additionalProperties: false,
    required: [
      'type',
      'reason',
      'categoryName',
      'categoryPosID',
      'itemName',
      'itemPosID',
      'modifierGroupName',
      'modifierGroupPosID',
      'id',
      'dishId',
      'packName',
      'sectionName',
      'price',
      'description',
      'active',
      'show',
      'showPersonNumber',
      'requiredCutlery',
      'imageUrl',
      'translations',
      'options',
      'availability',
      'marketplaceDishes',
      'skipMissing',
    ],
    properties: {
      type: { type: 'string', enum: actionTypes },
      reason: { type: 'string' },
      categoryName: { type: 'string' },
      categoryPosID: { type: 'string' },
      itemName: { type: 'string' },
      itemPosID: { type: 'string' },
      modifierGroupName: { type: 'string' },
      modifierGroupPosID: { type: 'string' },
      id: { type: 'string' },
      dishId: { type: 'string' },
      packName: { type: 'string' },
      sectionName: { type: 'string' },
      price: { type: ['number', 'null'] },
      description: { type: 'string' },
      active: { type: ['boolean', 'null'] },
      show: { type: ['boolean', 'null'] },
      showPersonNumber: { type: ['boolean', 'null'] },
      requiredCutlery: { type: ['boolean', 'null'] },
      imageUrl: { type: 'string' },
      translations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['language', 'name', 'description'],
          properties: {
            language: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      options: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'price', 'active'],
          properties: {
            name: { type: 'string' },
            price: { type: ['number', 'null'] },
            active: { type: ['boolean', 'null'] },
          },
        },
      },
      availability: { type: ['string', 'null'] },
      marketplaceDishes: { type: ['string', 'null'] },
      skipMissing: { type: ['boolean', 'null'] },
    },
  };

  return {
    type: 'object',
    additionalProperties: false,
    required: ['clarificationRequired', 'clarificationQuestion', 'actions'],
    properties: {
      clarificationRequired: { type: 'boolean' },
      clarificationQuestion: { type: 'string' },
      actions: {
        type: 'array',
        items: action,
      },
    },
  };
}
