import assert from 'node:assert/strict';
import test from 'node:test';
import { __test__ } from '../src/marketplaces/wolt.js';
import { mapToChoiceFullMenu } from '../src/mapper/choice-full-menu.js';

test('normalizes Wolt minor-unit raw prices to marketplace display prices', () => {
  const menu = __test__.normalizeWoltData({
    id: 'venue-1',
    name: 'Main menu',
    currency: 'CZK',
    categories: [
      {
        id: 'news',
        name: 'Novinky',
        item_ids: ['item-1'],
      },
    ],
    items: [
      {
        id: 'item-1',
        category_id: 'news',
        name: 'Pikantne-sladky udon',
        price: 36500,
        options: ['group-1'],
      },
    ],
    options: [
      {
        id: 'group-1',
        name: 'Extras',
        max: 1,
        options: [{ id: 'extra-1', name: 'Extra sauce', price: 2500 }],
      },
    ],
  }, 'main-menu');

  assert.equal(menu.items[0].price, 365);
  assert.equal(menu.optionGroups[0].options[0].price, 25);

  const mapped = mapToChoiceFullMenu(menu);
  assert.equal(mapped.payload.dishes[0].price, 36500);
  assert.equal(mapped.payload.dishOptions[0].list[0].price, 2500);
});

test('uses Wolt display prices without additional parser conversion', () => {
  const menu = __test__.normalizeWoltData({
    id: 'venue-1',
    name: 'Main menu',
    categories: [{ id: 'news', name: 'Novinky', items: [{ id: 'item-1', name: 'Udon', price: { displayText: '365,00 Kč', amount: 36500 } }] }],
    items: [],
  }, 'main-menu');

  assert.equal(menu.items[0].price, 365);
});
