import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDisplayPrice } from '../src/utils/parser.js';

test('parses marketplace display prices without changing units', () => {
  assert.equal(parseDisplayPrice('280,00 Kč'), 280);
  assert.equal(parseDisplayPrice('30,00 zł'), 30);
  assert.equal(parseDisplayPrice('€9.99'), 9.99);
  assert.equal(parseDisplayPrice('1 234,56 zł'), 1234.56);
});
