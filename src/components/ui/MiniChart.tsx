/**
 * Tiny glanceable charts for dashboard tiles. One series, in the accent colour;
 * today's mark is solid and earlier days are lighter. Each mark has a native
 * tooltip, and `summary` is read out to screen readers instead of the drawing.
 */

export interface MiniPoint {
  label: string; // e.g. "Mon 18 Nov"
  value: number | null;
}

const W = 140;
const H = 44;

export function MiniBars({
  points,
  max,
  target,
  format,
  summary,
}: {
  points: MiniPoint[];
  max?: number;
  target?: number | null;
  format: (v: number) => string;
  summary: string;
}) {
  const values = points.map((p) => p.value ?? 0);
  const top = Math.max(max ?? 0, target ?? 0, ...values, 1);
  const gap = 4;
  const bw = (W - gap * (points.length - 1)) / points.length;
  const y = (v: number) => H - (v / top) * (H - 2);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
        {target != null && target > 0 && (
          <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="rgb(var(--outline))" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        )}
        {points.map((p, i) => {
          const x = i * (bw + gap);
          const last = i === points.length - 1;
          if (p.value == null || p.value <= 0) {
            return (
              <rect key={i} x={x} y={H - 3} width={bw} height={3} rx={1.5} fill="rgb(var(--border))">
                <title>{`${p.label}: nothing logged`}</title>
              </rect>
            );
          }
          const h = Math.max(4, H - y(p.value));
          return (
            <rect
              key={i}
              x={x}
              y={H - h}
              width={bw}
              height={h}
              rx={Math.min(4, bw / 2)}
              fill="rgb(var(--accent-strong))"
              opacity={last ? 1 : 0.45}
              className="transition-all duration-500"
            >
              <title>{`${p.label}: ${format(p.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

export function MiniLine({ points, format, summary }: { points: MiniPoint[]; format: (v: number) => string; summary: string }) {
  const known = points.map((p, i) => ({ ...p, i })).filter((p): p is MiniPoint & { i: number; value: number } => p.value != null);
  if (known.length === 0) return null;
  const lo = Math.min(...known.map((p) => p.value));
  const hi = Math.max(...known.map((p) => p.value));
  const span = Math.max(hi - lo, 0.5);
  const pad = 6;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - pad * 2);
  const d = known.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const end = known[known.length - 1];

  return (
    <figure className="relative m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
        <path d={`${d} L${x(end.i)},${H} L${x(known[0].i)},${H} Z`} fill="rgb(var(--accent-strong))" opacity={0.08} />
        <path d={d} fill="none" stroke="rgb(var(--accent-strong))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Markers are HTML so they stay round when the chart stretches to the tile width. */}
      {known.map((p) => (
        <span
          key={p.i}
          title={`${p.label}: ${format(p.value)}`}
          aria-hidden
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${(x(p.i) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }}
        />
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-strong ring-2 ring-panel"
        style={{ left: `${(x(end.i) / W) * 100}%`, top: `${(y(end.value) / H) * 100}%` }}
      />
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
