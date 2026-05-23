import assert from 'node:assert/strict';
import test from 'node:test';
import { __test__ } from '../src/marketplaces/uber.js';

test('normalizes Uber Eats catalog sections into the shared menu shape', () => {
  const menu = __test__.normalizeUberData({
    title: 'Arizona Burger (Hoza)',
    uuid: 'store-1',
    currencyCode: 'PLN',
    seoMeta: { description: 'Burger restaurant' },
    hours: [
      {
        dayRange: 'Sunday - Thursday',
        sectionHours: [{ startTime: 660, endTime: 1320 }],
      },
    ],
    catalogSectionsMap: {
      'store-1': [
        {
          payload: {
            standardItemsPayload: {
              sectionUUID: 'section-1',
              title: { text: 'Burger' },
              catalogItems: [
                {
                  uuid: 'item-1',
                  title: 'Classic burger',
                  itemDescription: 'Beef, pickles, sauce.',
                  price: 5600,
                  imageUrl: 'https://tb-static.uber.test/burger.jpg',
                  isSoldOut: false,
                  isAvailable: true,
                },
                {
                  uuid: 'item-2',
                  title: 'Sold out fries',
                  price: 1200,
                  isSoldOut: true,
                },
              ],
            },
          },
        },
      ],
    },
  }, 'arizona-burger-hoza');

  assert.equal(menu.marketplace, 'uber');
  assert.equal(menu.sections[0].name, 'Arizona Burger (Hoza)');
  assert.equal(menu.sections[0].schedule[0].from, '11:00:00');
  assert.equal(menu.categories[0].name, 'Burger');
  assert.equal(menu.items[0].categoryId, 'section-1-1-Burger');
  assert.equal(menu.items[0].price, 56);
  assert.equal(menu.items[0].imageUrl, 'https://tb-static.uber.test/burger.jpg');
  assert.equal(menu.items[1].active, false);
});
