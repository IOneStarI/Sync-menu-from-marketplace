import assert from 'node:assert/strict';
import test from 'node:test';
import { __test__ } from '../src/marketplaces/glovo.js';

test('extracts Glovo store ids from streamed page state', () => {
  const ids = __test__.extractStoreIds(
    'shareUrl=https://glovoapp.com/store?store_id=520379;{"storeAddressId":846428}',
    new URL('https://glovoapp.com/uk/pl/katowice/stores/zloty-osiol-ktw-1'),
  );

  assert.deepEqual(ids, {
    storeId: '520379',
    storeAddressId: '846428',
  });
});

test('finds Glovo city code by country and slug', () => {
  assert.equal(
    __test__.findCityCode(
      {
        WAW: { name: 'Warszawa', countryCode: 'PL', translations: {} },
        KTW: { name: 'Katowice', countryCode: 'PL', translations: { uk: 'Катовіце' } },
      },
      { countryCode: 'PL', citySlug: 'katowice' },
    ),
    'KTW',
  );
});

test('normalizes Glovo content into the shared menu shape with additions', () => {
  const menu = __test__.normalizeGlovoData({
    ids: { storeId: '520379', storeAddressId: '846428' },
    store: {
      id: 520379,
      name: 'Złoty Osioł',
      currency: 'PLN',
      note: 'Faktura? Napisz w uwagach odnośnie alergii.',
    },
    content: {
      data: {
        body: [
          {
            type: 'LIST',
            data: {
              title: 'Хіт продажів',
              slug: 'hit-prodazhiv-ts',
              tracking: { collectionType: 'TOP_SELLERS' },
              elements: [],
            },
          },
          {
            type: 'LIST',
            data: {
              title: 'Osłowe specjały',
              slug: 'oslowe-specjaly-s.6191223209',
              elements: [
                {
                  type: 'PRODUCT_ROW',
                  data: {
                    id: 41398071150,
                    name: 'Lazania ze szpinakiem i pomidorami',
                    description: 'Domowej roboty płaty makaronu',
                    priceInfo: { amount: 30, currencyCode: 'PLN', displayText: '30,00 zł' },
                    imageId: 'dh:menus-glovo/products/lazania.jpg',
                    attributeGroups: [
                      {
                        id: 4460214125,
                        name: 'Wybierz wariant',
                        min: 1,
                        max: 1,
                        attributes: [
                          { id: 9074010245, name: 'Do samodzielnego podgrzania', priceImpact: 0 },
                          { id: 9074010246, name: 'Na ciepło', priceInfo: { amount: 1.5 } },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  assert.equal(menu.marketplace, 'glovo');
  assert.equal(menu.sections[0].name, 'Złoty Osioł');
  assert.equal(menu.categories.length, 1);
  assert.equal(menu.categories[0].name, 'Osłowe specjały');
  assert.equal(menu.items[0].price, 30);
  assert.equal(menu.items[0].imageUrl, 'https://glovo.dhmedia.io/image/menus-glovo/products/lazania.jpg');
  assert.deepEqual(menu.items[0].optionGroupIds, ['4460214125']);
  assert.equal(menu.optionGroups[0].name, 'Wybierz wariant');
  assert.equal(menu.optionGroups[0].type, 'single');
  assert.equal(menu.optionGroups[0].required, true);
  assert.equal(menu.optionGroups[0].options[1].price, 1.5);
});
