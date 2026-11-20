import { addDays, format, isValid, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Calendar days are passed around as 'yyyy-MM-dd' strings (matching Postgres
 * `date` columns) and are always computed in the user's chosen time zone, so a
 * late-night entry never lands on the wrong day.
 */
export type ISODate = string;

const ISO_DATE = 'yyyy-MM-dd';

/** The browser's IANA time zone, e.g. 'Asia/Kolkata'. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date in the given time zone. */
export function todayISO(timeZone: string, now: Date = new Date()): ISODate {
  return formatInTimeZone(now, timeZone, ISO_DATE);
}

/** The local hour (0–23) in the given time zone. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  return Number(formatInTimeZone(now, timeZone, 'H'));
}

export function greetingFor(timeZone: string, now: Date = new Date()): string {
  const h = hourIn(timeZone, now);
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Hello';
}

/** Parses 'yyyy-MM-dd' as a local calendar date (no time zone shifting). */
export function parseISODate(value: ISODate): Date {
  const d = parse(value, ISO_DATE, new Date(2000, 0, 1));
  if (!isValid(d)) throw new Error(`Invalid date: ${value}`);
  return d;
}

export function toISODate(d: Date): ISODate {
  return format(d, ISO_DATE);
}

export function addDaysISO(value: ISODate, days: number): ISODate {
  return toISODate(addDays(parseISODate(value), days));
}

/** Formats a calendar date with one of the user's date-format patterns. */
export function formatISODate(value: ISODate, pattern: string): string {
  return format(parseISODate(value), pattern);
}

/** Long, friendly form for headings: "Friday, 20 November". */
export function longDayLabel(value: ISODate): string {
  return format(parseISODate(value), 'EEEE, d MMMM');
}

/** All IANA time zones the browser knows, for the settings picker. */
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    const zones = intl.supportedValuesOf?.('timeZone');
    if (zones && zones.length) return zones.includes('UTC') ? zones : ['UTC', ...zones];
  } catch {
    // fall through
  }
  return ['UTC', browserTimeZone()];
}
