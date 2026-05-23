import assert from 'node:assert/strict';
import test from 'node:test';
import { detectMarketplace } from '../src/marketplaces/detect.js';

test('detects Wolt URLs', () => {
  assert.equal(
    detectMarketplace('https://wolt.com/en/rou/botosani/restaurant/enjoy-pub-67dac1d821070572d8f7abf0'),
    'wolt',
  );
});

test('detects Foodora URLs', () => {
  assert.equal(
    detectMarketplace('https://www.foodora.cz/en/restaurant/poya/doebikokota-uvoz'),
    'foodora',
  );
});

test('detects Bolt Food URLs', () => {
  assert.equal(
    detectMarketplace('https://food.bolt.eu/uk-ua/271-prague/p/55959-matoka-shawarma-bar-centre/'),
    'bolt',
  );
});

test('detects Uber Eats URLs', () => {
  assert.equal(
    detectMarketplace('https://www.ubereats.com/gb/store/arizona-burger-hoza/qvS01KO6QquI8CNWiAYDRA?diningMode=DELIVERY'),
    'uber',
  );
});

test('detects Glovo URLs', () => {
  assert.equal(
    detectMarketplace('https://glovoapp.com/uk/pl/katowice/stores/zloty-osiol-ktw-1'),
    'glovo',
  );
});

test('detects Pyszne/Just Eat URLs', () => {
  assert.equal(
    detectMarketplace('https://www.pyszne.pl/en/menu/mcdonalds-jet-connect-test-store-pl'),
    'pyszne',
  );
  assert.equal(detectMarketplace('https://www.just-eat.co.uk/menu/test-restaurant'), 'pyszne');
});

test('falls back to generic for unknown hosts', () => {
  assert.equal(detectMarketplace('https://example.com/restaurant/foo'), 'generic');
  assert.equal(detectMarketplace('https://my-restaurant.com/menu'), 'generic');
});
