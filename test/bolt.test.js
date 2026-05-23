import assert from 'node:assert/strict';
import test from 'node:test';
import { __test__ } from '../src/marketplaces/bolt.js';

test('normalizes Bolt menu tree into the shared menu shape', () => {
  const menu = __test__.normalizeBoltData({
    providerId: 55959,
    provider: {
      provider_id: 55959,
      name: { value: 'MATOKA Shawarma Bar - Centre' },
    },
    menu: {
      root_id: 1,
      items: {
        1: { type: 'menu', id: 1, child_ids: [2] },
        2: { type: 'category', id: 2, parent_id: 1, index: 0, name: { value: 'Shawarma' }, availability: 'available', child_ids: [3] },
        3: {
          type: 'dish',
          id: 3,
          parent_id: 2,
          index: 0,
          name: { value: 'Chicken shawarma' },
          description: { value: 'With sauce' },
          price: { value: 180, currency: 'czk', price_str: '180,00 Kč' },
          availability: 'in_stock',
          images: { menu_item_list_v1: { aspect_ratio_map: { original: { '3x': 'https://images.bolt.test/dish.jpg' } } } },
          child_ids: [4],
        },
        4: { type: 'option_select_group', id: 4, parent_id: 3, index: 0, name: { value: 'Sauce' }, is_required: true, child_ids: [5] },
        5: { type: 'option_select', id: 5, parent_id: 4, index: 0, name: { value: 'Garlic' }, price: { value: 0, price_str: '0,00 Kč' }, availability: 'in_stock', child_ids: [] },
      },
    },
  });

  assert.equal(menu.marketplace, 'bolt');
  assert.equal(menu.sections[0].name, 'MATOKA Shawarma Bar - Centre');
  assert.equal(menu.categories[0].name, 'Shawarma');
  assert.equal(menu.items[0].categoryId, '2');
  assert.equal(menu.items[0].price, 180);
  assert.equal(menu.items[0].imageUrl, 'https://images.bolt.test/dish.jpg');
  assert.equal(menu.optionGroups[0].type, 'single');
  assert.equal(menu.optionGroups[0].required, true);
});
