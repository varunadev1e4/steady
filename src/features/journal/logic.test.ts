import { describe, expect, it } from 'vitest';
import type { JournalEntryRow } from '@/types/database';
import {
  composeEvening,
  entryFileName,
  entryToMarkdown,
  groupByMonth,
  onThisDayDates,
  preview,
  wordCount,
  writingStreak,
} from './logic';

describe('wordCount', () => {
  it('counts words separated by any whitespace', () => {
    expect(wordCount('  hello   world\nagain ')).toBe(3);
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
  });
});

describe('writingStreak', () => {
  it('counts back from today, or from yesterday if today has no entry yet', () => {
    const days = ['2026-03-07', '2026-03-08', '2026-03-09'];
    expect(writingStreak(days, '2026-03-09').current).toBe(3);
    expect(writingStreak(days, '2026-03-10').current).toBe(3);
    expect(writingStreak(days, '2026-03-11').current).toBe(0);
  });

  it('tracks the longest run', () => {
    expect(writingStreak(['2026-01-01', '2026-01-02', '2026-01-03', '2026-02-01'], '2026-02-01')).toEqual({
      current: 1,
      longest: 3,
    });
  });
});

describe('onThisDayDates', () => {
  it('returns earlier months and years, skipping dates that do not exist', () => {
    const d = onThisDayDates('2026-03-31');
    expect(d).toContain('2026-01-31');
    expect(d).not.toContain('2026-02-28'); // no 31 Feb
    expect(d).toContain('2025-03-31');
    expect(d).toContain('2021-03-31');
    expect(d).toHaveLength(6 + 5); // 31-day months among the previous 11, plus 5 years
  });
});

describe('formatting', () => {
  it('composes the evening review with fixed headings', () => {
    expect(composeEvening({ went_well: 'Walk', drained: 'Email', tomorrow: 'Call mum' })).toBe(
      '## What went well\n\nWalk\n\n## What drained me\n\nEmail\n\n## One thing for tomorrow\n\nCall mum',
    );
  });

  it('groups entries by month in the given order', () => {
    const g = groupByMonth([{ day: '2026-03-02' }, { day: '2026-03-01' }, { day: '2026-02-20' }]);
    expect(g.map((x) => [x.label, x.items.length])).toEqual([
      ['March 2026', 2],
      ['February 2026', 1],
    ]);
  });

  it('strips Markdown from previews and truncates', () => {
    expect(preview('# Title\n\n**bold** and _it_')).toBe('Title bold and it');
    expect(preview('a'.repeat(200), 10)).toHaveLength(10);
  });

  it('exports an entry as Markdown with front matter', () => {
    const e = {
      id: 'abcdef12-0000',
      day: '2026-03-01',
      created_at: '2026-03-01T20:00:00Z',
      entry_type: 'free',
      title: 'A "quiet" day',
      body: 'Text',
      mood: 4,
      tags: ['calm'],
      prompt: null,
      pinned: false,
    } as unknown as JournalEntryRow;
    const md = entryToMarkdown(e);
    expect(md).toContain('title: "A \\"quiet\\" day"');
    expect(md).toContain('tags: ["calm"]');
    expect(md).toContain('# A "quiet" day\n\nText');
    expect(entryFileName(e)).toBe('2026-03-01-a-quiet-day-abcdef12.md');
  });
});
