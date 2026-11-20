import { addDays, differenceInCalendarDays, getDay, startOfWeek } from 'date-fns';
import type { HabitRow } from '@/types/database';
import { addDaysISO, parseISODate, toISODate, type ISODate } from '@/utils/dates';

/**
 * Habit maths. Everything works on calendar days ('yyyy-MM-dd') already
 * computed in the user's time zone, so these functions never touch clocks.
 *
 * Rules
 * - daily: due every day from the start date.
 * - weekdays: due on the chosen weekdays (0 = Sunday).
 * - weekly: N completions per week (any days); streaks count weeks.
 * - Today (or the current week) is "pending" until it's over: not doing it
 *   yet never breaks a streak.
 * - Grace (optional, per habit): one missed due day is forgiven, at most once
 *   every 7 days. For weekly habits, one missed week at most once every 4
 *   weeks. Forgiven periods don't add to the streak; they just don't end it.
 * - Backfilled completions count exactly like on-time ones. A completion
 *   earlier than the start date moves the effective start back to it.
 */

export type HabitRules = Pick<HabitRow, 'frequency' | 'weekdays' | 'times_per_week' | 'grace_enabled' | 'start_date'>;
export type WeekStart = 0 | 1;

export const GRACE_DAYS = 7;
export const GRACE_WEEKS = 4;
export const BACKFILL_DAYS = 14;

export function weekdayOf(day: ISODate): number {
  return getDay(parseISODate(day));
}

export function weekStartOf(day: ISODate, weekStart: WeekStart): ISODate {
  return toISODate(startOfWeek(parseISODate(day), { weekStartsOn: weekStart }));
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISODate(to), parseISODate(from));
}

/** Whether a daily/weekdays habit is scheduled on this day. Weekly habits can be done any day. */
export function isScheduledOn(habit: HabitRules, day: ISODate): boolean {
  if (habit.frequency === 'weekdays') return habit.weekdays.includes(weekdayOf(day));
  return true;
}

export function effectiveStart(habit: HabitRules, done: ReadonlySet<ISODate>): ISODate {
  let start = habit.start_date;
  for (const d of done) if (d < start) start = d;
  return start;
}

function eachDay(from: ISODate, to: ISODate, fn: (day: ISODate, index: number) => boolean | void): void {
  let cur = parseISODate(from);
  const end = parseISODate(to);
  let i = 0;
  while (cur <= end) {
    if (fn(toISODate(cur), i) === false) return;
    cur = addDays(cur, 1);
    i++;
  }
}

export interface StreakResult {
  current: number;
  best: number;
  unit: 'day' | 'week';
}

export function computeStreaks(
  habit: HabitRules,
  completedDays: Iterable<ISODate>,
  today: ISODate,
  weekStart: WeekStart,
): StreakResult {
  const done = new Set(completedDays);
  const start = effectiveStart(habit, done);
  if (start > today) return { current: 0, best: 0, unit: habit.frequency === 'weekly' ? 'week' : 'day' };

  if (habit.frequency === 'weekly') return weeklyStreaks(habit, done, start, today, weekStart);

  let run = 0;
  let best = 0;
  let lastGrace = -Infinity;
  eachDay(start, today, (day, index) => {
    if (!isScheduledOn(habit, day)) return;
    const isDone = done.has(day);
    if (day === today && !isDone) return false; // pending
    if (isDone) {
      run++;
      best = Math.max(best, run);
    } else if (habit.grace_enabled && run > 0 && index - lastGrace >= GRACE_DAYS) {
      lastGrace = index; // forgiven: streak continues
    } else {
      run = 0;
    }
  });
  return { current: run, best, unit: 'day' };
}

function weeklyStreaks(
  habit: HabitRules,
  done: ReadonlySet<ISODate>,
  start: ISODate,
  today: ISODate,
  weekStart: WeekStart,
): StreakResult {
  const target = habit.times_per_week ?? 1;
  const firstWeek = weekStartOf(start, weekStart);
  const currentWeek = weekStartOf(today, weekStart);
  let run = 0;
  let best = 0;
  let lastGrace = -Infinity;

  for (let week = firstWeek, index = 0; week <= currentWeek; week = addDaysISO(week, 7), index++) {
    let count = 0;
    for (let i = 0; i < 7; i++) if (done.has(addDaysISO(week, i))) count++;
    const met = count >= target;
    if (week === currentWeek && !met) break; // pending
    if (met) {
      run++;
      best = Math.max(best, run);
    } else if (week === firstWeek) {
      // A habit started part-way through a week isn't penalised for it.
    } else if (habit.grace_enabled && run > 0 && index - lastGrace >= GRACE_WEEKS) {
      lastGrace = index;
    } else {
      run = 0;
    }
  }
  return { current: run, best, unit: 'week' };
}

export interface Consistency {
  done: number;
  due: number;
  /** 0–100, or null when nothing was due in the range. */
  percent: number | null;
}

/** Share of due days (or weekly targets) met between two days, inclusive. Future days are ignored. */
export function consistency(
  habit: HabitRules,
  completedDays: Iterable<ISODate>,
  from: ISODate,
  to: ISODate,
  today: ISODate,
  weekStart: WeekStart,
): Consistency {
  const doneSet = new Set(completedDays);
  const start = effectiveStart(habit, doneSet);
  const lo = from > start ? from : start;
  const hi = to < today ? to : today;
  if (lo > hi) return { done: 0, due: 0, percent: null };

  let done = 0;
  let due = 0;
  if (habit.frequency === 'weekly') {
    const target = habit.times_per_week ?? 1;
    for (let week = weekStartOf(lo, weekStart); week <= hi; week = addDaysISO(week, 7)) {
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDaysISO(week, i);
        if (d >= lo && d <= hi && doneSet.has(d)) count++;
      }
      done += Math.min(count, target);
      due += target;
    }
  } else {
    eachDay(lo, hi, (day) => {
      if (!isScheduledOn(habit, day)) return;
      const isDone = doneSet.has(day);
      // Today only counts once it's done.
      if (day === today && !isDone) return;
      due++;
      if (isDone) done++;
    });
  }
  return { done, due, percent: due === 0 ? null : Math.round((done / due) * 100) };
}

/** Completions so far in the current week (for weekly habits). */
export function weekProgress(
  completedDays: Iterable<ISODate>,
  today: ISODate,
  weekStart: WeekStart,
): number {
  const ws = weekStartOf(today, weekStart);
  const we = addDaysISO(ws, 6);
  let n = 0;
  for (const d of completedDays) if (d >= ws && d <= we) n++;
  return n;
}

/** Whether the habit belongs on today's list. */
export function isDueToday(
  habit: HabitRules,
  completedDays: ReadonlySet<ISODate>,
  today: ISODate,
  weekStart: WeekStart,
): boolean {
  if (habit.frequency !== 'weekly') return isScheduledOn(habit, today);
  if (completedDays.has(today)) return true; // keep it visible so it can be undone
  return weekProgress(completedDays, today, weekStart) < (habit.times_per_week ?? 1);
}

export type DayStatus = 'done' | 'missed' | 'off' | 'pending' | 'future' | 'before';

/** Status for each day of a month grid ('yyyy-MM'). */
export function monthStatuses(
  habit: HabitRules,
  completedDays: ReadonlySet<ISODate>,
  month: string,
  today: ISODate,
): Array<{ day: ISODate; status: DayStatus }> {
  const first = `${month}-01`;
  const start = effectiveStart(habit, completedDays);
  const out: Array<{ day: ISODate; status: DayStatus }> = [];
  for (let d = first; d.startsWith(month); d = addDaysISO(d, 1)) {
    let status: DayStatus;
    if (completedDays.has(d)) status = 'done';
    else if (d > today) status = 'future';
    else if (d < start) status = 'before';
    else if (d === today) status = 'pending';
    else if (habit.frequency === 'weekly' || !isScheduledOn(habit, d)) status = 'off';
    else status = 'missed';
    out.push({ day: d, status });
  }
  return out;
}

/** Days that may be backfilled (today and the 13 before it). */
export function backfillWindow(today: ISODate): ISODate[] {
  return Array.from({ length: BACKFILL_DAYS }, (_, i) => addDaysISO(today, i - (BACKFILL_DAYS - 1)));
}

export function canToggle(day: ISODate, today: ISODate): boolean {
  const diff = daysBetween(day, today);
  return diff >= 0 && diff < BACKFILL_DAYS;
}
