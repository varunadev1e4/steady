import type { ISODate } from '@/utils/dates';

/**
 * Plain-arithmetic patterns in the user's own data (no AI, no statistics
 * beyond averages). A group is only reported when it has at least
 * MIN_DAYS days, otherwise it says "not enough data yet". These are
 * correlations, never proof of cause.
 */
export const MIN_DAYS = 7;

export interface DayRecord {
  day: ISODate;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  worked_out: boolean;
  journaled: boolean;
}

export interface GroupStat {
  label: string;
  n: number;
  /** Average, or null when n < MIN_DAYS. */
  mean: number | null;
}

export interface Comparison {
  groups: [GroupStat, GroupStat];
  /** True only when both groups have enough days. */
  enough: boolean;
  /** groups[0].mean - groups[1].mean when enough. */
  difference: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function stat(label: string, values: number[]): GroupStat {
  const n = values.length;
  return { label, n, mean: n >= MIN_DAYS ? round2(values.reduce((a, b) => a + b, 0) / n) : null };
}

export function compareGroups(
  days: DayRecord[],
  metric: 'mood' | 'energy',
  inGroup: (d: DayRecord) => boolean,
  labels: [string, string],
): Comparison {
  const yes: number[] = [];
  const no: number[] = [];
  for (const d of days) {
    const v = d[metric];
    if (v == null) continue;
    (inGroup(d) ? yes : no).push(v);
  }
  const groups: [GroupStat, GroupStat] = [stat(labels[0], yes), stat(labels[1], no)];
  const enough = groups[0].mean != null && groups[1].mean != null;
  return { groups, enough, difference: enough ? round2(groups[0].mean! - groups[1].mean!) : null };
}

export const SLEEP_BUCKETS = [
  { key: 'lt6', label: 'Under 6h', test: (h: number) => h < 6 },
  { key: '6to7', label: '6–7h', test: (h: number) => h >= 6 && h < 7 },
  { key: '7to8', label: '7–8h', test: (h: number) => h >= 7 && h <= 8 },
  { key: 'gt8', label: 'Over 8h', test: (h: number) => h > 8 },
] as const;

export function moodBySleep(days: DayRecord[]): Array<GroupStat & { key: string }> {
  return SLEEP_BUCKETS.map((b) => {
    const values = days
      .filter((d) => d.mood != null && d.sleep_hours != null && b.test(d.sleep_hours))
      .map((d) => d.mood!);
    return { key: b.key, ...stat(b.label, values) };
  });
}

/** Builds one record per check-in day from the three data sources. */
export function buildDayRecords(
  checkIns: Array<{ day: ISODate; mood: number | null; energy: number | null; sleep_hours: number | null }>,
  workoutDays: Iterable<ISODate>,
  journalDays: Iterable<ISODate>,
): DayRecord[] {
  const w = new Set(workoutDays);
  const j = new Set(journalDays);
  return checkIns.map((c) => ({
    day: c.day,
    mood: c.mood,
    energy: c.energy,
    sleep_hours: c.sleep_hours == null ? null : Number(c.sleep_hours),
    worked_out: w.has(c.day),
    journaled: j.has(c.day),
  }));
}
