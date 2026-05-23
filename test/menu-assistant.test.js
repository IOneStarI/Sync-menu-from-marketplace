import assert from 'node:assert/strict';
import test from 'node:test';
import { applyActionPlan } from '../src/menu-assistant/apply.js';
import { validateActionPlan } from '../src/menu-assistant/plan.js';

test('validates required create item fields', () => {
  const result = validateActionPlan({
    clarificationRequired: false,
    clarificationQuestion: '',
    actions: [{ type: 'create_item', itemName: 'Caesar Salad', categoryName: 'Salads', price: 220 }],
  });
  assert.equal(result.ok, true);
});

test('creates category and dish in full menu payload', () => {
  const plan = {
    actions: [
      { type: 'create_category', categoryName: 'Salads', sectionName: 'Food' },
      {
        type: 'create_item',
        itemName: 'Caesar Salad',
        categoryName: 'Salads',
        description: 'Fresh lettuce',
        price: 220,
        active: true,
      },
    ],
  };
  const result = applyActionPlan({ sections: [], categories: [], dishOptions: [], dishes: [] }, plan);
  assert.equal(result.menu.categories[0].name, 'Salads');
  assert.equal(result.menu.dishes[0].name, 'Caesar Salad');
  assert.equal(result.menu.dishes[0].price, 22000);
});

test('updates item price and active flag', () => {
  const result = applyActionPlan(
    {
      sections: [{ posID: 'section-main', name: 'Main' }],
      categories: [{ posID: 'category-food', sectionPosID: 'section-main', name: 'Food' }],
      dishOptions: [],
      dishes: [{ posID: 'dish-burger', categoryPosID: 'category-food', name: 'Burger Classic', price: 15000 }],
    },
    {
      actions: [
        { type: 'update_item', itemName: 'Burger Classic', price: 180, active: false },
      ],
    },
  );
  assert.equal(result.menu.dishes[0].price, 18000);
  assert.equal(result.menu.dishes[0].active, false);
  assert.deepEqual(result.menu.dishes[0].attributes, ['SOLD_OUT']);
});

test('deletes category and contained dishes', () => {
  const result = applyActionPlan(
    {
      sections: [{ posID: 'section-main', name: 'Main' }],
      categories: [{ posID: 'category-desserts', sectionPosID: 'section-main', name: 'Desserts' }],
      dishOptions: [],
      dishes: [{ posID: 'dish-cake', categoryPosID: 'category-desserts', name: 'Cake', price: 10000 }],
    },
    { actions: [{ type: 'delete_category', categoryName: 'Desserts' }] },
  );
  assert.equal(result.menu.categories.length, 0);
  assert.equal(result.menu.dishes.length, 0);
});

test('validates direct API actions', () => {
  const result = validateActionPlan({
    clarificationRequired: false,
    clarificationQuestion: '',
    actions: [
      {
        type: 'sync_availability',
        availability: { dishes: [{ posID: 'dish-1', active: false, attributes: ['SOLD_OUT'] }] },
      },
      {
        type: 'update_cutlery',
        show: true,
      },
    ],
  });
  assert.equal(result.ok, true);
});
