import assert from 'node:assert/strict';
import test from 'node:test';
import { extractUrls, interpretCommandLocally } from '../src/command-router.js';

test('extracts URLs from a mixed text command', () => {
  assert.deepEqual(extractUrls('sync https://wolt.com/en/menu please'), ['https://wolt.com/en/menu']);
});

test('classifies marketplace URLs as sync commands', () => {
  const command = interpretCommandLocally('please import https://www.ubereats.com/store/example');
  assert.equal(command.source, 'local');
  assert.equal(command.actions[0].type, 'sync_menu');
  assert.deepEqual(command.actions[0].urls, ['https://www.ubereats.com/store/example']);
});

test('classifies clear menu commands', () => {
  const command = interpretCommandLocally('clear menu');
  assert.equal(command.actions[0].type, 'clear_menu');
});

test('classifies short clear commands', () => {
  const command = interpretCommandLocally('clear');
  assert.equal(command.actions[0].type, 'clear_menu');
});

test('orders clear before sync when both are requested', () => {
  const command = interpretCommandLocally('clear menu then sync https://wolt.com/en/menu');
  assert.deepEqual(command.actions.map((action) => action.type), ['clear_menu', 'sync_menu']);
});
