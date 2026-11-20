import {
  Activity,
  Apple,
  Camera,
  Dumbbell,
  FileText,
  Footprints,
  LineChart,
  Lock,
  Moon,
  PenLine,
  Plus,
  Ruler,
  Scale,
  Stethoscope,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/types/database';
import { MORE_ITEMS, RAIL_ITEMS } from './navigation';

export interface Command {
  id: string;
  label: string;
  group: 'Go to' | 'Do';
  icon: LucideIcon;
  /** Extra words that should match (e.g. "weight" finds Measurements). */
  keywords?: string;
  to?: string;
  action?: 'capture' | 'lock' | 'theme';
  modules?: ModuleKey[];
}

const PAGES: Command[] = [
  ...RAIL_ITEMS.map((i) => ({ id: i.to, label: i.label, group: 'Go to' as const, icon: i.icon, to: i.to, modules: i.modules })),
  ...MORE_ITEMS.map((i) => ({ id: i.to, label: i.label, group: 'Go to' as const, icon: i.icon, to: i.to, modules: i.modules, keywords: i.hint })),
  { id: '/workouts', label: 'Workouts', group: 'Go to', icon: Dumbbell, to: '/workouts', modules: ['workouts'], keywords: 'gym strength sets' },
  { id: '/plans', label: 'Beginner plans', group: 'Go to', icon: Footprints, to: '/plans', modules: ['workouts'], keywords: 'walking yoga home strength' },
  { id: '/food', label: 'Food and water', group: 'Go to', icon: Apple, to: '/food', modules: ['food'], keywords: 'meal protein' },
  { id: '/body/steps', label: 'Steps', group: 'Go to', icon: Activity, to: '/body/steps' },
  { id: '/body/measurements', label: 'Measurements', group: 'Go to', icon: Ruler, to: '/body/measurements', keywords: 'weight waist body' },
  { id: '/goals/weight', label: 'Weight goal', group: 'Go to', icon: Scale, to: '/goals/weight', keywords: 'birthday lose kg' },
  { id: '/body/health', label: 'Health readings', group: 'Go to', icon: Stethoscope, to: '/body/health', keywords: 'blood pressure sugar heart' },
  { id: '/body/photos', label: 'Progress photos', group: 'Go to', icon: Camera, to: '/body/photos' },
  { id: '/breathe', label: 'Breathe', group: 'Go to', icon: Wind, to: '/breathe', keywords: 'calm anxiety' },
  { id: '/report', label: 'Body and mind report', group: 'Go to', icon: FileText, to: '/report', keywords: 'doctor print' },
  { id: '/review/month', label: 'Monthly review', group: 'Go to', icon: LineChart, to: '/review/month' },
  { id: '/review/year', label: 'Yearly review', group: 'Go to', icon: LineChart, to: '/review/year' },
];

const ACTIONS: Command[] = [
  { id: 'capture', label: 'Quick capture: note, task or water', group: 'Do', icon: Plus, action: 'capture', keywords: 'add new' },
  { id: 'checkin', label: 'Do today’s check-in', group: 'Do', icon: Sun, to: '/checkin', modules: ['checkin'], keywords: 'mood' },
  { id: 'write', label: 'Write in the journal', group: 'Do', icon: PenLine, to: '/journal/write', modules: ['journal'], keywords: 'new entry' },
  { id: 'weigh', label: 'Log my weight', group: 'Do', icon: Scale, to: '/body/measurements', keywords: 'weigh in kg' },
  { id: 'theme', label: 'Switch light / dark', group: 'Do', icon: Moon, action: 'theme', keywords: 'theme dark mode' },
  { id: 'lock', label: 'Lock Steady now', group: 'Do', icon: Lock, action: 'lock', keywords: 'privacy pin' },
];

/** Every command, without duplicate pages. */
export const COMMANDS: Command[] = [...ACTIONS, ...PAGES].filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i);

/** Case-insensitive match on every word of the query against label + keywords, best (prefix) matches first. */
export function searchCommands(list: Command[], query: string): Command[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list
    .map((c) => {
      const hay = `${c.label} ${c.keywords ?? ''}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      const score = c.label.toLowerCase().startsWith(words[0]) ? 0 : hay.split(/\W+/).some((t) => t.startsWith(words[0])) ? 1 : 2;
      return { c, score };
    })
    .filter((x): x is { c: Command; score: number } => x != null)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.c);
}
