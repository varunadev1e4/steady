import { daysBetween, weekdayOf } from '@/features/habits/streaks';
import { addDaysISO, type ISODate } from '@/utils/dates';
import type { Step } from './content';

export interface PlanProgress {
  /** 1-based plan week, capped at the plan length. */
  week: number;
  /** First and last day of the current plan week (plan weeks start on the start date). */
  from: ISODate;
  to: ISODate;
  notStarted: boolean;
  finished: boolean;
}

export function planProgress(startDate: ISODate, today: ISODate, weeksTotal: number): PlanProgress {
  const days = daysBetween(startDate, today);
  if (days < 0) return { week: 1, from: startDate, to: addDaysISO(startDate, 6), notStarted: true, finished: false };
  const raw = Math.floor(days / 7) + 1;
  const week = Math.min(raw, weeksTotal);
  const from = addDaysISO(startDate, (week - 1) * 7);
  return { week, from, to: addDaysISO(from, 6), notStarted: false, finished: raw > weeksTotal };
}

/** Sessions done in a window: distinct days with a matching log (two short walks in a day count once). */
export function sessionsBetween(logDays: Iterable<ISODate>, from: ISODate, to: ISODate): number {
  const set = new Set<ISODate>();
  for (const d of logDays) if (d >= from && d <= to) set.add(d);
  return set.size;
}

export function isPlannedDay(weekdays: number[], day: ISODate): boolean {
  return weekdays.includes(weekdayOf(day));
}

/** Total timed minutes of a session (rep-based steps excluded). */
export function timedMinutes(steps: Step[]): number {
  return Math.round(steps.reduce((sum, s) => sum + (s.seconds ?? 0), 0) / 60);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const WEEKDAY_CHIPS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];
