import assert from 'node:assert/strict';
import test from 'node:test';
import { __test__ } from '../src/marketplaces/pyszne.js';

test('parses Pyszne URL context', () => {
  const context = __test__.parsePyszneUrl(new URL('https://www.pyszne.pl/en/menu/mcdonalds-jet-connect-test-store-pl'));

  assert.equal(context.slug, 'mcdonalds-jet-connect-test-store-pl');
  assert.equal(context.language, 'en');
  assert.equal(context.countryCode, 'pl');
});

test('builds Pyszne API candidates across known restaurant endpoint variants', () => {
  const candidates = __test__.pyszneApiCandidates({
    slug: 'mcdonalds-jet-connect-test-store-pl',
    referer: 'https://www.pyszne.pl/en/menu/mcdonalds-jet-connect-test-store-pl',
  });

  assert.ok(candidates.includes('https://cw-api.takeaway.com/api/v29/restaurant?slug=mcdonalds-jet-connect-test-store-pl'));
  assert.ok(candidates.includes('https://cw-api.takeaway.com/api/v34/restaurants/mcdonalds-jet-connect-test-store-pl'));
});

test('normalizes Pyszne restaurant API data into the shared menu shape', () => {
  const menu = __test__.normalizePyszneData(
    {
      restaurant: {
        id: 'rest-1',
        name: "McDonald's test",
        currency: 'PLN',
        menu: {
          categories: [
            { id: 'burgers', name: 'Burgers', productIds: ['p1', 'p2'] },
            { id: 'drinks', name: 'Drinks', productIds: ['p3'] },
          ],
          products: {
            p1: {
              id: 'p1',
              name: 'Big burger',
              description: 'Beef burger',
              price: 2599,
              displayPrice: '25,99 zł',
              imageUrl: 'https://images.pyszne.test/burger.jpg',
              optionGroups: [
                {
                  id: 'extras',
                  name: 'Extras',
                  min: 0,
                  max: 3,
                  options: [
                    { id: 'cheese', name: 'Cheese', price: 200 },
                    { id: 'bacon', name: 'Bacon', price: 350, displayPrice: '3,50 zł' },
                  ],
                },
              ],
            },
            p2: {
              id: 'p2',
              name: 'Burger menu',
              variants: [
                { id: 'small', name: 'Small', price: 3000 },
                { id: 'large', name: 'Large', price: 3600 },
              ],
            },
            p3: {
              id: 'p3',
              name: 'Cola',
              price: 8.5,
              available: false,
            },
          },
        },
      },
    },
    { slug: 'mcdonalds-test' },
  );

  assert.equal(menu.marketplace, 'pyszne');
  assert.equal(menu.sections[0].name, "McDonald's test");
  assert.equal(menu.categories.length, 2);
  assert.equal(menu.items.length, 3);
  assert.equal(menu.items[0].price, 25.99);
  assert.equal(menu.items[0].optionGroupIds[0], 'extras');
  assert.equal(menu.items[1].price, 30);
  assert.equal(menu.items[1].optionGroupIds[0], 'p2-variants');
  assert.equal(menu.items[2].active, false);
  assert.equal(menu.optionGroups.length, 2);
  assert.equal(menu.optionGroups[0].name, 'Extras');
  assert.equal(menu.optionGroups[0].options[1].price, 3.5);
  assert.equal(menu.optionGroups[1].name, 'Choose variant');
  assert.equal(menu.optionGroups[1].options[1].price, 6);
});
