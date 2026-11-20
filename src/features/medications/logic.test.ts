import { describe, expect, it } from 'vitest';
import { adherence, daysOfSupply, dosesOn, isActiveOn, needsRefill } from './logic';

const med = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  schedule_times: ['08:00:00', '21:00:00'],
  weekdays: [] as number[],
  as_needed: false,
  start_date: '2026-11-01',
  end_date: null as string | null,
  archived_at: null as string | null,
  pills_left: 20 as number | null,
  pills_per_dose: 1,
  refill_at: null as number | null,
  ...over,
});

describe('schedule', () => {
  it('lists doses in time order and respects dates, weekdays and as-needed', () => {
    const meds = [med(), med({ id: 'm2', schedule_times: ['07:30:00'] }), med({ id: 'prn', as_needed: true, schedule_times: [] })];
    expect(dosesOn(meds, '2026-11-20').map((d) => `${d.medicationId}@${d.time}`)).toEqual(['m2@07:30', 'm1@08:00', 'm1@21:00']);
    expect(isActiveOn(med({ start_date: '2026-12-01' }), '2026-11-20')).toBe(false);
    expect(isActiveOn(med({ end_date: '2026-11-19' }), '2026-11-20')).toBe(false);
    expect(isActiveOn(med({ weekdays: [1] }), '2026-11-23')).toBe(true); // Monday
    expect(isActiveOn(med({ weekdays: [1] }), '2026-11-24')).toBe(false);
  });
});

describe('adherence', () => {
  const meds = [med()];
  it('counts taken doses out of those due, ignoring today’s future doses', () => {
    const doses = [
      { medication_id: 'm1', day: '2026-11-18', scheduled_time: '08:00:00', status: 'taken' as const },
      { medication_id: 'm1', day: '2026-11-18', scheduled_time: '21:00:00', status: 'skipped' as const },
      { medication_id: 'm1', day: '2026-11-19', scheduled_time: '08:00:00', status: 'taken' as const },
      { medication_id: 'm1', day: '2026-11-19', scheduled_time: '21:00:00', status: 'taken' as const },
      { medication_id: 'm1', day: '2026-11-20', scheduled_time: '08:00:00', status: 'taken' as const },
    ];
    // 18th: 1/2, 19th: 2/2, 20th at 12:00: 1/1 (evening not due yet)
    expect(adherence(meds, doses, '2026-11-18', '2026-11-20', '2026-11-20', '12:00')).toEqual({ taken: 4, expected: 5, percent: 80 });
  });

  it('returns null with nothing due', () => {
    expect(adherence([], [], '2026-11-18', '2026-11-20', '2026-11-20', '12:00').percent).toBeNull();
  });
});

describe('supply', () => {
  it('estimates days left and flags refills', () => {
    expect(daysOfSupply(med({ pills_left: 20 }))).toBe(10);
    expect(daysOfSupply(med({ pills_left: null }))).toBeNull();
    expect(needsRefill(med({ pills_left: 12 }))).toBe(true); // 6 days left
    expect(needsRefill(med({ pills_left: 30 }))).toBe(false);
    expect(needsRefill(med({ pills_left: 30, refill_at: 30 }))).toBe(true);
  });
});
