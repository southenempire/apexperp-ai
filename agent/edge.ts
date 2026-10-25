/**
 * Edge check: did a setup beat random entries?
 *
 * Every setup is replayed on the candles that followed it. As a control, each setup is also replayed from
 * random candles in the same market with the same direction and the same stop and target distances (as a
 * share of price), under the identical rule. If the setup is better than chance, its win rate and average R
 * sit clearly above that control. If not, it does not matter how good the chart looks.
 *
 * Rule: stop and target are checked on each following candle; a candle that touches both counts as a loss
 * (pessimistic), for the setup and the control alike. Trades that reach neither within the horizon are left out.
 */

import { HORIZON, type Candle, type Setup } from './setups';

/** The result of one trade in R: -1 for a stop, the reward over risk for a target, null when unresolved. */
export function runTrade(cs: Candle[], i: number, long: boolean, entry: number, stop: number, target: number, horizon: number): number | null {
  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  for (let k = i + 1; k <= Math.min(cs.length - 1, i + horizon); k++) {
    if (long ? cs[k].l <= stop : cs[k].h >= stop) return -1;
    if (long ? cs[k].h >= target : cs[k].l <= target) return Math.abs(target - entry) / risk;
  }
  return null;
}

export interface EdgeGroup {
  candles: Candle[];
  setups: Setup[];
}

export interface EdgeStats {
  /** Setups that reached their stop or target. */
  n: number;
  winRate: number;
  avgR: number;
  /** Random entries with the same geometry. */
  baselineN: number;
  baselineWinRate: number;
  baselineAvgR: number;
  /** Setup minus random, in percentage points of win rate. */
  diffPts: number;
  /** One standard error of the setup's win rate, in percentage points. */
  sePts: number;
}

export type Verdict = 'TOO_FEW' | 'NO_EDGE' | 'BETTER' | 'WORSE';

/** Below this many resolved setups a result is mostly noise. */
export const MIN_SAMPLE = 30;

export function verdict(s: EdgeStats): Verdict {
  if (s.n < MIN_SAMPLE) return 'TOO_FEW';
  if (s.diffPts > 2 * s.sePts) return 'BETTER';
  if (s.diffPts < -2 * s.sePts) return 'WORSE';
  return 'NO_EDGE';
}

/** Small deterministic generator, so the same data always gives the same control. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function edgeCheck(groups: readonly EdgeGroup[], samplesPerSetup = 20, seed = 12345): EdgeStats {
  const rnd = lcg(seed);
  let n = 0, wins = 0, sumR = 0, bn = 0, bwins = 0, bsumR = 0;
  for (const { candles: cs, setups } of groups) {
    for (const s of setups) {
      const horizon = HORIZON[s.kind];
      const r = runTrade(cs, s.index, s.long, s.entry, s.stop, s.target, horizon);
      if (r === null) continue;
      n++;
      if (r > 0) wins++;
      sumR += r;
      const riskPct = Math.abs(s.entry - s.stop) / s.entry;
      const rewardPct = Math.abs(s.target - s.entry) / s.entry;
      if (cs.length < 40) continue;
      for (let k = 0; k < samplesPerSetup; k++) {
        const j = 24 + Math.floor(rnd() * (cs.length - 30));
        const e = cs[j].c;
        const stop = s.long ? e * (1 - riskPct) : e * (1 + riskPct);
        const tgt = s.long ? e * (1 + rewardPct) : e * (1 - rewardPct);
        const br = runTrade(cs, j, s.long, e, stop, tgt, horizon);
        if (br === null) continue;
        bn++;
        if (br > 0) bwins++;
        bsumR += br;
      }
    }
  }
  const winRate = n ? wins / n : 0;
  const baselineWinRate = bn ? bwins / bn : 0;
  return {
    n,
    winRate,
    avgR: n ? sumR / n : 0,
    baselineN: bn,
    baselineWinRate,
    baselineAvgR: bn ? bsumR / bn : 0,
    diffPts: (winRate - baselineWinRate) * 100,
    sePts: n ? Math.sqrt((winRate * (1 - winRate)) / n) * 100 : 0,
  };
}
