import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';

test('defaults existing menu check to Choice full list endpoint', () => {
  const original = process.env.CHOICE_MENU_CHECK_PATH;
  const originalLanguage = process.env.CHOICE_MENU_LANGUAGE;
  process.env.CHOICE_MENU_CHECK_PATH = '';
  process.env.CHOICE_MENU_LANGUAGE = 'ro';

  try {
    const config = loadConfig({ dryRun: true });
    assert.equal(config.choice.menuCheckPath, '/menu/ro/full/list');
  } finally {
    if (original === undefined) delete process.env.CHOICE_MENU_CHECK_PATH;
    else process.env.CHOICE_MENU_CHECK_PATH = original;
    if (originalLanguage === undefined) delete process.env.CHOICE_MENU_LANGUAGE;
    else process.env.CHOICE_MENU_LANGUAGE = originalLanguage;
  }
});

test('normalizes stale full endpoint check override to list endpoint', () => {
  const original = process.env.CHOICE_MENU_CHECK_PATH;
  process.env.CHOICE_MENU_CHECK_PATH = '/menu/en/full';

  try {
    const config = loadConfig({ dryRun: true });
    assert.equal(config.choice.menuCheckPath, '/menu/en/full/list');
  } finally {
    if (original === undefined) delete process.env.CHOICE_MENU_CHECK_PATH;
    else process.env.CHOICE_MENU_CHECK_PATH = original;
  }
});
