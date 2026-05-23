import assert from 'node:assert/strict';
import test from 'node:test';
import { mapToChoiceFullMenu } from '../src/mapper/choice-full-menu.js';

test('maps normalized menu to Choice full menu payload', () => {
  const result = mapToChoiceFullMenu({
    sections: [{ id: 'main', name: 'Main menu' }],
    categories: [{ id: 'eggs', sectionId: 'main', name: 'Eggs', active: true }],
    optionGroups: [
      {
        id: 'milk-type',
        sectionId: 'main',
        name: 'Milk type',
        type: 'single',
        required: true,
        active: true,
        options: [
          { id: 'normal', name: 'Normal milk', price: 0, active: true },
          { id: 'oat', name: 'Oat milk', price: 3, active: true },
        ],
      },
    ],
    items: [
      {
        id: 'omelete',
        categoryId: 'eggs',
        name: 'Omelete',
        description: 'Omelete description',
        price: 5,
        imageUrl: 'https://example.com/image.jpeg',
        active: false,
        soldOut: true,
        optionGroupIds: ['milk-type'],
      },
    ],
  });

  assert.equal(result.payload.sections[0].posID, 'section-main');
  assert.equal(result.payload.categories[0].sectionPosID, 'section-main');
  assert.equal(result.payload.dishOptions[0].type, 'single');
  assert.equal(result.payload.dishes[0].active, false);
  assert.equal(result.payload.dishes[0].price, 500);
  assert.equal(result.payload.dishOptions[0].list[1].price, 300);
  assert.deepEqual(result.payload.dishes[0].attributes, ['SOLD_OUT']);
  assert.equal(result.payload.dishes[0].media, 'https://example.com/image.jpeg');
  assert.equal('externalMedia' in result.payload.dishes[0], false);
  assert.equal(result.payload.dishes[0].dishOptions[0].posID, 'option-milk-type');
});

test('fails items with missing required prices', () => {
  const result = mapToChoiceFullMenu({
    sections: [{ id: 'main', name: 'Main menu' }],
    categories: [{ id: 'eggs', sectionId: 'main', name: 'Eggs', active: true }],
    optionGroups: [],
    items: [{ id: 'omelete', categoryId: 'eggs', name: 'Omelete' }],
  });

  assert.equal(result.payload.dishes.length, 0);
  assert.equal(result.failedItems.length, 1);
});

test('converts normalized major-unit prices to Choice minor units', () => {
  const result = mapToChoiceFullMenu({
    sections: [{ id: 'main', name: 'Main menu' }],
    categories: [{ id: 'drinks', sectionId: 'main', name: 'Drinks', active: true }],
    optionGroups: [],
    items: [{ id: 'cola', categoryId: 'drinks', name: 'Cola', price: 9.99 }],
  });

  assert.equal(result.payload.dishes[0].price, 999);
});

test('multiplies integer major-unit prices by 100 for Choice display', () => {
  const result = mapToChoiceFullMenu({
    sections: [{ id: 'main', name: 'Main menu' }],
    categories: [{ id: 'sets', sectionId: 'main', name: 'Sets', active: true }],
    optionGroups: [],
    items: [{ id: 'set', categoryId: 'sets', name: 'Set', price: 999 }],
  });

  assert.equal(result.payload.dishes[0].price, 99900);
});

test('reuses one Choice dish option for repeated equivalent additions', () => {
  const result = mapToChoiceFullMenu({
    sections: [{ id: 'main', name: 'Main menu' }],
    categories: [
      { id: 'pizza', sectionId: 'main', name: 'Pizza', active: true },
      { id: 'pasta', sectionId: 'main', name: 'Pasta', active: true },
    ],
    optionGroups: [
      {
        id: 'binding-1',
        sectionId: 'main',
        name: 'Extra sauce',
        type: 'multiple',
        required: false,
        active: true,
        options: [{ id: 'sauce-1', name: 'Garlic', price: 2, active: true }],
      },
      {
        id: 'binding-2',
        sectionId: 'main',
        name: 'Extra sauce',
        type: 'multiple',
        required: false,
        active: true,
        options: [{ id: 'sauce-2', name: 'Garlic', price: 2, active: true }],
      },
    ],
    items: [
      { id: 'pizza-1', categoryId: 'pizza', name: 'Pizza', price: 10, optionGroupIds: ['binding-1'] },
      { id: 'pasta-1', categoryId: 'pasta', name: 'Pasta', price: 11, optionGroupIds: ['binding-2'] },
    ],
  });

  assert.equal(result.payload.dishOptions.length, 1);
  assert.equal(result.payload.dishes[0].dishOptions[0].posID, result.payload.dishes[1].dishOptions[0].posID);
});

test('does not attach the same Choice dish option twice to one dish', () => {
  const result = mapToChoiceFullMenu({
    sections: [{ id: 'main', name: 'Main menu' }],
    categories: [{ id: 'pizza', sectionId: 'main', name: 'Pizza', active: true }],
    optionGroups: [
      {
        id: 'binding-1',
        sectionId: 'main',
        name: 'Extra sauce',
        type: 'multiple',
        required: false,
        active: true,
        options: [{ id: 'sauce-1', name: 'Garlic', price: 2, active: true }],
      },
      {
        id: 'binding-2',
        sectionId: 'main',
        name: 'Extra sauce',
        type: 'multiple',
        required: false,
        active: true,
        options: [{ id: 'sauce-2', name: 'Garlic', price: 2, active: true }],
      },
    ],
    items: [
      {
        id: 'pizza-1',
        categoryId: 'pizza',
        name: 'Pizza',
        price: 10,
        optionGroupIds: ['binding-1', 'binding-2'],
      },
    ],
  });

  assert.equal(result.payload.dishes[0].dishOptions.length, 1);
});

test('removes sections that do not contain categories from the Choice payload', () => {
  const result = mapToChoiceFullMenu({
    sections: [
      { id: 'empty', name: 'Empty section' },
      { id: 'food', name: 'Food' },
    ],
    categories: [{ id: 'pizza', sectionId: 'food', name: 'Pizza', active: true }],
    optionGroups: [
      {
        id: 'sauce',
        sectionId: 'empty',
        name: 'Sauce',
        type: 'single',
        required: false,
        active: true,
        options: [{ id: 'garlic', name: 'Garlic', price: 0, active: true }],
      },
    ],
    items: [{ id: 'pizza-1', categoryId: 'pizza', name: 'Pizza', price: 10, optionGroupIds: ['sauce'] }],
  });

  assert.deepEqual(result.payload.sections.map((section) => section.posID), ['section-food']);
  assert.equal(result.payload.categories[0].sectionPosID, 'section-food');
  assert.equal(result.payload.dishOptions[0].sectionPosID, 'section-food');
});
