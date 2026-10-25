/**
 * Unit tests for the setup detectors and the edge check (no network). Run: npm run test:setups
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { edgeCheck, runTrade, verdict, type EdgeStats } from '../agent/edge';
import { applyFilters, closedCandles, crt, findSetups, turtleSoup, type Candle, type Setup } from '../agent/setups';

const MIN = 60_000;
const candle = (i: number, o: number, h: number, l: number, c: number): Candle => ({ t: i * 15 * MIN, o, h, l, c, v: 1 });

test('CRT: a sweep of the low that closes back inside targets the top of candle 1', () => {
  const cs = [candle(0, 105, 110, 100, 104), candle(1, 101, 105, 98, 103)];
  const [s] = crt(cs);
  assert.equal(s.kind, 'CRT');
  assert.equal(s.long, true);
  assert.deepEqual([s.entry, s.stop, s.target], [103, 98, 110]);
  assert.ok(Math.abs(s.rr - 1.4) < 1e-9);
  assert.equal(s.index, 1);
});

test('CRT: a sweep of the high that closes back inside targets the bottom of candle 1', () => {
  const cs = [candle(0, 105, 110, 100, 104), candle(1, 108, 112, 104, 107)];
  const [s] = crt(cs);
  assert.equal(s.long, false);
  assert.deepEqual([s.entry, s.stop, s.target], [107, 112, 100]);
});

test('CRT: a sweep that closes outside the range, or no sweep, is not a setup', () => {
  assert.equal(crt([candle(0, 105, 110, 100, 104), candle(1, 101, 105, 98, 99)]).length, 0); // closed below the low
  assert.equal(crt([candle(0, 105, 110, 100, 104), candle(1, 102, 108, 101, 106)]).length, 0); // inside bar
});

test('Turtle Soup: a new 20-bar low whose old low is far enough back, closed above it, is a long', () => {
  const cs = Array.from({ length: 25 }, (_, i) => candle(i, 102, 105, 100, 102));
  cs[5] = candle(5, 102, 105, 95, 102); // the old 20-bar low
  cs.push(candle(25, 100, 101, 93, 97)); // takes it out, closes back above 95
  const setups = turtleSoup(cs);
  assert.equal(setups.length, 1);
  const [s] = setups;
  assert.equal(s.index, 25);
  assert.equal(s.long, true);
  assert.deepEqual([s.entry, s.stop, s.target], [97, 93, 105]); // 2R above the entry
});

test('Turtle Soup: ignores a sweep when the old low is under 4 bars old', () => {
  const cs = Array.from({ length: 25 }, (_, i) => candle(i, 102, 105, 100, 102));
  cs[22] = candle(22, 102, 105, 95, 102);
  cs.push(candle(25, 100, 101, 93, 97)); // old low is 3 bars back
  assert.equal(turtleSoup(cs).length, 0);
});

test('runTrade: target first wins, stop first loses, a candle touching both loses, nothing resolves to null', () => {
  const base = candle(0, 100, 101, 99, 100);
  const long = (next: Candle[], h = 6) => runTrade([base, ...next], 0, true, 100, 95, 110, h);
  assert.equal(long([candle(1, 100, 112, 99, 111)]), 2);
  assert.equal(long([candle(1, 100, 101, 94, 96)]), -1);
  assert.equal(long([candle(1, 100, 112, 94, 100)]), -1);
  assert.equal(long([candle(1, 100, 104, 98, 101)]), null);
  assert.equal(long([candle(1, 100, 104, 98, 101), candle(2, 100, 112, 99, 111)], 1), null, 'beyond the horizon');
  // A short mirrors it.
  assert.equal(runTrade([base, candle(1, 100, 101, 88, 90)], 0, false, 100, 105, 90, 6), 2);
});

test('closedCandles drops a candle that is still forming', () => {
  const tf = 15 * MIN;
  const cs = [candle(0, 1, 1, 1, 1), candle(1, 1, 1, 1, 1)];
  assert.equal(closedCandles(cs, tf, cs[1].t + 5 * MIN).length, 1);
  assert.equal(closedCandles(cs, tf, cs[1].t + tf).length, 2);
});

test('filters: session by UTC hour of the setup candle, and minimum reward over risk', () => {
  const at = (hour: number, rr: number): Setup => ({ kind: 'CRT', index: 0, time: Date.UTC(2026, 9, 20, hour), long: true, entry: 1, stop: 0.9, target: 1 + 0.1 * rr, rr });
  const all = [at(3, 1), at(14, 2), at(22, 3)];
  assert.deepEqual(applyFilters(all, { session: 'ASIA', minRR: 0 }).map((s) => s.rr), [1]);
  assert.deepEqual(applyFilters(all, { session: 'NEW_YORK', minRR: 0 }).map((s) => s.rr), [2]);
  assert.deepEqual(applyFilters(all, { session: 'LONDON', minRR: 0 }).map((s) => s.rr), [2]);
  assert.deepEqual(applyFilters(all, { session: 'ALL', minRR: 2 }).map((s) => s.rr), [2, 3]);
});

/** A seeded random walk: no pattern in it can predict anything. */
function randomWalk(n: number, seed: number): Candle[] {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const out: Candle[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o * (1 + (rnd() - 0.5) * 0.01);
    out.push({ t: i * 15 * MIN, o, h: Math.max(o, c) * (1 + rnd() * 0.004), l: Math.min(o, c) * (1 - rnd() * 0.004), c, v: 1 });
    p = c;
  }
  return out;
}

test('edge check is deterministic for the same data', () => {
  const cs = randomWalk(1500, 7);
  const groups = [{ candles: cs, setups: findSetups(cs, ['CRT', 'TURTLE_SOUP']) }];
  assert.deepEqual(edgeCheck(groups), edgeCheck(groups));
});

test('on a random walk the setups do not beat the control (the check does not invent an edge)', () => {
  const groups = [11, 22, 33, 44].map((seed) => {
    const cs = randomWalk(3000, seed);
    return { candles: cs, setups: findSetups(cs, ['CRT']) };
  });
  const stats = edgeCheck(groups);
  assert.ok(stats.n > 500, `only ${stats.n} resolved setups`);
  assert.ok(stats.baselineN > 5000);
  assert.ok(Math.abs(stats.diffPts) < 4 * stats.sePts, `diff ${stats.diffPts.toFixed(2)} pts vs one standard error ${stats.sePts.toFixed(2)}`);
  assert.notEqual(verdict(stats), 'BETTER');
});

test('verdict wording tracks sample size and distance from the control', () => {
  const stats = (n: number, diffPts: number, sePts: number): EdgeStats => ({ n, winRate: 0.5, avgR: 0, baselineN: 100, baselineWinRate: 0.5, baselineAvgR: 0, diffPts, sePts });
  assert.equal(verdict(stats(10, 30, 1)), 'TOO_FEW');
  assert.equal(verdict(stats(100, 1, 5)), 'NO_EDGE');
  assert.equal(verdict(stats(100, 12, 4)), 'BETTER');
  assert.equal(verdict(stats(100, -12, 4)), 'WORSE');
});
