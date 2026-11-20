import type { FoodRow, MealRow } from '@/types/database';

/** Tags that count towards the "clean eating" share. Based only on the user's own tags. */
export const CLEAN_TAGS = ['home-cooked', 'whole-food'];

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function dayTotals(meals: Array<Pick<MealRow, 'protein_g' | 'calories' | 'carbs_g'>>) {
  return {
    protein: round1(meals.reduce((s, m) => s + num(m.protein_g), 0)),
    calories: Math.round(meals.reduce((s, m) => s + num(m.calories), 0)),
    carbs: round1(meals.reduce((s, m) => s + num(m.carbs_g), 0)),
  };
}

/** Meal totals for a number of servings of a library food. Missing values stay missing. */
export function mealFromFood(food: Pick<FoodRow, 'protein_g' | 'calories' | 'carbs_g'>, servings: number) {
  const scale = (v: number | null, round: (n: number) => number) => (v == null ? null : round(Number(v) * servings));
  return {
    protein_g: scale(food.protein_g, round1),
    calories: scale(food.calories, Math.round),
    carbs_g: scale(food.carbs_g, round1),
  };
}

export function cleanEating(meals: Array<Pick<MealRow, 'tags'>>) {
  const total = meals.length;
  const clean = meals.filter((m) => m.tags.some((t) => CLEAN_TAGS.includes(t))).length;
  return { clean, total, percent: total === 0 ? null : Math.round((clean / total) * 100) };
}

/** Average protein over days with any meals logged, and how many met the target. */
export function proteinSummary(byDay: Array<{ day: string; protein: number }>, target: number | null) {
  const logged = byDay.filter((d) => d.protein > 0);
  const avg = logged.length ? round1(logged.reduce((s, d) => s + Number(d.protein), 0) / logged.length) : null;
  const met = target ? logged.filter((d) => Number(d.protein) >= target).length : null;
  return { avg, daysLogged: logged.length, daysMet: met };
}
