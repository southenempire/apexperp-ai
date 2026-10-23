/**
 * Horizontal health scale with the Sentinel's trigger zones. 1.0x is liquidation.
 * Piecewise scale: the zones that matter (liquidation to trim) get most of the width.
 */

export function zoneOf(ratio: number | null, t: { reduceBelowHealth: number; flattenBelowHealth: number }) {
  if (ratio === null) return 'flat' as const;
  if (ratio <= 1) return 'liquidation' as const;
  if (ratio <= t.flattenBelowHealth) return 'flatten' as const;
  if (ratio <= t.reduceBelowHealth) return 'trim' as const;
  return 'safe' as const;
}

export const ZONE_STYLE = {
  flat: { text: 'text-muted', label: 'No open positions' },
  safe: { text: 'text-safe', label: 'Safe' },
  trim: { text: 'text-warn', label: 'Trim zone' },
  flatten: { text: 'text-danger', label: 'Close zone' },
  liquidation: { text: 'text-danger', label: 'Liquidatable' },
} as const;

function scale(t: { reduceBelowHealth: number; flattenBelowHealth: number }) {
  // [ratio, percent of width] anchors; values between anchors interpolate linearly.
  const anchors: [number, number][] = [
    [0.8, 0],
    [1, 12],
    [t.flattenBelowHealth, 32],
    [t.reduceBelowHealth, 56],
    [Math.max(4, t.reduceBelowHealth * 2), 100],
  ];
  return (v: number) => {
    if (v <= anchors[0][0]) return 0;
    for (let i = 1; i < anchors.length; i++) {
      const [x1, p1] = anchors[i];
      const [x0, p0] = anchors[i - 1];
      if (v <= x1) return p0 + ((v - x0) / (x1 - x0)) * (p1 - p0);
    }
    return 100;
  };
}

export function HealthMeter({ ratio, reduceBelowHealth, flattenBelowHealth }: { ratio: number | null; reduceBelowHealth: number; flattenBelowHealth: number }) {
  const s = scale({ reduceBelowHealth, flattenBelowHealth });
  const at = (v: number) => `${s(v)}%`;
  const ticks: [number, string][] = [
    [1, '1.00x'],
    [flattenBelowHealth, `${flattenBelowHealth.toFixed(2)}x`],
    [reduceBelowHealth, `${reduceBelowHealth.toFixed(2)}x`],
  ];

  return (
    <div>
      <div className="relative">
        <div
          className="relative h-3 overflow-hidden rounded-full"
          role="meter"
          aria-label="Account health"
          aria-valuemin={0.8}
          aria-valuemax={4}
          aria-valuenow={ratio ?? undefined}
          aria-valuetext={ratio === null ? 'No positions' : `${ratio.toFixed(2)} times maintenance margin`}
        >
          <div className="absolute inset-y-0 left-0 bg-danger/80" style={{ width: at(1) }} />
          <div className="absolute inset-y-0 bg-danger/40" style={{ left: at(1), width: `${s(flattenBelowHealth) - s(1)}%` }} />
          <div className="absolute inset-y-0 bg-warn/45" style={{ left: at(flattenBelowHealth), width: `${s(reduceBelowHealth) - s(flattenBelowHealth)}%` }} />
          <div className="absolute inset-y-0 right-0 bg-safe/35" style={{ left: at(reduceBelowHealth) }} />
        </div>
        {ratio !== null && (
          <span
            className="absolute -top-2 h-7 w-1.5 -translate-x-1/2 rounded-full bg-fg shadow-[0_0_0_3px_rgb(var(--surface))] transition-[left] duration-500 ease-out"
            style={{ left: at(ratio) }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="num relative mt-2 h-4 text-[11px] text-muted" aria-hidden="true">
        {ticks.map(([v, text]) => (
          <span key={text + v} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: at(v) }}>
            {text}
          </span>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {[
          ['bg-danger/80', 'Liquidation'],
          ['bg-danger/40', 'Close all'],
          ['bg-warn/45', 'Trim'],
          ['bg-safe/35', 'Safe'],
        ].map(([c, l]) => (
          <li key={l} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${c}`} aria-hidden="true" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
