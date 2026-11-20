import type { TaskPriority, TaskRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export type TaskView = 'today' | 'upcoming' | 'overdue' | 'done';

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

type T = Pick<TaskRow, 'status' | 'due_date' | 'due_time' | 'priority' | 'done_at' | 'title' | 'tags' | 'created_at'>;

const byDueThenPriority = (a: T, b: T) =>
  (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
  (a.due_time ?? '99').localeCompare(b.due_time ?? '99') ||
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  a.created_at.localeCompare(b.created_at);

/**
 * today: open, due today. upcoming: open, due later or with no date (no-date
 * tasks last). overdue: open, due before today. done: most recently finished.
 */
export function tasksForView<X extends T>(tasks: X[], view: TaskView, today: ISODate): X[] {
  switch (view) {
    case 'today':
      return tasks.filter((t) => t.status === 'open' && t.due_date === today).sort(byDueThenPriority);
    case 'upcoming':
      return tasks.filter((t) => t.status === 'open' && (t.due_date == null || t.due_date > today)).sort(byDueThenPriority);
    case 'overdue':
      return tasks.filter((t) => t.status === 'open' && t.due_date != null && t.due_date < today).sort(byDueThenPriority);
    case 'done':
      return tasks.filter((t) => t.status === 'done').sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
  }
}

export function filterTasks<X extends T>(tasks: X[], f: { q?: string; tag?: string; priority?: TaskPriority | '' }): X[] {
  const q = f.q?.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!q || t.title.toLowerCase().includes(q)) &&
      (!f.tag || t.tags.includes(f.tag)) &&
      (!f.priority || t.priority === f.priority),
  );
}
