import { useEffect, useRef, useState } from 'react';
import type { Candle } from '../../agent/setups';
import { fmtPrice } from '../lib/format';

export type LineTone = 'safe' | 'warn' | 'danger' | 'accent' | 'muted';

export interface ChartLine {
  price: number;
  label: string;
  tone: LineTone;
}

const COLOR: Record<LineTone, string> = {
  safe: 'rgb(var(--safe))',
  warn: 'rgb(var(--warn))',
  danger: 'rgb(var(--danger))',
  accent: 'rgb(var(--accent-ink))',
  muted: 'rgb(var(--muted))',
};

const PAD = { top: 10, right: 76, bottom: 22, left: 8 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(Math.max(280, Math.floor(el.clientWidth)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const dayMonth = (t: number) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });

/**
 * Candlesticks with horizontal price lines on top (entry, trim, close, liquidation, stop, target).
 * Lines far outside the candles' range are left off so they don't flatten the chart; the count is shown below.
 */
export function CandleChart({
  candles,
  lines = [],
  highlightT,
  zone,
  height = 260,
  label,
}: {
  candles: Candle[];
  lines?: ChartLine[];
  /** Open time of a candle to mark, e.g. the one a setup formed on. */
  highlightT?: number;
  /** Shaded risk (stop to entry) and reward (entry to target) bands for a setup. */
  zone?: { entry: number; stop: number; target: number };
  height?: number;
  label: string;
}) {
  const { ref, width } = useWidth();
  if (candles.length < 2) {
    return (
      <div ref={ref} className="flex items-center justify-center border border-border text-sm text-muted" style={{ height }}>
        No candles to draw yet.
      </div>
    );
  }

  const lo = Math.min(...candles.map((c) => c.l));
  const hi = Math.max(...candles.map((c) => c.h));
  const span = hi - lo || hi * 0.01 || 1;
  const reach = [...lines.map((l) => l.price), ...(zone ? [zone.stop, zone.target, zone.entry] : [])];
  const near = (p: number) => p >= lo - span * 0.6 && p <= hi + span * 0.6;
  const shown = lines.filter((l) => near(l.price));
  const hidden = lines.length - shown.length;
  const inView = reach.filter(near);
  const min = Math.min(lo, ...inView);
  const max = Math.max(hi, ...inView);
  const pad = (max - min) * 0.06 || 1;
  const y0 = min - pad;
  const y1 = max + pad;

  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i + 0.5) * (w / candles.length);
  const y = (p: number) => PAD.top + (1 - (p - y0) / (y1 - y0)) * h;
  const bw = Math.max(1.5, Math.min(14, (w / candles.length) * 0.65));

  const grid = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.min(candles.length - 1, Math.round(f * (candles.length - 1))));
  const multiDay = candles[candles.length - 1].t - candles[0].t > 36 * 3_600_000;
  const hi_i = highlightT === undefined ? -1 : candles.findIndex((c) => c.t === highlightT);

  // Keep price tags from landing on top of each other.
  const tagged = [...shown].sort((a, b) => y(a.price) - y(b.price));
  const tagY: number[] = [];
  tagged.forEach((l, i) => tagY.push(Math.max(y(l.price), i ? tagY[i - 1] + 13 : 0)));

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img" aria-label={label} className="num block select-none text-[10px]">
        {grid.map((p) => (
          <g key={p}>
            <line x1={PAD.left} x2={PAD.left + w} y1={y(p)} y2={y(p)} stroke="rgb(var(--border))" strokeWidth="1" opacity="0.5" />
            <text x={PAD.left + w + 6} y={y(p) + 3} fill="rgb(var(--muted))">{fmtPrice(p)}</text>
          </g>
        ))}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fill="rgb(var(--muted))">
            {multiDay ? dayMonth(candles[i].t) : hhmm(candles[i].t)}
          </text>
        ))}

        {zone && (
          <>
            <rect x={PAD.left} width={w} y={Math.min(y(zone.entry), y(zone.target))} height={Math.abs(y(zone.target) - y(zone.entry))} fill="rgb(var(--safe))" opacity="0.1" />
            <rect x={PAD.left} width={w} y={Math.min(y(zone.entry), y(zone.stop))} height={Math.abs(y(zone.stop) - y(zone.entry))} fill="rgb(var(--danger))" opacity="0.1" />
          </>
        )}
        {hi_i >= 0 && <rect x={x(hi_i) - bw} width={bw * 2} y={PAD.top} height={h} fill="rgb(var(--accent-ink))" opacity="0.14" />}

        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const col = up ? 'rgb(var(--safe))' : 'rgb(var(--danger))';
          const top = y(Math.max(c.o, c.c));
          return (
            <g key={c.t}>
              <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth="1" />
              <rect x={x(i) - bw / 2} y={top} width={bw} height={Math.max(1, y(Math.min(c.o, c.c)) - top)} fill={col} />
            </g>
          );
        })}

        {tagged.map((l, i) => (
          <g key={l.label}>
            <line x1={PAD.left} x2={PAD.left + w} y1={y(l.price)} y2={y(l.price)} stroke={COLOR[l.tone]} strokeWidth="1.25" strokeDasharray="5 4" />
            <rect x={PAD.left + w + 2} y={tagY[i] - 7} width={PAD.right - 4} height="13" fill={COLOR[l.tone]} />
            <text x={PAD.left + w + 5} y={tagY[i] + 3} fill="rgb(var(--bg))" className="font-semibold">{l.label}</text>
          </g>
        ))}
      </svg>
      {hidden > 0 && (
        <p className="mt-1 text-xs text-muted">
          {hidden === 1 ? '1 line is' : `${hidden} lines are`} too far from the price to fit on this chart.
        </p>
      )}
    </div>
  );
}
