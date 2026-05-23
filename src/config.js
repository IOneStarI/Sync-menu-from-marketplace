import fs from 'node:fs';
import path from 'node:path';

function parseDotEnv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function readLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  return parseDotEnv(fs.readFileSync(envPath, 'utf8'));
}

function boolValue(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function loadConfig(overrides = {}) {
  const fileEnv = readLocalEnv();
  const env = { ...fileEnv, ...process.env };
  const language = env.CHOICE_MENU_LANGUAGE || 'en';
  const menuCheckPath = normalizeMenuCheckPath(
    env.CHOICE_MENU_CHECK_PATH,
    language,
  );

  return {
    choice: {
      baseUrl: env.CHOICE_API_BASE_URL || 'https://open-api.stage-choiceqr.online',
      bearerToken: env.CHOICE_BEARER_TOKEN || '',
      language,
      menuCheckPath,
    },
    dryRun:
      overrides.dryRun === undefined
        ? boolValue(env.DRY_RUN, true)
        : Boolean(overrides.dryRun),
  };
}

function normalizeMenuCheckPath(value, language) {
  const fallback = `/menu/${language}/full/list`;
  if (!value) return fallback;
  const trimmed = String(value).trim();
  if (!trimmed) return fallback;
  if (/^\/menu\/[^/]+\/full$/i.test(trimmed)) return `${trimmed}/list`;
  return trimmed;
}
