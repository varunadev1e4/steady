import { describe, expect, it } from 'vitest';
import { addDaysISO } from '@/utils/dates';
import { buildDayRecords, compareGroups, MIN_DAYS, moodBySleep, type DayRecord } from './logic';

function days(n: number, over: Partial<DayRecord>, startOffset = 0): DayRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    day: addDaysISO('2026-01-01', startOffset + i),
    mood: 3,
    energy: 3,
    sleep_hours: 7,
    worked_out: false,
    journaled: false,
    ...over,
  }));
}

describe('compareGroups', () => {
  it('reports both averages and the difference when each group has 7+ days', () => {
    const data = [...days(7, { worked_out: true, mood: 4 }), ...days(8, { mood: 3 }, 7)];
    const c = compareGroups(data, 'mood', (d) => d.worked_out, ['Workout days', 'Other days']);
    expect(c.enough).toBe(true);
    expect(c.groups.map((g) => [g.n, g.mean])).toEqual([
      [7, 4],
      [8, 3],
    ]);
    expect(c.difference).toBe(1);
  });

  it(`says "not enough data" when a group has fewer than ${MIN_DAYS} days`, () => {
    const data = [...days(6, { worked_out: true, mood: 5 }), ...days(30, { mood: 3 }, 6)];
    const c = compareGroups(data, 'mood', (d) => d.worked_out, ['Workout days', 'Other days']);
    expect(c.enough).toBe(false);
    expect(c.groups[0]).toMatchObject({ n: 6, mean: null });
    expect(c.groups[1].mean).toBe(3);
    expect(c.difference).toBeNull();
  });

  it('skips days without the metric', () => {
    const data = [...days(7, { journaled: true, energy: null }), ...days(7, { energy: 2 }, 7)];
    const c = compareGroups(data, 'energy', (d) => d.journaled, ['a', 'b']);
    expect(c.groups[0].n).toBe(0);
    expect(c.enough).toBe(false);
  });
});

describe('moodBySleep', () => {
  it('buckets by hours with inclusive 7–8 and only reports full buckets', () => {
    const data = [
      ...days(7, { sleep_hours: 5.5, mood: 2 }),
      ...days(7, { sleep_hours: 8, mood: 4 }, 7),
      ...days(3, { sleep_hours: 9, mood: 5 }, 14),
    ];
    const out = Object.fromEntries(moodBySleep(data).map((b) => [b.key, [b.n, b.mean]]));
    expect(out).toEqual({ lt6: [7, 2], '6to7': [0, null], '7to8': [7, 4], gt8: [3, null] });
  });
});

describe('buildDayRecords', () => {
  it('marks workout and journal days and converts numeric strings', () => {
    const r = buildDayRecords(
      [{ day: '2026-01-02', mood: 4, energy: 3, sleep_hours: '7.5' as unknown as number }],
      ['2026-01-02'],
      [],
    );
    expect(r[0]).toMatchObject({ worked_out: true, journaled: false, sleep_hours: 7.5 });
  });
});
