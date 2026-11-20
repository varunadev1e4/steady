import type { GoalRow } from '@/types/database';
import { weekStartOf, type WeekStart } from '@/features/habits/streaks';
import { addDaysISO, type ISODate } from '@/utils/dates';

/** Everything goal progress and milestones are computed from: the user's own logs. */
export interface ActivityData {
  cardio: Array<{ day: ISODate; duration_min: number; activity: string }>;
  workouts: Array<{ day: ISODate; started_at: string; ended_at: string | null }>;
  checkIns: Array<{ day: ISODate; mood: number | null; steps: number | null }>;
  journalDays: ISODate[];
  latestWeightKg: number | null;
}

export const GOAL_KINDS = [
  { value: 'weekly_activity_minutes', label: 'Active minutes this week', unit: 'min', hint: 'Walks, cardio and logged workouts add up through the week.' },
  { value: 'longest_walk', label: 'Longest single walk', unit: 'min', hint: 'For example, walk 30 minutes without stopping.' },
  { value: 'workouts_per_week', label: 'Workouts this week', unit: 'workouts', hint: 'Strength workouts logged this week.' },
  { value: 'steps_daily_avg', label: 'Average daily steps (7 days)', unit: 'steps', hint: 'From the steps you log each day.' },
  { value: 'weight', label: 'Body weight', unit: 'kg', hint: 'Uses your latest logged weight.' },
  { value: 'custom', label: 'Something else', unit: '', hint: 'You update the progress yourself.' },
] as const;

export type GoalKind = (typeof GOAL_KINDS)[number]['value'];

const workoutMinutes = (w: { started_at: string; ended_at: string | null }) => {
  if (!w.ended_at) return 0;
  const m = (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000;
  return m > 0 ? Math.min(180, Math.round(m)) : 0;
};

/** Active minutes per day: cardio plus finished workouts. */
export function activeMinutesByDay(d: Pick<ActivityData, 'cardio' | 'workouts'>): Map<ISODate, number> {
  const m = new Map<ISODate, number>();
  for (const c of d.cardio) m.set(c.day, (m.get(c.day) ?? 0) + Number(c.duration_min));
  for (const w of d.workouts) m.set(w.day, (m.get(w.day) ?? 0) + workoutMinutes(w));
  return m;
}

export interface GoalProgress {
  current: number | null;
  /** 0–100. */
  percent: number;
  reached: boolean;
}

export function goalProgress(
  goal: Pick<GoalRow, 'kind' | 'target' | 'start_value' | 'current_value'>,
  data: ActivityData,
  today: ISODate,
  weekStart: WeekStart,
): GoalProgress {
  const target = Number(goal.target);
  const ws = weekStartOf(today, weekStart);
  const inWeek = (day: ISODate) => day >= ws && day <= today;
  let current: number | null = null;

  switch (goal.kind as GoalKind) {
    case 'weekly_activity_minutes': {
      let sum = 0;
      for (const [day, min] of activeMinutesByDay(data)) if (inWeek(day)) sum += min;
      current = sum;
      break;
    }
    case 'longest_walk':
      current = Math.max(0, ...data.cardio.filter((c) => c.activity.toLowerCase() === 'walk').map((c) => Number(c.duration_min)));
      break;
    case 'workouts_per_week':
      current = data.workouts.filter((w) => inWeek(w.day)).length;
      break;
    case 'steps_daily_avg': {
      const from = addDaysISO(today, -6);
      const days = data.checkIns.filter((c) => c.day >= from && c.day <= today && c.steps != null && c.steps > 0);
      current = days.length ? Math.round(days.reduce((s, c) => s + Number(c.steps), 0) / days.length) : null;
      break;
    }
    case 'weight': {
      current = data.latestWeightKg;
      const start = goal.start_value == null ? null : Number(goal.start_value);
      if (current == null || start == null || start === target) {
        return { current, percent: current != null && current === target ? 100 : 0, reached: current != null && current === target };
      }
      const losing = start > target;
      const reached = losing ? current <= target : current >= target;
      const pct = ((start - current) / (start - target)) * 100;
      return { current, percent: Math.max(0, Math.min(100, Math.round(pct))), reached };
    }
    case 'custom':
      current = goal.current_value == null ? null : Number(goal.current_value);
      break;
  }
  if (current == null) return { current, percent: 0, reached: false };
  return { current, percent: Math.max(0, Math.min(100, Math.round((current / target) * 100))), reached: current >= target };
}

/* ---------------------------------------------------------- milestones -- */

export interface Milestone {
  key: string;
  label: string;
  hint: string;
  achievedOn: ISODate | null;
}

const firstSorted = (days: Iterable<ISODate>) => [...days].sort()[0] ?? null;

/** Quiet milestones computed from history. Dates are when each was first reached. */
export function computeMilestones(d: ActivityData, weekStart: WeekStart): Milestone[] {
  const byDay = activeMinutesByDay(d);
  const activeDays = [...byDay].filter(([, m]) => m > 0).map(([day]) => day).sort();

  // First week with 150+ active minutes: the day the running total crossed 150.
  let week150: ISODate | null = null;
  const weekTotals = new Map<ISODate, number>();
  for (const day of activeDays) {
    const ws = weekStartOf(day, weekStart);
    const total = (weekTotals.get(ws) ?? 0) + (byDay.get(day) ?? 0);
    weekTotals.set(ws, total);
    if (total >= 150 && (week150 == null || day < week150)) week150 = day;
    if (week150) break;
  }

  const walk30 = firstSorted(d.cardio.filter((c) => c.activity.toLowerCase() === 'walk' && Number(c.duration_min) >= 30).map((c) => c.day));

  // First time 7 check-ins in a row were completed.
  const checkDays = [...new Set(d.checkIns.filter((c) => c.mood != null).map((c) => c.day))].sort();
  let checkStreak7: ISODate | null = null;
  let run = 0;
  for (let i = 0; i < checkDays.length; i++) {
    run = i > 0 && addDaysISO(checkDays[i - 1], 1) === checkDays[i] ? run + 1 : 1;
    if (run >= 7) {
      checkStreak7 = checkDays[i];
      break;
    }
  }

  const journal = [...new Set(d.journalDays)].sort();
  const workoutDays = d.workouts.map((w) => w.day).sort();
  const steps10k = firstSorted(d.checkIns.filter((c) => (c.steps ?? 0) >= 10000).map((c) => c.day));

  return [
    { key: 'first_move', label: 'First walk or workout logged', hint: 'Log any walk, cardio or workout.', achievedOn: activeDays[0] ?? null },
    { key: 'walk_30', label: 'A 30-minute walk', hint: 'Log a walk of 30 minutes or more.', achievedOn: walk30 },
    { key: 'week_150', label: 'A 150-minute active week', hint: 'The weekly amount health guidelines recommend.', achievedOn: week150 },
    { key: 'workouts_10', label: '10 workouts', hint: 'Strength workouts logged.', achievedOn: workoutDays[9] ?? null },
    { key: 'checkin_7', label: '7 check-ins in a row', hint: 'A full week of daily check-ins.', achievedOn: checkStreak7 },
    { key: 'journal_10', label: '10 days journaled', hint: 'Days with at least one entry.', achievedOn: journal[9] ?? null },
    { key: 'steps_10k', label: 'A 10,000-step day', hint: 'From the steps you log.', achievedOn: steps10k },
  ];
}
