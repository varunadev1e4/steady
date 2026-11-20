import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { useChartColors } from './chartColors';

/**
 * Single-series charts in Steady's style: 2px lines, rounded bar ends,
 * recessive grid, a hover tooltip, theme colours in both modes. One series
 * per chart, so the card title names it and there's no legend box.
 */

export interface Point {
  x: string;
  y: number | null;
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: TooltipProps<number, string> & { format: (v: number) => string }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div className="rounded-input border border-border bg-surface px-3 py-2 text-sm shadow-lift">
      <p className="text-muted">{label}</p>
      <p className="font-semibold tabular-nums text-ink">{format(Number(payload[0].value))}</p>
    </div>
  );
}

const tick = { fontSize: 12 };

/** Compact y-axis labels so large values (steps) fit: 8000 → 8k. */
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

export function LineSeries({
  data,
  label,
  domain,
  format = (v) => String(v),
  height = 180,
  tickFormat,
  target,
  yFormat = compact,
}: {
  data: Point[];
  label: string;
  domain?: [number | 'auto', number | 'auto'];
  format?: (v: number) => string;
  height?: number;
  tickFormat?: (x: string) => string;
  /** Draws a dashed, labelled target line. */
  target?: number | null;
  /** Y-axis tick labels (default: compact numbers). */
  yFormat?: (v: number) => string;
}) {
  const c = useChartColors();
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={c.grid} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="x" tick={{ ...tick, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.grid }} tickFormatter={tickFormat} minTickGap={24} />
          <YAxis domain={domain ?? ['auto', 'auto']} tick={{ ...tick, fill: c.axis }} tickLine={false} axisLine={false} width={yFormat === compact ? 44 : 56} tickFormatter={yFormat} allowDecimals />
          <Tooltip content={<ChartTooltip format={format} />} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
          {target != null && targetLine(target, c.axis)}
          <Line
            type="monotone"
            dataKey="y"
            stroke={c.series}
            strokeWidth={2}
            dot={data.filter((d) => d.y != null).length < 20 ? { r: 3, fill: c.series, stroke: c.surface, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: c.series, stroke: c.surface, strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarSeries({
  data,
  label,
  format = (v) => String(v),
  height = 180,
  tone = 'series',
  tickFormat,
  target,
  interval = 0,
}: {
  data: Point[];
  label: string;
  format?: (v: number) => string;
  height?: number;
  tone?: 'series' | 'second';
  tickFormat?: (x: string) => string;
  target?: number | null;
  /** Tick label interval; 'preserveStartEnd' suits long daily series. */
  interval?: number | 'preserveStartEnd';
}) {
  const c = useChartColors();
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="25%">
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="x" tick={{ ...tick, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.grid }} tickFormatter={tickFormat} interval={interval} minTickGap={8} />
          <YAxis tick={{ ...tick, fill: c.axis }} tickLine={false} axisLine={false} width={44} tickFormatter={compact} allowDecimals={false} />
          <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
          {target != null && targetLine(target, c.axis)}
          <Bar dataKey="y" fill={tone === 'series' ? c.series : c.second} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A dashed, labelled target line. Returned as a ReferenceLine element (Recharts ignores wrapper components). */
function targetLine(y: number, color: string) {
  return (
    <ReferenceLine
      y={y}
      stroke={color}
      strokeDasharray="4 4"
      strokeWidth={1}
      ifOverflow="extendDomain"
      label={{ value: `Target ${y.toLocaleString()}`, position: 'insideTopLeft', fill: color, fontSize: 11 }}
    />
  );
}

export interface MultiPoint {
  x: string;
  [key: string]: string | number | null;
}

/**
 * Two series on one axis (same unit), e.g. systolic and diastolic blood
 * pressure. Validated colour pair, the second line dashed as a non-colour
 * cue, and a legend above the plot.
 */
export function TwoLineSeries({
  data,
  label,
  series,
  format = (v) => String(v),
  height = 200,
}: {
  data: MultiPoint[];
  label: string;
  series: [{ key: string; label: string }, { key: string; label: string }];
  format?: (v: number) => string;
  height?: number;
}) {
  const c = useChartColors();
  const colors = [c.c1, c.c2];
  return (
    <div>
      <ul className="mb-2 flex gap-4 text-xs text-muted" aria-hidden>
        {series.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" y1="3" x2="18" y2="3" stroke={colors[i]} strokeWidth="2" strokeDasharray={i === 1 ? '4 3' : undefined} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      <div role="img" aria-label={label} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="x" tick={{ ...tick, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={24} />
            <YAxis domain={['auto', 'auto']} tick={{ ...tick, fill: c.axis }} tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
            <Tooltip
              cursor={{ stroke: c.axis, strokeWidth: 1 }}
              content={({ active, payload, label: l }) =>
                active && payload?.length ? (
                  <div className="rounded-input border border-border bg-surface px-3 py-2 text-sm shadow-lift">
                    <p className="text-muted">{l}</p>
                    {payload.map((p, i) => (
                      <p key={String(p.dataKey)} className="tabular-nums text-ink">
                        {series[i]?.label}: <span className="font-semibold">{p.value == null ? '–' : format(Number(p.value))}</span>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={colors[i]}
                strokeWidth={2}
                strokeDasharray={i === 1 ? '6 4' : undefined}
                dot={data.length < 20 ? { r: 3, fill: colors[i], stroke: c.surface, strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: colors[i], stroke: c.surface, strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Wraps a chart with its title, a caption and an honest empty state. */
export function ChartCard({
  title,
  caption,
  empty,
  emptyText = 'Not enough data yet.',
  children,
}: {
  title: string;
  caption?: ReactNode;
  empty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <h2 className="text-base">{title}</h2>
      {caption && <p className="mt-0.5 text-sm text-muted">{caption}</p>}
      <div className="mt-3">
        {empty ? <p className="py-8 text-center text-sm text-muted">{emptyText}</p> : children}
      </div>
    </section>
  );
}
