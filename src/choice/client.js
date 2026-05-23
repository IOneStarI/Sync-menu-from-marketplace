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

  async listSections(language = this.language) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/sections/list`);
  }

  async getSection(language, id) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/sections/${encodeURIComponent(id)}`);
  }

  async createSection(language, payload) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/sections`, payload);
  }

  async updateSection(language, id, payload) {
    return this.request('PUT', `/menu/${encodeURIComponent(language)}/sections/${encodeURIComponent(id)}`, payload);
  }

  async deleteSection(language, id) {
    return this.request('DELETE', `/menu/${encodeURIComponent(language)}/sections/${encodeURIComponent(id)}`);
  }

  async updateSectionsPosition(language, sectionIds) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/sections/position/bulk`, sectionIds);
  }

  async getSectionInfo(language, sectionId) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/section-info/${encodeURIComponent(sectionId)}`);
  }

  async listCategories(language, sectionId) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/categories/list/${encodeURIComponent(sectionId)}`);
  }

  async createCategory(language, payload) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/categories`, payload);
  }

  async updateCategory(language, id, payload) {
    return this.request('PUT', `/menu/${encodeURIComponent(language)}/categories/${encodeURIComponent(id)}`, payload);
  }

  async deleteCategory(language, id) {
    return this.request('DELETE', `/menu/${encodeURIComponent(language)}/categories/${encodeURIComponent(id)}`);
  }

  async updateCategoriesPosition(language, sectionId, categoryIds) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/categories/${encodeURIComponent(sectionId)}/position/bulk`, categoryIds);
  }

  async listDishes(language, categoryId) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/dishes/list/${encodeURIComponent(categoryId)}`);
  }

  async getDishByPosID(language, posID) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/dishes?posID=${encodeURIComponent(posID)}`);
  }

  async createDish(language, payload) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/dishes`, payload);
  }

  async patchDish(language, id, payload) {
    return this.request('PATCH', `/menu/${encodeURIComponent(language)}/dishes/${encodeURIComponent(id)}`, payload);
  }

  async updateDishAreas(language, id, payload) {
    return this.request('PUT', `/menu/${encodeURIComponent(language)}/dishes/${encodeURIComponent(id)}/areas`, payload);
  }

  async deleteDish(language, id) {
    return this.request('DELETE', `/menu/${encodeURIComponent(language)}/dishes/${encodeURIComponent(id)}`);
  }

  async updateDishesPosition(language, categoryId, dishIds) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/dishes/${encodeURIComponent(categoryId)}/position/bulk`, dishIds);
  }

  async getOptionById(language, id) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/options/${encodeURIComponent(id)}`);
  }

  async listOptions(language, sectionId) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/options/list/${encodeURIComponent(sectionId)}`);
  }

  async createOption(language, payload) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/options`, payload);
  }

  async updateOption(language, id, payload) {
    return this.request('PUT', `/menu/${encodeURIComponent(language)}/options/${encodeURIComponent(id)}`, payload);
  }

  async deleteOption(language, id) {
    return this.request('DELETE', `/menu/${encodeURIComponent(language)}/options/${encodeURIComponent(id)}`);
  }

  async attachOptionToDish(language, optionId, dishId) {
    return this.request('PUT', `/menu/${encodeURIComponent(language)}/options/${encodeURIComponent(optionId)}/attach`, { dish: dishId });
  }

  async detachOptionFromDish(language, optionId, dishId) {
    return this.request('PUT', `/menu/${encodeURIComponent(language)}/options/${encodeURIComponent(optionId)}/detach`, { dish: dishId });
  }

  async listDishLabels(language = this.language) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/dish-labels/list`);
  }

  async listPacks(language = this.language) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/pack/list`);
  }

  async createPack(language, payload) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/pack`, payload);
  }

  async updatePack(language, id, payload) {
    return this.request('PUT', `/menu/${encodeURIComponent(language)}/pack/${encodeURIComponent(id)}`, payload);
  }

  async deletePack(language, id) {
    return this.request('DELETE', `/menu/${encodeURIComponent(language)}/pack/${encodeURIComponent(id)}`);
  }

  async getCutlery(language = this.language) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/cutlery`);
  }

  async updateCutlery(language, payload) {
    return this.request('PUT', `/menu/${encodeURIComponent(language)}/cutlery`, payload);
  }

  async syncAvailability(language, payload, { skipMissing } = {}) {
    const query = skipMissing === undefined ? '' : `?skipMissing=${encodeURIComponent(String(skipMissing))}`;
    return this.request('POST', `/menu/${encodeURIComponent(language)}/full/availability${query}`, payload);
  }

  async syncMarketplaceData(language, payload) {
    return this.request('POST', `/menu/${encodeURIComponent(language)}/full/marketplace/data`, payload);
  }

  async getMarketplaceDataStatus(language, id) {
    return this.request('GET', `/menu/${encodeURIComponent(language)}/full/marketplace/data/status/${encodeURIComponent(id)}`);
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
