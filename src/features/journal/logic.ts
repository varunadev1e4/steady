import { format, getDaysInMonth, subMonths, subYears } from 'date-fns';
import type { EntryType, JournalEntryRow, ThoughtRecordRow } from '@/types/database';
import { addDaysISO, parseISODate, toISODate, type ISODate } from '@/utils/dates';

export const ENTRY_TYPES: Array<{ value: EntryType; label: string; description: string }> = [
  { value: 'free', label: 'Free write', description: 'Anything on your mind.' },
  { value: 'gratitude', label: 'Gratitude', description: 'A few things you’re thankful for.' },
  { value: 'evening', label: 'Evening review', description: 'What went well, what drained you, one thing for tomorrow.' },
  { value: 'brain_dump', label: 'Brain dump', description: 'Empty your head, no editing.' },
  { value: 'thought_record', label: 'Thought record', description: 'Look at a difficult thought step by step.' },
];

export const entryTypeLabel = (t: EntryType) => ENTRY_TYPES.find((e) => e.value === t)?.label ?? t;

export const EVENING_SECTIONS = [
  { key: 'went_well', label: 'What went well' },
  { key: 'drained', label: 'What drained me' },
  { key: 'tomorrow', label: 'One thing for tomorrow' },
] as const;

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Readable Markdown for an evening review, stored in body for search and export. */
export function composeEvening(fields: Record<string, string>): string {
  return EVENING_SECTIONS.map((s) => `## ${s.label}\n\n${(fields[s.key] ?? '').trim()}`).join('\n\n').trim();
}

export type ThoughtFields = Pick<
  ThoughtRecordRow,
  | 'situation'
  | 'automatic_thought'
  | 'belief_before'
  | 'evidence_for'
  | 'evidence_against'
  | 'balanced_thought'
  | 'belief_after'
>;

export const EMPTY_THOUGHT: ThoughtFields = {
  situation: '',
  automatic_thought: '',
  belief_before: null,
  evidence_for: '',
  evidence_against: '',
  balanced_thought: '',
  belief_after: null,
};

export function composeThoughtRecord(t: ThoughtFields): string {
  const pct = (n: number | null) => (n == null ? '–' : `${n}%`);
  return [
    `## Situation\n\n${t.situation.trim()}`,
    `## The thought\n\n${t.automatic_thought.trim()}\n\nBelieved it: ${pct(t.belief_before)}`,
    `## Evidence for\n\n${t.evidence_for.trim()}`,
    `## Evidence against\n\n${t.evidence_against.trim()}`,
    `## A more balanced thought\n\n${t.balanced_thought.trim()}\n\nBelief afterwards: ${pct(t.belief_after)}`,
  ].join('\n\n');
}

export interface WritingStreak {
  current: number;
  longest: number;
}

/** Consecutive days with at least one entry. Today not written yet doesn't break it. */
export function writingStreak(days: Iterable<ISODate>, today: ISODate): WritingStreak {
  const set = new Set(days);
  const sorted = [...set].filter((d) => d <= today).sort();
  let longest = 0;
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of sorted) {
    run = prev && addDaysISO(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  let current = 0;
  let cursor = set.has(today) ? today : addDaysISO(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDaysISO(cursor, -1);
  }
  return { current, longest };
}

/** Same calendar day in each of the previous 11 months and 5 years (skipping impossible dates). */
export function onThisDayDates(today: ISODate): ISODate[] {
  const t = parseISODate(today);
  const day = t.getDate();
  const out: ISODate[] = [];
  for (let m = 1; m <= 11; m++) {
    const d = subMonths(t, m);
    if (getDaysInMonth(d) >= day && d.getDate() === day) out.push(toISODate(d));
  }
  for (let y = 1; y <= 5; y++) {
    const d = subYears(t, y);
    if (d.getDate() === day) out.push(toISODate(d));
  }
  return out;
}

export function groupByMonth<T extends { day: ISODate }>(entries: T[]): Array<{ month: string; label: string; items: T[] }> {
  const groups: Array<{ month: string; label: string; items: T[] }> = [];
  for (const e of entries) {
    const month = e.day.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.month !== month) {
      g = { month, label: format(parseISODate(`${month}-01`), 'MMMM yyyy'), items: [] };
      groups.push(g);
    }
    g.items.push(e);
  }
  return groups;
}

/** A short plain-text preview (Markdown symbols stripped). */
export function preview(body: string, max = 160): string {
  const plain = body
    .replace(/^#+\s*/gm, '')
    .replace(/[*_>`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .slice(0, 50) || 'entry'
  );
}

/** One Markdown file per entry, with a small front-matter header. */
export function entryToMarkdown(e: JournalEntryRow): string {
  const yamlString = (s: string) => JSON.stringify(s);
  const front = [
    '---',
    `date: ${e.day}`,
    `written: ${e.created_at}`,
    `type: ${e.entry_type}`,
    e.title ? `title: ${yamlString(e.title)}` : null,
    e.mood != null ? `mood: ${e.mood}` : null,
    e.tags.length ? `tags: [${e.tags.map(yamlString).join(', ')}]` : null,
    e.prompt ? `prompt: ${yamlString(e.prompt)}` : null,
    e.pinned ? 'pinned: true' : null,
    '---',
  ].filter(Boolean);
  const heading = e.title ? `# ${e.title}\n\n` : '';
  return `${front.join('\n')}\n\n${heading}${e.body}\n`;
}

export function entryFileName(e: JournalEntryRow): string {
  return `${e.day}-${slugify(e.title || entryTypeLabel(e.entry_type))}-${e.id.slice(0, 8)}.md`;
}
