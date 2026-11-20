import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useDeleteTask, useSaveTask, useTasks, type TaskInput } from '@/features/tasks/queries';
import { filterTasks, tasksForView, type TaskView } from '@/features/tasks/logic';
import { TaskRow } from '@/features/tasks/TaskRow';
import { useTags } from '@/features/journal/queries';
import { useToday } from '@/features/profile/useToday';
import type { TaskPriority, TaskRepeat, TaskRow as Task } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Segmented, TagInput } from '@/components/ui/Controls';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, EmptyState, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { addDaysISO } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const REPEATS = [
  { value: 'none', label: "Doesn't repeat" },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
];

function TaskForm({ task, onDone }: { task: Task | null; onDone: () => void }) {
  const { today } = useToday();
  const save = useSaveTask();
  const del = useDeleteTask();
  const confirm = useConfirm();
  const tags = useTags();
  const [v, setV] = useState<TaskInput>({
    title: task?.title ?? '',
    notes: task?.notes ?? '',
    due_date: task?.due_date ?? today,
    due_time: task?.due_time?.slice(0, 5) ?? null,
    priority: task?.priority ?? 'medium',
    repeat: task?.repeat ?? 'none',
    tags: task?.tags ?? [],
  });
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.title.trim()) return setErr('Give the task a title.');
        if (v.due_time && !v.due_date) return setErr('A time needs a date.');
        setErr(null);
        save.mutate({ id: task?.id, input: { ...v, title: v.title.trim(), notes: v.notes?.trim() || null } }, { onSuccess: onDone });
      }}
    >
      <TextField label="Title" value={v.title} maxLength={200} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus={!task} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Due date" type="date" value={v.due_date ?? ''} onChange={(e) => setV({ ...v, due_date: e.target.value || null, due_time: e.target.value ? v.due_time : null })} />
        <TextField label="Time (optional)" type="time" value={v.due_time ?? ''} disabled={!v.due_date} onChange={(e) => setV({ ...v, due_time: e.target.value || null })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setV({ ...v, due_date: today })}>
          Today
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setV({ ...v, due_date: addDaysISO(today, 1) })}>
          Tomorrow
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setV({ ...v, due_date: null, due_time: null })}>
          No date
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Priority" value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as TaskPriority })} options={PRIORITIES} />
        <SelectField label="Repeat" value={v.repeat} onChange={(e) => setV({ ...v, repeat: e.target.value as TaskRepeat })} options={REPEATS} />
      </div>
      <TagInput value={v.tags} onChange={(t) => setV({ ...v, tags: t })} suggestions={tags.data ?? []} />
      <TextAreaField label="Notes (optional)" rows={3} value={v.notes ?? ''} maxLength={5000} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      {(err || save.isError) && <FormMessage tone="error">{err ?? errorMessage(save.error)}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={save.isPending}>
          {task ? 'Save task' : 'Add task'}
        </Button>
        {task && (
          <Button
            variant="ghost"
            className="text-danger"
            onClick={async () => {
              if (await confirm({ title: 'Delete this task?', confirmLabel: 'Delete', danger: true })) {
                del.mutate(task.id, { onSuccess: onDone });
              }
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}

export function TasksPage() {
  const { today } = useToday();
  const tasks = useTasks();
  const save = useSaveTask();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const view = (['today', 'upcoming', 'overdue', 'done'].includes(params.get('view') ?? '') ? params.get('view') : 'today') as TaskView;
  const [quick, setQuick] = useState('');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');

  const all = useMemo(() => tasks.data ?? [], [tasks.data]);
  const counts = useMemo(
    () => ({
      today: tasksForView(all, 'today', today).length,
      overdue: tasksForView(all, 'overdue', today).length,
    }),
    [all, today],
  );
  const list = filterTasks(tasksForView(all, view, today), { q, tag, priority });
  const tagOptions = [...new Set(all.flatMap((t) => t.tags))].sort();

  return (
    <>
      <PageHeader
        title="Tasks"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden />
            Detailed task
          </Button>
        }
      />
      <Sheet open={editing != null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New task' : 'Edit task'}>
        <TaskForm task={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      </Sheet>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = quick.trim();
          if (!title) return;
          save.mutate(
            { input: { title, due_date: view === 'upcoming' ? null : today } },
            { onSuccess: () => setQuick(''), onError: (err) => toast(errorMessage(err), 'error') },
          );
        }}
      >
        <TextField
          label="Quick add"
          hideLabel
          wrapperClassName="flex-1"
          placeholder={view === 'upcoming' ? 'Add a task (no date)…' : 'Add a task for today…'}
          value={quick}
          maxLength={200}
          onChange={(e) => setQuick(e.target.value)}
        />
        <Button type="submit" loading={save.isPending} aria-label="Add task">
          <Plus className="h-5 w-5" aria-hidden />
        </Button>
      </form>

      <Segmented
        label="Task view"
        value={view}
        onChange={(v) => setParams(v === 'today' ? {} : { view: v }, { replace: true })}
        options={[
          { value: 'today', label: `Today${counts.today ? ` ${counts.today}` : ''}` },
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'overdue', label: `Overdue${counts.overdue ? ` ${counts.overdue}` : ''}` },
          { value: 'done', label: 'Done' },
        ]}
        className="mb-3"
      />

      <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-2">
        <input type="search" aria-label="Search tasks" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="input" />
        <SelectField label="Tag" hideLabel value={tag} onChange={(e) => setTag(e.target.value)} options={[{ value: '', label: 'All tags' }, ...tagOptions.map((t) => ({ value: t, label: `#${t}` }))]} />
        <SelectField label="Priority" hideLabel value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | '')} options={[{ value: '', label: 'Any priority' }, ...PRIORITIES]} />
      </div>

      {tasks.isPending ? (
        <CardSkeleton />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={view === 'overdue' ? 'Nothing overdue' : view === 'done' ? 'Nothing finished yet' : 'Nothing here'}>
          {view === 'today' ? 'Add something above, or enjoy the space.' : view === 'overdue' ? 'All caught up.' : null}
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-border py-1">
          {list.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={() => setEditing(t)} />
          ))}
        </ul>
      )}
    </>
  );
}
