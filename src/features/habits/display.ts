import {
  Apple,
  Bed,
  BookOpen,
  Brain,
  Check,
  Droplet,
  Dumbbell,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  PenLine,
  Pill,
  PhoneOff,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { HabitColor, HabitRow } from '@/types/database';

export const HABIT_ICONS: Record<string, LucideIcon> = {
  check: Check,
  droplet: Droplet,
  dumbbell: Dumbbell,
  footprints: Footprints,
  book: BookOpen,
  pen: PenLine,
  brain: Brain,
  moon: Moon,
  bed: Bed,
  sun: Sun,
  apple: Apple,
  leaf: Leaf,
  heart: Heart,
  pill: Pill,
  music: Music,
  'phone-off': PhoneOff,
};

export const habitIcon = (key: string): LucideIcon => HABIT_ICONS[key] ?? Check;

export const HABIT_COLORS: HabitColor[] = ['sage', 'clay', 'amber', 'sky', 'plum', 'stone'];

export const habitColor = (c: HabitColor, alpha = 1) => `rgb(var(--habit-${c}) / ${alpha})`;

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function frequencyLabel(h: Pick<HabitRow, 'frequency' | 'weekdays' | 'times_per_week'>): string {
  if (h.frequency === 'daily') return 'Every day';
  if (h.frequency === 'weekly') return `${h.times_per_week ?? 1}× a week`;
  return [...h.weekdays].sort().map((d) => WEEKDAY_SHORT[d]).join(', ');
}

export const TARGET_TIME_LABEL = { any: 'Any time', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } as const;
export const TARGET_TIME_ORDER = { morning: 0, afternoon: 1, evening: 2, any: 3 } as const;
