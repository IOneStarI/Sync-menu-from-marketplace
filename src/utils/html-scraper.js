import { parseJson } from './parser.js';

export function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function extractScriptContentById(html, id) {
  const pattern = new RegExp(`<script[^>]+id=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/script>`);
  const match = html.match(pattern);
  if (!match) throw new Error(`No ${id} script found`);
  return match[1].trim();
}

export function extractScriptJsonById(html, id) {
  return JSON.parse(decodeHtml(extractScriptContentById(html, id)));
}

export function extractJsonScripts(html, { contains } = {}) {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/g)];
  const parsed = [];
  for (const script of scripts) {
    const value = parseJson(decodeHtml(script[1]));
    if (!value) continue;
    if (!contains || JSON.stringify(value).includes(contains)) parsed.push(value);
  }
  return parsed;
}

export function extractWindowAssignments(html, names) {
  const states = [];
  for (const name of names) {
    const marker = `window.${name}=`;
    const index = html.indexOf(marker);
    if (index === -1) continue;
    const start = index + marker.length;
    const end = html.indexOf('</script>', start);
    if (end === -1) continue;
    const raw = html.slice(start, end).replace(/;\s*$/, '').trim();
    const parsed = parseJson(raw);
    if (parsed) {
      states.push(parsed);
      continue;
    }
    try {
      states.push(Function(`"use strict";return (${raw});`)());
    } catch {
      // Keep looking for other assignment states.
    }
  }
  return states;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
