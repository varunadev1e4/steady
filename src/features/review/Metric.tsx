import type { ReactNode } from 'react';

const fmt = (n: number, digits = 1) => {
  const r = Math.round(Number(n) * 10 ** digits) / 10 ** digits;
  return Math.abs(r) >= 1000 ? Math.round(r).toLocaleString() : String(r);
};

/** A stat with a neutral comparison to the previous period. */
export function Metric({
  label,
  value,
  previous,
  unit = '',
  periodName = 'last week',
}: {
  label: string;
  value: number | null;
  previous: number | null;
  unit?: string;
  periodName?: string;
}) {
  let change: ReactNode = null;
  if (value != null && previous != null) {
    const d = Math.round((Number(value) - Number(previous)) * 10) / 10;
    change = d === 0 ? `same as ${periodName}` : `${d > 0 ? '+' : ''}${fmt(d)}${unit} vs ${periodName}`;
  } else if (previous == null && value != null) {
    change = `no data ${periodName}`;
  }
  return (
    <div className="rounded-input border border-border bg-surface px-3 py-2.5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value == null ? '–' : `${fmt(value)}${unit}`}</p>
      {change && <p className="text-xs text-muted">{change}</p>}
    </div>
  );
}
