import { describe, expect, it } from 'vitest';
import { filterTasks, tasksForView } from './logic';

const t = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: id,
  status: 'open' as 'open' | 'done',
  due_date: null as string | null,
  due_time: null as string | null,
  priority: 'medium' as 'low' | 'medium' | 'high',
  done_at: null as string | null,
  tags: [] as string[],
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

const tasks = [
  t('today-low', { due_date: '2026-03-10', priority: 'low' }),
  t('today-high', { due_date: '2026-03-10', priority: 'high' }),
  t('today-timed', { due_date: '2026-03-10', due_time: '09:00', priority: 'low' }),
  t('later', { due_date: '2026-03-12' }),
  t('someday'),
  t('late', { due_date: '2026-03-01' }),
  t('done-old', { status: 'done', done_at: '2026-03-01T10:00:00Z', due_date: '2026-03-10' }),
  t('done-new', { status: 'done', done_at: '2026-03-09T10:00:00Z' }),
];

describe('tasksForView', () => {
  const ids = (v: Parameters<typeof tasksForView>[1]) => tasksForView(tasks, v, '2026-03-10').map((x) => x.id);

  it('today: open tasks due today, timed first then by priority', () => {
    expect(ids('today')).toEqual(['today-timed', 'today-high', 'today-low']);
  });

  it('upcoming: later dates, then tasks with no date', () => {
    expect(ids('upcoming')).toEqual(['later', 'someday']);
  });

  it('overdue: open tasks before today only', () => {
    expect(ids('overdue')).toEqual(['late']);
  });

  it('done: most recent first, regardless of due date', () => {
    expect(ids('done')).toEqual(['done-new', 'done-old']);
  });
});

describe('filterTasks', () => {
  it('filters by text, tag and priority together', () => {
    const list = [t('Buy milk', { tags: ['home'] }), t('Call bank', { priority: 'high', tags: ['admin'] }), t('Buy stamps', { tags: ['admin'] })];
    expect(filterTasks(list, { q: 'buy' }).map((x) => x.id)).toEqual(['Buy milk', 'Buy stamps']);
    expect(filterTasks(list, { tag: 'admin', priority: 'high' }).map((x) => x.id)).toEqual(['Call bank']);
  });
});
