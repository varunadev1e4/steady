import {
  BookOpen,
  Brain,
  CalendarCheck,
  ClipboardCheck,
  HeartPulse,
  Lightbulb,
  ListChecks,
  ListTodo,
  Moon,
  MoreHorizontal,
  Pill,
  Settings,
  StickyNote,
  Sun,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/types/database';
import type { Tone } from '@/components/ui/Layout';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when every one of these modules is switched off in Settings. */
  modules?: ModuleKey[];
  end?: boolean;
  tone?: Tone;
  /** One-line description for the More page. */
  hint?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The five mobile tabs. */
export const TAB_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun, end: true },
  { to: '/journal', label: 'Journal', icon: BookOpen, modules: ['journal'] },
  { to: '/body', label: 'Body', icon: HeartPulse, modules: ['workouts', 'food'] },
  { to: '/people', label: 'People', icon: Users, modules: ['people'] },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

/** Everything else, grouped. Shown on the More page and in the desktop drawer. */
export const MORE_GROUPS: NavGroup[] = [
  {
    label: 'Daily',
    items: [
      { to: '/checkin', label: 'Check-in', icon: ClipboardCheck, modules: ['checkin'], tone: 'green', hint: 'Mood, energy, sleep, water' },
      { to: '/habits', label: 'Habits', icon: ListChecks, modules: ['habits'], tone: 'green', hint: 'Streaks and ideas' },
      { to: '/sleep', label: 'Sleep', icon: Moon, modules: ['checkin'], tone: 'violet', hint: 'Bedtime and rhythm' },
      { to: '/meds', label: 'Medications', icon: Pill, modules: ['medications'], tone: 'rose', hint: 'Doses and refills' },
    ],
  },
  {
    label: 'Mind',
    items: [{ to: '/mind', label: 'Mind', icon: Brain, tone: 'violet', hint: 'Activities, check, cravings, breathing' }],
  },
  {
    label: 'Plan',
    items: [
      { to: '/goals', label: 'Goals', icon: Target, tone: 'orange', hint: 'Weight goal and milestones' },
      { to: '/tasks', label: 'Tasks', icon: ListTodo, modules: ['tasks'], tone: 'blue', hint: 'Today and upcoming' },
      { to: '/notes', label: 'Notes', icon: StickyNote, modules: ['notes'], tone: 'yellow', hint: 'Quick notes and ideas' },
    ],
  },
  {
    label: 'Look back',
    items: [
      { to: '/review', label: 'Review', icon: CalendarCheck, modules: ['review'], tone: 'blue', hint: 'Week, month, year, report' },
      { to: '/insights', label: 'Insights', icon: Lightbulb, modules: ['insights'], tone: 'yellow', hint: 'Patterns in your data' },
    ],
  },
  {
    label: 'App',
    items: [{ to: '/settings', label: 'Settings', icon: Settings, tone: 'green', hint: 'Profile, targets, privacy, data' }],
  },
];

export const MORE_ITEMS: NavItem[] = MORE_GROUPS.flatMap((g) => g.items);

export function isVisible(item: NavItem, disabled: readonly ModuleKey[]): boolean {
  if (!item.modules) return true;
  return item.modules.some((m) => !disabled.includes(m));
}

/** Mind gets its own place in the desktop rail (there's room); on phones it lives under More. */
export const RAIL_ITEMS: NavItem[] = [
  ...TAB_ITEMS.slice(0, 4),
  { to: '/mind', label: 'Mind', icon: Brain },
  TAB_ITEMS[4],
];

const SECTION_PREFIXES: Array<[string, RegExp]> = [
  ['/journal', /^\/journal(\/|$)/],
  ['/body', /^\/(body|workouts|food|plans)(\/|$)/],
  ['/people', /^\/people(\/|$)/],
  ['/mind', /^\/(mind|breathe)(\/|$)/],
];

/**
 * Which top-level destination a path belongs to, so the right tab stays
 * highlighted on sub-pages (e.g. /food → Body, /habits → More).
 */
export function sectionFor(pathname: string, hasMind: boolean): string {
  if (pathname === '/') return '/';
  for (const [to, re] of SECTION_PREFIXES) {
    if (re.test(pathname)) return to === '/mind' && !hasMind ? '/more' : to;
  }
  return '/more';
}
