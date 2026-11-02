import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractShipNames, parseSubscriberPromotions } from '../fetch-subscriber-ships.js';

test('matches database IDs without also matching shorter variant names', () => {
  const ships = new Map([
    ['ursa', 'ursa'],
    ['ursa medivac', 'ursa-medivac'],
    ['apollo', 'apollo'],
    ['apollo medivac', 'apollo-medivac'],
  ]);

  assert.deepEqual(
    extractShipNames('RSI Ursa Medivac and RSI Apollo Medivac', ships),
    ['apollo-medivac', 'ursa-medivac']
  );
  assert.deepEqual(extractShipNames('Ursa', ships), ['ursa']);
});

test('deduplicates database IDs and preserves the five-ship limit', () => {
  const ships = new Map([
    ['ship alpha', 'alpha'],
    ['alias alpha', 'alpha'],
    ['ship bravo', 'bravo'],
    ['ship charlie', 'charlie'],
    ['ship delta', 'delta'],
    ['ship echo', 'echo'],
    ['ship foxtrot', 'foxtrot'],
  ]);

  const result = extractShipNames([...ships.keys()].join(', '), ships);
  assert.equal(result.length, 5);
  assert.equal(new Set(result).size, 5);
  assert.ok(result.every(id => [...ships.values()].includes(id)));
});

test('preserves explicit tiers and uses real database IDs', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(`
    <p>Centurion Subscribers: RSI Ursa Medivac (with 12 months insurance)
    Imperator Subscribers: RSI Apollo Medivac and RSI Ursa Medivac (with 24 months insurance)</p>
    <p>IN-GAME REWARDS (FLAIR) Monthly reward Earnable In-Game:</p>
  `));

  const result = await parseSubscriberPromotions('https://example.com/promotions');
  assert.ok(result);
  assert.deepEqual(result.centurion, ['ursa-medivac']);
  assert.deepEqual(result.imperator, ['apollo-medivac', 'ursa-medivac']);
});
