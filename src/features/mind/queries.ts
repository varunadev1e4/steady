import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { ActivityRow, AssessmentRow, CravingRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const mindKeys = {
  activities: ['activities'] as const,
  assessments: ['assessments'] as const,
  cravings: ['cravings'] as const,
};

export function useActivities(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: [...mindKeys.activities, from, to],
    queryFn: async () =>
      unwrap(
        await supabase.from('activities').select('*').gte('day', from).lte('day', to).order('day').order('planned_time', { nullsFirst: false }).order('created_at'),
      ) as ActivityRow[],
  });
}

export type ActivityInput = Partial<Pick<ActivityRow, 'day' | 'title' | 'category' | 'planned_time' | 'status' | 'mood_before' | 'mood_after' | 'note' | 'completed_at'>>;

export function useSaveActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ActivityInput }) => {
      assertOnline();
      if (id) return unwrap(await supabase.from('activities').update(input).eq('id', id).select('*').single());
      return unwrap(await supabase.from('activities').insert(input as Required<Pick<ActivityRow, 'day' | 'title'>>).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: mindKeys.activities }),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('activities').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: mindKeys.activities }),
  });
}

export function useAssessments() {
  return useQuery({
    queryKey: mindKeys.assessments,
    queryFn: async () => unwrap(await supabase.from('assessments').select('*').order('day', { ascending: false }).order('created_at', { ascending: false })) as AssessmentRow[],
  });
}

export function useAddAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Pick<AssessmentRow, 'kind' | 'day' | 'answers' | 'difficulty'>) => {
      assertOnline();
      return unwrap(await supabase.from('assessments').insert(v).select('*').single()) as AssessmentRow;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: mindKeys.assessments }),
  });
}

export function useDeleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('assessments').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: mindKeys.assessments }),
  });
}

export function useCravings(from: ISODate) {
  return useQuery({
    queryKey: [...mindKeys.cravings, from],
    queryFn: async () => unwrap(await supabase.from('cravings').select('*').gte('day', from).order('logged_at', { ascending: false })) as CravingRow[],
  });
}

export type CravingInput = Partial<Pick<CravingRow, 'day' | 'trigger' | 'intensity' | 'food' | 'waited_minutes' | 'intensity_after' | 'outcome' | 'note'>>;

export function useSaveCraving() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: CravingInput }) => {
      assertOnline();
      if (id) return unwrap(await supabase.from('cravings').update(input).eq('id', id).select('*').single()) as CravingRow;
      return unwrap(await supabase.from('cravings').insert(input as Required<Pick<CravingRow, 'day' | 'trigger' | 'intensity'>>).select('*').single()) as CravingRow;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: mindKeys.cravings }),
  });
}

export function useDeleteCraving() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('cravings').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: mindKeys.cravings }),
  });
}
