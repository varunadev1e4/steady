import { getDaysInMonth, isLeapYear } from 'date-fns';
import type { InteractionKind, PersonRow } from '@/types/database';
import { daysBetween } from '@/features/habits/streaks';
import { parseISODate, toISODate, type ISODate } from '@/utils/dates';

type PersonLike = Pick<
  PersonRow,
  'contact_every_days' | 'last_contacted_on' | 'created_at' | 'archived_at' | 'birthday_month' | 'birthday_day'
>;

/** Days since last contact. Someone never contacted counts from when they were added. */
export function daysSinceContact(p: PersonLike, today: ISODate): number {
  const since = p.last_contacted_on ?? p.created_at.slice(0, 10);
  return Math.max(0, daysBetween(since, today));
}

/** How many days past their contact frequency; 0 or less means not due. */
export function daysOverdue(p: PersonLike, today: ISODate): number {
  if (!p.contact_every_days) return -Infinity;
  return daysSinceContact(p, today) - p.contact_every_days;
}

/** People due a message, most overdue first. Someone "due today" counts. */
export function reachOutList<T extends PersonLike>(people: T[], today: ISODate): Array<T & { overdue: number }> {
  return people
    .filter((p) => !p.archived_at && p.contact_every_days)
    .map((p) => ({ ...p, overdue: daysOverdue(p, today) }))
    .filter((p) => p.overdue >= 0)
    .sort((a, b) => b.overdue - a.overdue);
}

/** The next date this birthday falls on (today counts). 29 Feb becomes 28 Feb in other years. */
export function nextBirthday(month: number, day: number, today: ISODate): ISODate {
  const t = parseISODate(today);
  const make = (year: number) => {
    const d = month === 2 && day === 29 && !isLeapYear(new Date(year, 0, 1)) ? 28 : day;
    const safe = Math.min(d, getDaysInMonth(new Date(year, month - 1, 1)));
    return toISODate(new Date(year, month - 1, safe));
  };
  const thisYear = make(t.getFullYear());
  return thisYear >= today ? thisYear : make(t.getFullYear() + 1);
}

export function upcomingBirthdays<T extends PersonLike>(
  people: T[],
  today: ISODate,
  withinDays = 30,
): Array<T & { date: ISODate; inDays: number }> {
  return people
    .filter((p) => !p.archived_at && p.birthday_month && p.birthday_day)
    .map((p) => {
      const date = nextBirthday(p.birthday_month!, p.birthday_day!, today);
      return { ...p, date, inDays: daysBetween(today, date) };
    })
    .filter((p) => p.inDays <= withinDays)
    .sort((a, b) => a.inDays - b.inDays);
}

export function overdueText(days: number): string {
  if (days <= 0) return 'Due today';
  return `${days} ${days === 1 ? 'day' : 'days'} past your rhythm`;
}

export const KIND_LABEL: Record<InteractionKind, string> = {
  call: 'Call',
  message: 'Message',
  in_person: 'Met in person',
  other: 'Other',
};
