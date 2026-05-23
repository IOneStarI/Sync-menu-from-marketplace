import assert from 'node:assert/strict';
import test from 'node:test';
import { __test__ } from '../src/marketplaces/foodora.js';

test('normalizes Foodora category products into the shared menu shape', () => {
  const menu = __test__.normalizeFoodoraData({
    code: 'poya',
    name: 'Doebikokota',
    categories: [
      {
        id: 'sushi',
        name: 'Sushi',
        products: [
          {
            id: 'maki-1',
            title: 'Maki set',
            description: '8 pcs',
            price: 12900,
            displayPrice: '129,00 Kč',
            imageUrls: ['https://images.foodora.test/maki.jpg'],
            active: true,
            options: [
              {
                id: 'sauce',
                name: 'Sauce',
                minimum: 0,
                maximum: 1,
                options: [
                  { id: 'soy', name: 'Soy sauce', price: 0 },
                  { id: 'spicy', name: 'Spicy sauce', price: 1500, displayPrice: '15,00 Kč' },
                ],
              },
            ],
          },
        ],
      },
    ],
  }, 'poya');

  assert.equal(menu.marketplace, 'foodora');
  assert.equal(menu.categories[0].name, 'Sushi');
  assert.equal(menu.items[0].categoryId, 'sushi');
  assert.equal(menu.items[0].imageUrl, 'https://images.foodora.test/maki.jpg');
  assert.equal(menu.optionGroups[0].name, 'Sauce');
  assert.equal(menu.items[0].price, 129);
  assert.equal(menu.optionGroups[0].options[1].price, 15);
});

test('normalizes Foodora Partner API catalog products into the shared menu shape', () => {
  const menu = __test__.normalizeFoodoraData({
    code: 'poya',
    categories: [
      {
        global_id: 'cat-global-sushi',
        name: { en_CZ: 'Sushi' },
      },
    ],
    products: [
      {
        sku: 'sku-maki-1',
        title: { en_CZ: 'Maki set' },
        description: { en_CZ: '8 pcs' },
        price: 12900,
        category_global_ids: ['cat-global-sushi'],
        images: [{ url: 'https://images.foodora.test/maki.jpg' }],
        active: true,
      },
    ],
  }, 'poya');

  assert.equal(menu.categories[0].id, 'cat-global-sushi');
  assert.equal(menu.items[0].id, 'sku-maki-1');
  assert.equal(menu.items[0].categoryId, 'cat-global-sushi');
  assert.equal(menu.items[0].price, 129);
});
