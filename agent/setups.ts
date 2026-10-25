/**
 * Chart setups on plain candles: Turtle Soup and CRT (candle range theory).
 *
 * These are mechanical readings of both ideas, so they can be counted and tested:
 *  - Turtle Soup: price takes out the last 20-bar high or low (whose previous extreme is at least 4 bars
 *    old) and closes back inside. Trade the reversal with a stop at the new extreme and a 2R target.
 *  - CRT: candle 2 sweeps one side of candle 1's range and closes back inside it. Trade towards the other
 *    side of candle 1 with a stop at the sweep extreme.
 *
 * Detection happens on closed candles only. No claim is made that either setup has an edge: see edge.ts.
 */

export interface Candle {
  /** Open time, ms. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type SetupKind = 'TURTLE_SOUP' | 'CRT';

export const SETUP_LABEL: Record<SetupKind, string> = { TURTLE_SOUP: 'Turtle Soup', CRT: 'CRT' };

/** How many candles after entry a trade has to reach its target before we stop counting it. */
export const HORIZON: Record<SetupKind, number> = { TURTLE_SOUP: 24, CRT: 6 };

export interface Setup {
  kind: SetupKind;
  /** Index of the candle whose close completes the setup. */
  index: number;
  /** Open time of that candle, ms. */
  time: number;
  long: boolean;
  entry: number;
  stop: number;
  target: number;
  /** Reward over risk. */
  rr: number;
}

const make = (kind: SetupKind, cs: Candle[], index: number, long: boolean, entry: number, stop: number, target: number): Setup | null => {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  if (!(risk > 0) || !(reward > 0)) return null;
  return { kind, index, time: cs[index].t, long, entry, stop, target, rr: reward / risk };
};

export function turtleSoup(cs: Candle[], lookback = 20, minGap = 4): Setup[] {
  const out: Setup[] = [];
  for (let i = lookback + minGap; i < cs.length; i++) {
    const window = cs.slice(i - lookback, i);
    const low = Math.min(...window.map((x) => x.l));
    const high = Math.max(...window.map((x) => x.h));
    const lowAt = i - lookback + window.findIndex((x) => x.l === low);
    const highAt = i - lookback + window.findIndex((x) => x.h === high);
    const bar = cs[i];
    let s: Setup | null = null;
    if (bar.l < low && i - lowAt >= minGap && bar.c > low) s = make('TURTLE_SOUP', cs, i, true, bar.c, bar.l, bar.c + 2 * (bar.c - bar.l));
    else if (bar.h > high && i - highAt >= minGap && bar.c < high) s = make('TURTLE_SOUP', cs, i, false, bar.c, bar.h, bar.c - 2 * (bar.h - bar.c));
    if (s) out.push(s);
  }
  return out;
}

export function crt(cs: Candle[]): Setup[] {
  const out: Setup[] = [];
  for (let i = 1; i < cs.length; i++) {
    const a = cs[i - 1];
    const b = cs[i];
    let s: Setup | null = null;
    if (b.l < a.l && b.c > a.l && b.c < a.h) s = make('CRT', cs, i, true, b.c, b.l, a.h);
    else if (b.h > a.h && b.c < a.h && b.c > a.l) s = make('CRT', cs, i, false, b.c, b.h, a.l);
    if (s) out.push(s);
  }
  return out;
}

export function findSetups(cs: Candle[], kinds: readonly SetupKind[]): Setup[] {
  const out: Setup[] = [];
  if (kinds.includes('TURTLE_SOUP')) out.push(...turtleSoup(cs));
  if (kinds.includes('CRT')) out.push(...crt(cs));
  return out.sort((x, y) => x.index - y.index);
}

/** Drop a still-forming last candle, so a setup never flickers in and out as it fills in. */
export function closedCandles(cs: Candle[], tfMs: number, now = Date.now()): Candle[] {
  return cs.length > 0 && cs[cs.length - 1].t + tfMs > now ? cs.slice(0, -1) : cs;
}

export type Session = 'ALL' | 'ASIA' | 'LONDON' | 'NEW_YORK';

/** UTC hours, start inclusive, end exclusive. Sessions overlap on purpose, like the usual "killzones". */
export const SESSION_HOURS: Record<Exclude<Session, 'ALL'>, [number, number]> = { ASIA: [0, 8], LONDON: [7, 16], NEW_YORK: [12, 21] };
export const SESSION_LABEL: Record<Session, string> = { ALL: 'Any time', ASIA: 'Asia (00 to 08 UTC)', LONDON: 'London (07 to 16 UTC)', NEW_YORK: 'New York (12 to 21 UTC)' };

export interface Filters {
  session: Session;
  /** Keep only setups with at least this reward over risk. */
  minRR: number;
}

export const NO_FILTERS: Filters = { session: 'ALL', minRR: 0 };

export function applyFilters(setups: Setup[], f: Filters): Setup[] {
  return setups.filter((s) => {
    if (s.rr < f.minRR) return false;
    if (f.session === 'ALL') return true;
    const hour = new Date(s.time).getUTCHours();
    const [from, to] = SESSION_HOURS[f.session];
    return hour >= from && hour < to;
  });
}
