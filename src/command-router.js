import { readLocalEnv } from './config.js';

const supportedActions = ['sync_menu', 'clear_menu', 'ai_menu_command', 'unknown'];

export function extractUrls(value) {
  const matches = String(value || '').match(/https?:\/\/[^\s,]+/gi);
  return matches ? matches.map((url) => url.replace(/[).,\]]+$/, '')) : [];
}

export function interpretCommandLocally(prompt) {
  const text = String(prompt || '').trim();
  const normalized = text.toLowerCase();
  const urls = extractUrls(text);
  const wantsClear = /\b(clear|delete|remove|empty|wipe)\b/.test(normalized)
    && !/\b(do not|don't|dont|without|except)\b[\s\S]{0,20}\b(clear|delete|remove|empty|wipe)\b/.test(normalized);
  const actions = [];

  if (wantsClear) {
    actions.push({
      type: 'clear_menu',
      urls: [],
      instructions: text,
      confidence: 0.95,
    });
  }

  if (urls.length > 0) {
    actions.push({
      type: 'sync_menu',
      urls,
      instructions: text,
      confidence: 0.98,
    });
  }

  if (actions.length > 0) {
    return { source: 'local', actions };
  }

  return {
    source: 'local',
    actions: [
      {
        type: 'unknown',
        urls: [],
        instructions: text,
        confidence: 0,
      },
    ],
  };
}

export async function interpretCommand(prompt) {
  const local = interpretCommandLocally(prompt);
  const env = getOpenAIEnv();
  if (!env.apiKey) {
    return {
      ...local,
      parserError: 'OPENAI_API_KEY is not configured. Used local command parser.',
    };
  }

  try {
    const ai = await interpretCommandWithOpenAI(prompt, env);
    if (ai.actions.length > 0 && !ai.actions.some((action) => action.type === 'unknown')) {
      return ai;
    }
    return {
      ...local,
      parserError: 'OpenAI returned unknown command. Used local command parser.',
    };
  } catch (error) {
    return {
      ...local,
      parserError: `${error.message} Used local command parser.`,
    };
  }
}

function getOpenAIEnv() {
  const env = { ...readLocalEnv(), ...process.env };
  return {
    apiKey: String(env.OPENAI_API_KEY || '').trim(),
    model: String(env.OPENAI_MODEL || 'gpt-5.4-mini').trim(),
  };
}

async function interpretCommandWithOpenAI(prompt, env) {
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
            'You classify commands for a restaurant menu management tool.',
            'Return JSON only through the schema.',
            'Supported action types are sync_menu, clear_menu, ai_menu_command, and unknown.',
            'Use sync_menu when the user asks to import, sync, copy, or process marketplace menu URLs.',
            'Use clear_menu when the user asks to clear, empty, delete, remove, or wipe the entire Choice menu.',
            'Use ai_menu_command when the user asks to create, update, rename, delete, add, set, or change specific menu items, dishes, categories, sections, modifier groups, prices, descriptions, translations, images, or availability.',
            'If a command asks to clear and then sync, return clear_menu first and sync_menu second.',
            'If a command mixes ai_menu_command instructions with other types, emit each as a separate action.',
          ].join(' '),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'menu_command',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['actions'],
            properties: {
              actions: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'urls', 'instructions', 'confidence'],
                  properties: {
                    type: { type: 'string', enum: supportedActions },
                    urls: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    instructions: { type: 'string' },
                    confidence: { type: 'number' },
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
    const errorText = await response.text();
    throw new Error(`OpenAI command parsing failed: ${response.status} ${errorText.slice(0, 240)}`);
  }

  const data = await response.json();
  const outputText = data.output_text || data.output?.flatMap((item) => item.content || [])
    .find((content) => content.type === 'output_text')?.text;
  const parsed = JSON.parse(outputText || '{}');

  return {
    source: 'openai',
    actions: normalizeActions(parsed.actions, prompt),
  };
}

function normalizeActions(actions, prompt) {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((action) => ({
      type: supportedActions.includes(action.type) ? action.type : 'unknown',
      urls: Array.isArray(action.urls) ? action.urls.filter(Boolean) : [],
      instructions: String(action.instructions || prompt || '').trim(),
      confidence: Number(action.confidence || 0),
    }))
    .filter((action) => action.type !== 'sync_menu' || action.urls.length > 0);
}
