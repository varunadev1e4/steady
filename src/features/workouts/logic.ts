import type { MuscleGroup, Units } from '@/types/database';
import type { ISODate } from '@/utils/dates';

/* ---------------------------------------------------------------- units -- */

export const KG_PER_LB = 0.45359237;

/** Converts a stored kilogram value for display. */
export function fromKg(kg: number, units: Units): number {
  return units === 'kg' ? kg : kg / KG_PER_LB;
}

/** Converts a user-entered value to kilograms for storage. */
export function toKg(value: number, units: Units): number {
  return units === 'kg' ? value : value * KG_PER_LB;
}

/** Rounds to one decimal and drops a trailing ".0". */
export function formatWeight(kg: number, units: Units): string {
  const v = Math.round(fromKg(kg, units) * 10) / 10;
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}`;
}

/* ------------------------------------------------------------ overload -- */

export interface SetResult {
  weight_kg: number;
  reps: number;
}

export type OverloadSuggestion =
  | { kind: 'none' }
  | { kind: 'increase'; weight_kg: number; reason: string }
  | { kind: 'repeat'; weight_kg: number; reason: string };

/**
 * Rule-based progressive overload (not AI):
 * - all working sets last session reached the top of the rep range → add the
 *   increment (in the user's unit) to the heaviest working weight;
 * - otherwise (some sets fell short) → repeat that weight.
 */
export function overloadSuggestion(
  lastSets: SetResult[],
  repMax: number,
  increment: number,
  units: Units,
): OverloadSuggestion {
  const working = lastSets.filter((s) => s.reps > 0);
  if (working.length === 0) return { kind: 'none' };
  const top = Math.max(...working.map((s) => s.weight_kg));
  if (working.every((s) => s.reps >= repMax)) {
    if (top === 0) {
      return { kind: 'repeat', weight_kg: 0, reason: `All sets hit ${repMax} reps. Try adding a rep or a harder variation.` };
    }
    const next = toKg(roundTo(fromKg(top, units) + increment, increment), units);
    return { kind: 'increase', weight_kg: next, reason: `All sets hit ${repMax} reps last time.` };
  }
  return { kind: 'repeat', weight_kg: top, reason: 'Some sets fell short of the top of the range last time.' };
}

function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/* ----------------------------------------------------------------- PRs -- */

/** Epley estimated one-rep max. A single rep is its own 1RM. */
export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface DatedSet extends SetResult {
  day: ISODate;
}

export interface PersonalRecords {
  heaviest: DatedSet | null;
  best1RM: { value_kg: number; day: ISODate; weight_kg: number; reps: number } | null;
}

export function personalRecords(sets: DatedSet[]): PersonalRecords {
  let heaviest: DatedSet | null = null;
  let best1RM: PersonalRecords['best1RM'] = null;
  for (const s of sets) {
    if (s.reps <= 0 || s.weight_kg <= 0) continue;
    if (!heaviest || s.weight_kg > heaviest.weight_kg || (s.weight_kg === heaviest.weight_kg && s.reps > heaviest.reps)) {
      heaviest = s;
    }
    const e = epley1RM(s.weight_kg, s.reps);
    if (!best1RM || e > best1RM.value_kg) best1RM = { value_kg: e, day: s.day, weight_kg: s.weight_kg, reps: s.reps };
  }
  return { heaviest, best1RM };
}

/* -------------------------------------------------------------- volume -- */

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  glutes: 'Glutes',
  core: 'Core',
  full_body: 'Full body',
};

/** Working sets per muscle group (completed, non-warm-up). */
export function setsPerMuscle(
  sets: Array<{ exercise_id: string; completed: boolean; is_warmup: boolean }>,
  muscleOf: (exerciseId: string) => MuscleGroup | undefined,
): Partial<Record<MuscleGroup, number>> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sets) {
    if (!s.completed || s.is_warmup) continue;
    const m = muscleOf(s.exercise_id);
    if (!m) continue;
    out[m] = (out[m] ?? 0) + 1;
  }
  return out;
}

/** Plans "today's workout": the first template scheduled for this weekday. */
export function plannedTemplate<T extends { weekdays: number[]; archived_at: string | null; sort_order: number }>(
  templates: T[],
  weekday: number,
): T | null {
  return (
    [...templates]
      .filter((t) => !t.archived_at && t.weekdays.includes(weekday))
      .sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
  );
}
