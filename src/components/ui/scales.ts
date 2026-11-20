import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react';

export const MOODS: Array<{ value: number; label: string; icon: LucideIcon }> = [
  { value: 1, label: 'Rough', icon: Frown },
  { value: 2, label: 'Low', icon: Annoyed },
  { value: 3, label: 'Okay', icon: Meh },
  { value: 4, label: 'Good', icon: Smile },
  { value: 5, label: 'Great', icon: Laugh },
];

export const moodLabel = (v: number | null | undefined) => MOODS.find((m) => m.value === v)?.label ?? '–';

export const normaliseTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
