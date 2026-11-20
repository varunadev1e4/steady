import type { MedicationDoseRow, MedicationRow } from '@/types/database';
import { weekdayOf } from '@/features/habits/streaks';
import { addDaysISO, type ISODate } from '@/utils/dates';

type Med = Pick<MedicationRow, 'id' | 'schedule_times' | 'weekdays' | 'as_needed' | 'start_date' | 'end_date' | 'archived_at'>;
type Dose = Pick<MedicationDoseRow, 'medication_id' | 'day' | 'scheduled_time' | 'status'>;

/** 'HH:mm:ss' or 'HH:mm' → 'HH:mm'. */
export const hhmm = (t: string) => t.slice(0, 5);

export function isActiveOn(m: Med, day: ISODate): boolean {
  if (m.archived_at || m.as_needed) return false;
  if (day < m.start_date || (m.end_date && day > m.end_date)) return false;
  return m.weekdays.length === 0 || m.weekdays.includes(weekdayOf(day));
}

export interface ScheduledDose {
  medicationId: string;
  time: string; // HH:mm
}

/** Every scheduled dose on a day, in time order. */
export function dosesOn<T extends Med>(meds: T[], day: ISODate): Array<ScheduledDose & { med: T }> {
  return meds
    .filter((m) => isActiveOn(m, day))
    .flatMap((m) => m.schedule_times.map((t) => ({ medicationId: m.id, time: hhmm(t), med: m })))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export const doseKey = (medicationId: string, day: ISODate, time: string | null) => `${medicationId}|${day}|${time ? hhmm(time) : ''}`;

export interface Adherence {
  taken: number;
  expected: number;
  percent: number | null;
}

/**
 * How many scheduled doses were taken, between two days inclusive. Today's
 * doses count only once their time has passed (or they've been logged).
 */
export function adherence(meds: Med[], doses: Dose[], from: ISODate, to: ISODate, today: ISODate, nowHHmm: string): Adherence {
  const logged = new Map(doses.map((d) => [doseKey(d.medication_id, d.day, d.scheduled_time), d.status]));
  let taken = 0;
  let expected = 0;
  for (let day = from; day <= to && day <= today; day = addDaysISO(day, 1)) {
    for (const d of dosesOn(meds, day)) {
      const status = logged.get(doseKey(d.medicationId, day, d.time));
      if (day === today && !status && d.time > nowHHmm) continue; // not due yet
      expected++;
      if (status === 'taken') taken++;
    }
  }
  return { taken, expected, percent: expected ? Math.round((taken / expected) * 100) : null };
}

/** Days of supply left at the current schedule, or null if not tracked. */
export function daysOfSupply(m: Pick<MedicationRow, 'pills_left' | 'pills_per_dose' | 'schedule_times' | 'weekdays' | 'as_needed'>): number | null {
  if (m.pills_left == null || m.as_needed || m.schedule_times.length === 0) return null;
  const perDay = Number(m.pills_per_dose) * m.schedule_times.length * (m.weekdays.length ? m.weekdays.length / 7 : 1);
  return perDay > 0 ? Math.floor(Number(m.pills_left) / perDay) : null;
}

export function needsRefill(m: Pick<MedicationRow, 'pills_left' | 'refill_at' | 'pills_per_dose' | 'schedule_times' | 'weekdays' | 'as_needed'>): boolean {
  if (m.pills_left == null) return false;
  if (m.refill_at != null) return Number(m.pills_left) <= m.refill_at;
  const days = daysOfSupply(m);
  return days != null && days <= 7;
}

export const MED_SUPPORT = {
  // India's national tele-mental-health helpline (free, 24/7, multiple languages).
  helplineName: 'Tele-MANAS',
  helplineNumber: '14416',
  emergency: '112',
};
