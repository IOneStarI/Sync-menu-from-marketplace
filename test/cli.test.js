import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs } from '../src/cli.js';

test('parses url, dry-run, and output flags', () => {
  assert.deepEqual(parseArgs(['--url', 'https://example.test/menu', '--dry-run', '--output', 'payload.json']), {
    url: 'https://example.test/menu',
    output: 'payload.json',
    dryRun: true,
    clearChoiceMenu: false,
  });
});

test('parses positional url and live flag', () => {
  assert.deepEqual(parseArgs(['https://example.test/menu', '--live']), {
    url: 'https://example.test/menu',
    output: undefined,
    dryRun: false,
    clearChoiceMenu: false,
  });
});

test('parses clear menu flag', () => {
  assert.equal(parseArgs(['--clear-choice-menu', '--dry-run']).clearChoiceMenu, true);
});

test('rejects unknown flags', () => {
  assert.throws(() => parseArgs(['--unknown']), /Unknown argument/);
});
