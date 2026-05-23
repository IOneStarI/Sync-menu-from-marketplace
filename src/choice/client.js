import { AppError } from '../errors.js';
import { parseJson } from '../utils/parser.js';

export class ChoiceClient {
  constructor({ baseUrl, bearerToken, language, menuCheckPath }) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.bearerToken = bearerToken;
    this.language = language || 'en';
    this.menuCheckPath = menuCheckPath || `/menu/${this.language}/full/list`;

    if (!this.baseUrl) throw new AppError('CHOICE_API_BASE_URL is required.', 'CONFIG_ERROR');
    if (!this.bearerToken) throw new AppError('CHOICE_BEARER_TOKEN is required for live imports.', 'CONFIG_ERROR');
  }

  async getExistingMenu() {
    return this.request('GET', this.menuCheckPath);
  }

  async createFullMenu(language, payload) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/full`, payload);
  }

  async request(method, apiPath, body = undefined) {
    const url = new URL(apiPath, `${this.baseUrl}/`);

    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.bearerToken}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const parsed = parseJson(text);
    if (!response.ok) {
      const errorDetails = formatApiError(parsed, text);
      throw new AppError(
        `Choice API ${method} ${url.pathname} failed with HTTP ${response.status}:\n${errorDetails}`,
        'CHOICE_API_ERROR',
        { status: response.status, method, path: url.pathname, response: parsed ?? text },
      );
    }
    return parsed;
  }
}

function formatApiError(parsed, text) {
  const lines = [];
  collectErrorLines(parsed, lines);
  if (lines.length > 0) return [...new Set(lines)].join('\n');
  return text ? text.slice(0, 500) : 'empty response';
}

function collectErrorLines(value, lines, path = '') {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    if (value.trim()) lines.push(path ? `${path}: ${value}` : value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectErrorLines(entry, lines, `${path}[${index}]`));
    return;
  }

  if (typeof value !== 'object') return;

  if (typeof value.property === 'string' && typeof value.message === 'string') {
    lines.push(`${value.property}: ${value.message}`);
  }

  if (typeof value.path === 'string' && typeof value.message === 'string') {
    lines.push(`${value.path}: ${value.message}`);
  }

  if (typeof value.field === 'string' && typeof value.message === 'string') {
    lines.push(`${value.field}: ${value.message}`);
  }

  for (const [key, entry] of Object.entries(value)) {
    if (['property', 'path', 'field'].includes(key)) continue;
    collectErrorLines(entry, lines, path ? `${path}.${key}` : key);
  }
}

export const __test__ = {
  formatApiError,
};
