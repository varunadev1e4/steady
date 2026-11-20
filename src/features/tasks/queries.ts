import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { fetchAll, unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { TaskRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const taskKeys = { all: ['tasks'] as const };

/** All open tasks plus the 200 most recently completed. */
export function useTasks() {
  return useQuery({
    queryKey: taskKeys.all,
    queryFn: async () => {
      const open = await fetchAll<TaskRow>((from, to) =>
        supabase.from('tasks').select('*').eq('status', 'open').order('created_at').range(from, to),
      );
      const done = unwrap(
        await supabase.from('tasks').select('*').eq('status', 'done').order('done_at', { ascending: false }).limit(200),
      );
      return [...open, ...done];
    },
  });
}

export type TaskInput = Pick<TaskRow, 'title' | 'notes' | 'due_date' | 'due_time' | 'priority' | 'repeat' | 'tags'>;

export function useSaveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: Partial<TaskInput> }) => {
      assertOnline();
      if (id) return unwrap(await supabase.from('tasks').update(input).eq('id', id).select('*').single());
      return unwrap(await supabase.from('tasks').insert(input as TaskInput).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/** Complete or reopen. Optimistic; the server also creates/removes a repeat's next occurrence. */
export function useSetTaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done, today }: { id: string; done: boolean; today: ISODate }) => {
      assertOnline();
      return unwrap(await supabase.rpc('set_task_done', { p_task: id, p_done: done, p_today: today }));
    },
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = qc.getQueryData<TaskRow[]>(taskKeys.all);
      qc.setQueryData<TaskRow[]>(taskKeys.all, (old) =>
        old?.map((t) => (t.id === id ? { ...t, status: done ? 'done' : 'open', done_at: done ? new Date().toISOString() : null } : t)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(taskKeys.all, ctx.previous),
    onSettled: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('tasks').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
