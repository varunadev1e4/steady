import type { PlanEnrollmentRow } from '@/types/database';
import { addDaysISO, type ISODate } from '@/utils/dates';
import { weekdayOf } from '@/features/habits/streaks';
import type { Plan } from './content';

/**
 * Builds an iCalendar (.ics) file with one event per planned session, so the
 * phone's own calendar can remind you. Times are "floating" (local time on
 * whatever device shows them). Re-downloading produces the same event UIDs,
 * so calendars that support it update rather than duplicate.
 */

export interface IcsOptions {
  plan: Plan;
  enrollment: Pick<PlanEnrollmentRow, 'id' | 'start_date' | 'weekdays'>;
  /** Local start time, 'HH:mm'. */
  time: string;
  /** Minutes before the session for an alert; null for no alert. */
  alarmMinutes: number | null;
  /** Only sessions on or after this day are included. */
  from: ISODate;
  /** App origin for links back into Steady. */
  origin: string;
  now?: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line to at most 75 octets per line (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

const localStamp = (day: ISODate, hh: number, mm: number) => `${day.replace(/-/g, '')}T${pad(hh)}${pad(mm)}00`;

function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function addMinutes(day: ISODate, hh: number, mm: number, minutes: number): string {
  const total = hh * 60 + mm + minutes;
  const dayShift = Math.floor(total / 1440);
  const rest = total % 1440;
  return localStamp(addDaysISO(day, dayShift), Math.floor(rest / 60), rest % 60);
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export interface RecurringEvent {
  uid: string;
  title: string;
  description: string;
  startDay: ISODate;
  /** 'HH:mm' local time. */
  time: string;
  durationMin: number;
  /** Empty = every day. 0 = Sunday. */
  weekdays: number[];
  /** Last day (inclusive), or null for no end. */
  until: ISODate | null;
  alarmMinutes: number | null;
}

/** A calendar file of repeating events (medication times, weekly weigh-ins). */
export function buildRecurringIcs(calendarName: string, events: RecurringEvent[], now: Date = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Steady//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(calendarName)}`];
  const stamp = utcStamp(now);
  for (const e of events) {
    const [hh, mm] = e.time.split(':').map(Number);
    const rule = [
      e.weekdays.length ? 'FREQ=WEEKLY' : 'FREQ=DAILY',
      e.weekdays.length ? `BYDAY=${[...e.weekdays].sort().map((d) => BYDAY[d]).join(',')}` : null,
      e.until ? `UNTIL=${e.until.replace(/-/g, '')}T235959` : null,
    ].filter(Boolean).join(';');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@steady`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localStamp(e.startDay, hh, mm)}`,
      `DTEND:${addMinutes(e.startDay, hh, mm, e.durationMin)}`,
      `RRULE:${rule}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
    );
    if (e.alarmMinutes != null) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.title)}`, `TRIGGER:-PT${e.alarmMinutes}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function sessionTitle(plan: Plan, minutes: number, week: number): string {
  if (plan.kind === 'walk') return `${minutes}-min walk (Steady, week ${week})`;
  if (plan.kind === 'yoga') return `${minutes}-min gentle yoga (Steady, week ${week})`;
  return `Home strength session (Steady, week ${week})`;
}

export function buildPlanIcs(o: IcsOptions): { ics: string; events: number } {
  const [hh, mm] = o.time.split(':').map(Number);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Steady//Beginner plans//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`Steady: ${o.plan.short}`)}`,
  ];
  const stamp = utcStamp(o.now ?? new Date());
  let events = 0;

  for (const week of o.plan.weeks) {
    const weekStart = addDaysISO(o.enrollment.start_date, (week.week - 1) * 7);
    for (let i = 0; i < 7; i++) {
      const day = addDaysISO(weekStart, i);
      if (day < o.from || !o.enrollment.weekdays.includes(weekdayOf(day))) continue;
      const url = `${o.origin}/plans/${o.plan.id}/session?week=${week.week}`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${o.enrollment.id}-${day.replace(/-/g, '')}@steady`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${localStamp(day, hh, mm)}`,
        `DTEND:${addMinutes(day, hh, mm, Math.max(5, week.minutes))}`,
        `SUMMARY:${escapeText(sessionTitle(o.plan, week.minutes, week.week))}`,
        `DESCRIPTION:${escapeText(`${week.focus}\nOpen the guided session in Steady: ${url}`)}`,
        `URL:${url}`,
      );
      if (o.alarmMinutes != null) {
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(sessionTitle(o.plan, week.minutes, week.week))}`, `TRIGGER:-PT${o.alarmMinutes}M`, 'END:VALARM');
      }
      lines.push('END:VEVENT');
      events++;
    }
  }
  lines.push('END:VCALENDAR');
  return { ics: lines.map(foldLine).join('\r\n') + '\r\n', events };
}
