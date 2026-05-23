export function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function arrayProp(value, keys) {
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

export function getString(value, keys) {
  for (const key of keys) {
    if (typeof value?.[key] === 'string' && value[key].trim()) return value[key].trim();
    if (typeof value?.[key] === 'number') return String(value[key]);
  }
  return undefined;
}

export function localized(value) {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry?.value === 'string' && entry.value.trim());
    return first?.value;
  }
  if (value && typeof value === 'object') {
    return value.value || value.en || value.en_GB || value.text || value.accessibilityText || value.title || value.name ||
      Object.values(value).find((entry) => typeof entry === 'string' && entry.trim());
  }
  return undefined;
}

export function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function fromMinorUnits(value) {
  const number = numberValue(value);
  return number === undefined ? undefined : number / 100;
}

export function parseDisplayPrice(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const normalized = value
    .replace(/\u00a0/g, ' ')
    .replace(/[^\d,.\-\s]/g, '')
    .trim();
  if (!/\d/.test(normalized)) return undefined;

  const compact = normalized.replace(/\s+/g, '');
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  if (decimalIndex !== -1 && compact.length - decimalIndex - 1 <= 2) {
    const integer = compact.slice(0, decimalIndex).replace(/[,.]/g, '');
    const fraction = compact.slice(decimalIndex + 1);
    const parsed = Number(`${integer}.${fraction}`);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const parsed = Number(compact.replace(/[,.]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function walk(value, visit) {
  visit(value);
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  for (const child of Object.values(value)) walk(child, visit);
}

export function summarizeFailures(failures, limit = 2) {
  if (!Array.isArray(failures) || failures.length === 0) return '';
  return failures
    .slice(0, limit)
    .map((failure) => String(failure).replace(/\s+/g, ' ').slice(0, 300))
    .join(' | ');
}
