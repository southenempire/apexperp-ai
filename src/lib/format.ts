import { formatUnits } from 'viem';

/** Raw bigint to a display number, keeping `maxFraction` significant decimals for small values. */
export function toNumber(raw: bigint, decimals: number): number {
  return Number(formatUnits(raw, decimals));
}

export function fmtUsd(value: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  const text = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits });
  const sign = value < 0 ? '-' : opts.sign && value > 0 ? '+' : '';
  return `${sign}$${text}`;
}

export function fmtPrice(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 8;
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function fmtQty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function fmtPct(value: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
