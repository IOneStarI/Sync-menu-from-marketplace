import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyFullMenuPayload } from '../src/choice/clear-menu.js';

test('builds Choice empty full-menu payload with one section', () => {
  assert.deepEqual(createEmptyFullMenuPayload(), {
    sections: [
      {
        posID: 'section-empty-menu',
        name: 'Empty menu',
        description: '',
      },
    ],
    categories: [],
    dishOptions: [],
    dishes: [],
  });
});
