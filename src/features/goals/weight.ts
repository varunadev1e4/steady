import { daysBetween } from '@/features/habits/streaks';
import { nextBirthday } from '@/features/people/logic';
import { addDaysISO, type ISODate } from '@/utils/dates';

/**
 * Weight goal maths. Guidance used:
 *  - A safe, sustainable rate of loss is about 0.5–1 kg a week at most
 *    (NHS, CDC); slower is fine and often easier to keep.
 *  - About 7,700 kcal of energy deficit ≈ 1 kg of body weight (a rule of
 *    thumb; real-world loss slows over time, so treat projections loosely).
 *  - Resting energy estimate: Mifflin–St Jeor equation, with standard
 *    activity multipliers.
 */

export const KCAL_PER_KG = 7700;
export const SAFE_MAX_KG_PER_WEEK = 1;

export interface WeightPlan {
  totalKg: number;
  daysTotal: number;
  daysLeft: number;
  weeksLeft: number;
  /** kg per week needed from today to reach the target on time. */
  neededPerWeek: number | null;
  pace: 'done' | 'gentle' | 'steady' | 'ambitious' | 'too_fast' | 'past_due';
}

export function weightPlan(o: { startKg: number; targetKg: number; startDay: ISODate; dueDay: ISODate; currentKg: number | null; today: ISODate }): WeightPlan {
  const totalKg = Math.round((o.startKg - o.targetKg) * 10) / 10;
  const daysTotal = Math.max(1, daysBetween(o.startDay, o.dueDay));
  const daysLeft = daysBetween(o.today, o.dueDay);
  const weeksLeft = Math.max(0, Math.round((daysLeft / 7) * 10) / 10);
  const current = o.currentKg ?? o.startKg;
  const remaining = current - o.targetKg;
  if (remaining <= 0) return { totalKg, daysTotal, daysLeft, weeksLeft, neededPerWeek: 0, pace: 'done' };
  if (daysLeft <= 0) return { totalKg, daysTotal, daysLeft, weeksLeft: 0, neededPerWeek: null, pace: 'past_due' };
  const neededPerWeek = Math.round((remaining / (daysLeft / 7)) * 100) / 100;
  const pace = neededPerWeek > SAFE_MAX_KG_PER_WEEK ? 'too_fast' : neededPerWeek > 0.75 ? 'ambitious' : neededPerWeek >= 0.4 ? 'steady' : 'gentle';
  return { totalKg, daysTotal, daysLeft, weeksLeft, neededPerWeek, pace };
}

/** Where the straight-line goal path says you'd be on a given day. */
export function pathWeight(startKg: number, targetKg: number, startDay: ISODate, dueDay: ISODate, day: ISODate): number {
  const total = Math.max(1, daysBetween(startDay, dueDay));
  const t = Math.min(1, Math.max(0, daysBetween(startDay, day) / total));
  return Math.round((startKg + (targetKg - startKg) * t) * 10) / 10;
}

/**
 * Smoothed current weight: average of weigh-ins in the last 14 days (daily
 * weight swings of 1–2 kg are normal water changes, not fat).
 */
export function smoothedWeight(entries: Array<{ day: ISODate; kg: number }>, today: ISODate): number | null {
  const from = addDaysISO(today, -13);
  const recent = entries.filter((e) => e.day >= from && e.day <= today);
  const use = recent.length ? recent : entries.slice().sort((a, b) => b.day.localeCompare(a.day)).slice(0, 1);
  if (!use.length) return null;
  return Math.round((use.reduce((s, e) => s + e.kg, 0) / use.length) * 10) / 10;
}

export type TrackStatus = 'ahead' | 'on_track' | 'behind' | 'no_data';

/** Compares the smoothed weight with the goal path, with a ±0.5 kg tolerance. */
export function trackStatus(smoothed: number | null, path: number): TrackStatus {
  if (smoothed == null) return 'no_data';
  if (smoothed <= path - 0.5) return 'ahead';
  if (smoothed <= path + 0.5) return 'on_track';
  return 'behind';
}

export function defaultDueDate(birthday: ISODate | null, today: ISODate): ISODate | null {
  if (!birthday) return null;
  const [, m, d] = birthday.split('-').map(Number);
  const next = nextBirthday(m, d, today);
  // A birthday less than 4 weeks away is too close for a weight goal: use the one after.
  return daysBetween(today, next) < 28 ? nextBirthday(m, d, addDaysISO(next, 1)) : next;
}

export function ageOn(birthday: ISODate, day: ISODate): number {
  const [by, bm, bd] = birthday.split('-').map(Number);
  const [y, m, d] = day.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting, little exercise',
  light: 'Light activity 1–3 days a week',
  moderate: 'Moderate activity 3–5 days a week',
  active: 'Hard exercise most days',
};

export interface CalorieEstimate {
  bmr: number;
  maintenance: number;
  target: number;
  /** Expected loss per week at the target, kg. */
  perWeek: number;
  /** True when the floor limited the deficit. */
  floored: boolean;
}

/**
 * Mifflin–St Jeor resting energy, times an activity factor for maintenance.
 * The suggested target aims for the needed pace but keeps the daily deficit
 * between 300 and 750 kcal, and never goes below 1,500 kcal (men) or 1,200
 * kcal (women).
 */
export function estimateCalories(o: {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  neededPerWeek: number | null;
}): CalorieEstimate {
  const bmr = Math.round(10 * o.weightKg + 6.25 * o.heightCm - 5 * o.age + (o.sex === 'male' ? 5 : -161));
  const maintenance = Math.round(bmr * ACTIVITY_FACTOR[o.activity]);
  const wanted = ((o.neededPerWeek ?? 0.5) * KCAL_PER_KG) / 7;
  const deficit = Math.min(750, Math.max(300, wanted));
  const floor = o.sex === 'male' ? 1500 : 1200;
  const raw = maintenance - deficit;
  const target = Math.round(Math.max(raw, floor) / 50) * 50;
  const perWeek = Math.round((Math.max(0, maintenance - target) * 7 / KCAL_PER_KG) * 100) / 100;
  return { bmr, maintenance, target, perWeek, floored: raw < floor };
}

/** Suggested daily protein during weight loss: ~1.2 g per kg of goal weight, rounded to 5 g. */
export function suggestedProtein(targetKg: number): number {
  return Math.round((targetKg * 1.2) / 5) * 5;
}
