import { describe, expect, it } from 'vitest';
import { cleanEating, dayTotals, mealFromFood, proteinSummary } from './logic';

describe('food maths', () => {
  it('totals meals, treating missing values as zero', () => {
    expect(
      dayTotals([
        { protein_g: 9, calories: 150, carbs_g: 20 },
        { protein_g: 12.25, calories: null, carbs_g: null },
      ]),
    ).toEqual({ protein: 21.3, calories: 150, carbs: 20 });
  });

  it('scales a library food by servings and keeps unknowns unknown', () => {
    expect(mealFromFood({ protein_g: 3.1, calories: 120, carbs_g: null }, 2.5)).toEqual({
      protein_g: 7.8,
      calories: 300,
      carbs_g: null,
    });
  });

  it('computes the clean-eating share from tags only', () => {
    expect(cleanEating([{ tags: ['home-cooked'] }, { tags: ['junk'] }, { tags: ['whole-food', 'snack'] }, { tags: [] }])).toEqual({
      clean: 2,
      total: 4,
      percent: 50,
    });
    expect(cleanEating([]).percent).toBeNull();
  });

  it('averages protein over logged days and counts days meeting the target', () => {
    const s = proteinSummary(
      [
        { day: 'a', protein: 100 },
        { day: 'b', protein: 60 },
        { day: 'c', protein: 0 },
      ],
      90,
    );
    expect(s).toEqual({ avg: 80, daysLogged: 2, daysMet: 1 });
    expect(proteinSummary([], null)).toEqual({ avg: null, daysLogged: 0, daysMet: null });
  });
});
