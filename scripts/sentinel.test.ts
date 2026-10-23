/**
 * Unit tests for the Sentinel rules (no network). Run: npm run test:sentinel
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, healthRatio, protectivePrice, reduceQuantity } from '../agent/sentinel';

const t = { reduceBelowHealth: 1.5, flattenBelowHealth: 1.15, reducePercentage: 25 };

test('health ratio is equity over maintenance margin, null when flat', () => {
  assert.equal(healthRatio(150n, 100n), 1.5);
  assert.equal(healthRatio(-10n, 100n), -0.1);
  assert.equal(healthRatio(500n, 0n), null);
});

test('decision thresholds', () => {
  assert.deepEqual(decide(null, t), { action: 'NONE', pct: 0 });
  assert.deepEqual(decide(2.0, t), { action: 'NONE', pct: 0 });
  assert.deepEqual(decide(1.5, t), { action: 'REDUCE', pct: 25 });
  assert.deepEqual(decide(1.2, t), { action: 'REDUCE', pct: 25 });
  assert.deepEqual(decide(1.15, t), { action: 'FLATTEN', pct: 100 });
  assert.deepEqual(decide(0.9, t), { action: 'FLATTEN', pct: 100 });
});

test('reduce quantity is lot-aligned and never exceeds reducing capacity', () => {
  const base = { lotSize: 10n, minQuantity: 40n };
  // 25% of 1000 = 250
  assert.equal(reduceQuantity({ ...base, size: 1000n, pct: 25, reducingCapacity: 1000n }), 250n);
  // shorts use the magnitude; 25% of 1003 = 250.75 -> 250 after lot alignment
  assert.equal(reduceQuantity({ ...base, size: -1003n, pct: 25, reducingCapacity: 1003n }), 250n);
  // resting reduce orders shrink capacity
  assert.equal(reduceQuantity({ ...base, size: 1000n, pct: 25, reducingCapacity: 120n }), 120n);
  // too small a trim is raised to the pool minimum
  assert.equal(reduceQuantity({ ...base, size: 100n, pct: 25, reducingCapacity: 100n }), 40n);
  // capacity below the minimum: no valid reduce-only order
  assert.equal(reduceQuantity({ ...base, size: 30n, pct: 100, reducingCapacity: 30n }), 0n);
  // flatten closes everything that fits the lot grid
  assert.equal(reduceQuantity({ ...base, size: 1005n, pct: 100, reducingCapacity: 1005n }), 1000n);
});

test('protective price crosses the book within slippage, aligned to tick', () => {
  // mark 2000.00 with tick 0.01 (raw 1 = 0.01), 2% slippage
  assert.equal(protectivePrice(200_000n, true, 0.02, 1n), 204_000n);
  assert.equal(protectivePrice(200_000n, false, 0.02, 1n), 196_000n);
  // buys round up, sells round down to the tick
  assert.equal(protectivePrice(1_001n, true, 0.02, 10n), 1_030n);
  assert.equal(protectivePrice(1_001n, false, 0.02, 10n), 980n);
});
