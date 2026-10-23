/**
 * Segmented LED bar for account health with the Sentinel's trip points.
 * 1.0x is liquidation. Piecewise scale so the zones that matter get most of the width.
 */

export function zoneOf(ratio: number | null, t: { reduceBelowHealth: number; flattenBelowHealth: number }) {
  if (ratio === null) return 'flat' as const;
  if (ratio <= 1) return 'liquidation' as const;
  if (ratio <= t.flattenBelowHealth) return 'flatten' as const;
  if (ratio <= t.reduceBelowHealth) return 'trim' as const;
  return 'safe' as const;
}

export const ZONE_STYLE = {
  flat: { text: 'text-muted', label: 'Nothing open' },
  safe: { text: 'text-safe', label: "You're fine" },
  trim: { text: 'text-warn', label: 'Trimming' },
  flatten: { text: 'text-danger', label: 'Closing everything' },
  liquidation: { text: 'text-danger', label: 'Can be liquidated' },
} as const;

const SEGMENTS = 32;

function scale(t: { reduceBelowHealth: number; flattenBelowHealth: number }) {
  // [ratio, fraction of width] anchors, interpolated linearly in between.
  const anchors: [number, number][] = [
    [0.8, 0],
    [1, 0.125],
    [t.flattenBelowHealth, 0.3125],
    [t.reduceBelowHealth, 0.5625],
    [Math.max(4, t.reduceBelowHealth * 2), 1],
  ];
  const toFrac = (v: number) => {
    if (v <= anchors[0][0]) return 0;
    for (let i = 1; i < anchors.length; i++) {
      const [x1, p1] = anchors[i];
      const [x0, p0] = anchors[i - 1];
      if (v <= x1) return p0 + ((v - x0) / (x1 - x0)) * (p1 - p0);
    }
    return 1;
  };
  const fromFrac = (f: number) => {
    for (let i = 1; i < anchors.length; i++) {
      const [x1, p1] = anchors[i];
      const [x0, p0] = anchors[i - 1];
      if (f <= p1) return x0 + ((f - p0) / (p1 - p0)) * (x1 - x0);
    }
    return anchors[anchors.length - 1][0];
  };
  return { toFrac, fromFrac };
}

export function HealthMeter({ ratio, reduceBelowHealth, flattenBelowHealth }: { ratio: number | null; reduceBelowHealth: number; flattenBelowHealth: number }) {
  const t = { reduceBelowHealth, flattenBelowHealth };
  const { toFrac, fromFrac } = scale(t);
  const lit = ratio === null ? 0 : Math.max(1, Math.round(toFrac(ratio) * SEGMENTS));
  const zone = zoneOf(ratio, t);
  const litColor = { flat: 'bg-muted', safe: 'bg-safe', trim: 'bg-warn', flatten: 'bg-danger', liquidation: 'bg-danger' }[zone];

  return (
    <div>
      <div
        className="flex h-9 gap-[3px]"
        role="meter"
        aria-label="Account health"
        aria-valuemin={0.8}
        aria-valuemax={4}
        aria-valuenow={ratio ?? undefined}
        aria-valuetext={ratio === null ? 'No open positions' : `${ratio.toFixed(2)} times maintenance margin`}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const mid = fromFrac((i + 0.5) / SEGMENTS);
          const on = i < lit;
          if (mid <= 1) return <span key={i} className={`hazard flex-1 ${on ? '' : 'opacity-35'}`} />;
          const off = mid <= flattenBelowHealth ? 'bg-danger/15' : mid <= reduceBelowHealth ? 'bg-warn/15' : 'bg-fg/10';
          return <span key={i} className={`flex-1 transition-colors duration-300 ${on ? litColor : off}`} />;
        })}
      </div>
      <div className="num relative mt-2 h-4 text-[11px] text-muted" aria-hidden="true">
        {(
          [
            [1, 'LIQ'],
            [flattenBelowHealth, 'CLOSE'],
            [reduceBelowHealth, 'TRIM'],
          ] as const
        ).map(([v, word]) => (
          <span key={word} className="absolute whitespace-nowrap border-l border-muted/60 pl-1" style={{ left: `${toFrac(v) * 100}%` }}>
            <span className="hidden sm:inline">{word} </span>
            {v.toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  );
}
