import { describe, expect, it } from 'vitest';
import { HABIT_ICONS } from './display';
import { HABIT_IDEAS, IDEA_GROUPS, STARTER_SET, ideaByKey } from './suggestions';

describe('habit ideas', () => {
  it('are valid habits the database will accept', () => {
    for (const i of HABIT_IDEAS) {
      expect(i.name.length).toBeGreaterThan(0);
      expect(i.name.length).toBeLessThanOrEqual(60);
      expect(HABIT_ICONS[i.icon]).toBeDefined();
      if (i.frequency === 'weekly') expect(i.times_per_week).toBeGreaterThanOrEqual(1);
      expect(i.why.length).toBeGreaterThan(10);
    }
  });

  it('have unique keys and names, and every group is used', () => {
    expect(new Set(HABIT_IDEAS.map((i) => i.key)).size).toBe(HABIT_IDEAS.length);
    expect(new Set(HABIT_IDEAS.map((i) => i.name.toLowerCase())).size).toBe(HABIT_IDEAS.length);
    for (const g of IDEA_GROUPS) expect(HABIT_IDEAS.some((i) => i.group === g.key)).toBe(true);
  });

  it('starter set is small, real and balanced', () => {
    expect(STARTER_SET.length).toBe(5);
    const groups = STARTER_SET.map((k) => ideaByKey(k)!.group);
    expect(new Set(groups)).toEqual(new Set(['move', 'eat', 'sleep', 'mind']));
  });
});
