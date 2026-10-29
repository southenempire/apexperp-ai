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

/* ---------- On-chain stop planning ---------- */

import { planProtection } from '../agent/protection';

const E18 = 10n ** 18n;
const eth = {
  name: 'ETH-PERP',
  pool: '0x0000000000000000000000000000000000000001' as const,
  baseDecimals: 18,
  quoteDecimals: 18,
  tickSize: E18 / 100n,
  lotSize: E18 / 10_000n,
  minQuantity: (4n * E18) / 1000n,
  stopRegistry: '0x0000000000000000000000000000000000000002' as const,
};
// 1 ETH long at 2,400 with $400 equity and 5% maintenance: mmReq = $120, health 3.33x.
const longBase = { perp: eth, size: E18, mark: 2400n * E18, equity: 400n * E18, mmReq: 120n * E18, mmBps: 500n, thresholds: t };

test('long gets a 25% trim stop and a whole-position close stop below the mark', () => {
  const plan = planProtection(longBase);
  assert.deepEqual(plan.skipped, []);
  const [trim, close] = plan.legs;
  assert.equal(trim.kind, 'trim');
  assert.equal(trim.isBid, false);
  assert.equal(trim.triggerOperator, 1);
  assert.equal(trim.quantity, E18 / 4n);
  // equity(p) = 1.5 x mm(p) solves to ~2,162.16; aligned up to the 0.01 tick.
  assert.equal(trim.triggerPrice, 216217n * (E18 / 100n));
  assert.equal(close.kind, 'close');
  assert.equal(close.quantity, 0n);
  assert.ok(close.triggerPrice < trim.triggerPrice);
});

test('short stops buy back above the mark', () => {
  const plan = planProtection({ ...longBase, size: -E18 });
  for (const leg of plan.legs) {
    assert.equal(leg.isBid, true);
    assert.equal(leg.triggerOperator, 0);
    assert.ok(leg.triggerPrice > longBase.mark);
  }
  assert.ok(plan.legs[1].triggerPrice > plan.legs[0].triggerPrice);
});

test('a leg already past its line is skipped, not armed to fire instantly', () => {
  // Health 1.3x: inside the trim zone, still above the close line.
  const plan = planProtection({ ...longBase, equity: 156n * E18 });
  assert.deepEqual(plan.legs.map((l) => l.kind), ['close']);
  assert.match(plan.skipped[0], /already past the trim line/);
});

test('a close line at or above the trim line arms nothing', () => {
  for (const flattenBelowHealth of [1.5, 2]) {
    const plan = planProtection({ ...longBase, thresholds: { ...t, flattenBelowHealth } });
    assert.deepEqual(plan.legs, []);
    assert.match(plan.skipped[0], /close line has to sit below the trim line/);
  }
});

import { isProtective } from '../agent/protection';

test('only loss-side stops count as protection; take-profits are left alone', () => {
  assert.equal(isProtective({ isBid: false, triggerOperator: 1 }, 1n), true); // long stop-loss
  assert.equal(isProtective({ isBid: false, triggerOperator: 0 }, 1n), false); // long take-profit
  assert.equal(isProtective({ isBid: true, triggerOperator: 0 }, -1n), true); // short stop-loss
  assert.equal(isProtective({ isBid: true, triggerOperator: 1 }, -1n), false); // short take-profit
});

/* ---------- Linked-bot selectors ---------- */

import { SDK_SELECTORS, SELECTORS } from '../agent/linked';

test('linked-bot selectors derive from the signatures and match the SDK constants', () => {
  assert.equal(SELECTORS.placeOrderFor, SDK_SELECTORS.placeOrderFor);
  assert.equal(SELECTORS.cancelOrderFor, SDK_SELECTORS.cancelOrderFor);
  // Not exported by the SDK, but the value the app's Link a bot flow grants (feedback/06).
  assert.equal(SELECTORS.reduceOrderFor, '0x364c2587');
});
