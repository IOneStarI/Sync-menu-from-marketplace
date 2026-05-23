export function makePosId(prefix, value) {
  const raw = String(value || 'unknown')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${prefix}-${raw || 'unknown'}`;
}
