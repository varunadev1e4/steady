import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import { workoutKeys } from '@/features/workouts/queries';
import type { Json, PlanEnrollmentRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';
import { STRENGTH, STRENGTH_LIBRARY, STRENGTH_PHASES, type Plan, type PlanId } from './content';

export const planKeys = {
  enrollments: ['plan_enrollments'] as const,
  logDays: (id: string) => ['plan_enrollments', 'log_days', id] as const,
};

/** Active enrollments (one per plan at most). */
export function useEnrollments() {
  return useQuery({
    queryKey: planKeys.enrollments,
    queryFn: async () =>
      unwrap(await supabase.from('plan_enrollments').select('*').is('ended_at', null).order('created_at')) as PlanEnrollmentRow[],
  });
}

export function useStartPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ plan, start, weekdays }: { plan: Plan; start: ISODate; weekdays: number[] }) => {
      assertOnline();
      const template =
        plan.id === STRENGTH.id
          ? {
              name: 'Home strength (beginner plan)',
              notes: 'Created by the beginner strength plan. Planks: log seconds held as reps.',
              library: STRENGTH_LIBRARY,
              exercises: STRENGTH_PHASES[0].targets,
            }
          : null;
      return unwrap(
        await supabase.rpc('start_plan', {
          p_plan: plan.id,
          p_start: start,
          p_weekdays: weekdays,
          p_template: template as unknown as Json,
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.enrollments });
      void qc.invalidateQueries({ queryKey: workoutKeys.templates });
      void qc.invalidateQueries({ queryKey: workoutKeys.templateExercises });
      void qc.invalidateQueries({ queryKey: workoutKeys.exercises });
    },
  });
}

export function useUpdateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<PlanEnrollmentRow, 'start_date' | 'weekdays' | 'ended_at'>> }) => {
      assertOnline();
      unwrap(await supabase.from('plan_enrollments').update(patch).eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: planKeys.enrollments }),
  });
}

/** Days with a logged session for this enrollment (walks, yoga, or workouts from its template). */
export function usePlanLogDays(enrollment: PlanEnrollmentRow | undefined, plan: Plan | undefined) {
  return useQuery({
    queryKey: [...planKeys.logDays(enrollment?.id ?? 'none'), enrollment?.start_date],
    enabled: Boolean(enrollment && plan),
    queryFn: async (): Promise<ISODate[]> => {
      const e = enrollment!;
      if (plan!.logActivity) {
        const rows = unwrap(
          await supabase.from('cardio_entries').select('day').eq('activity', plan!.logActivity).gte('day', e.start_date),
        );
        return rows.map((r) => r.day);
      }
      if (!e.template_id) return [];
      const rows = unwrap(await supabase.from('workouts').select('day').eq('template_id', e.template_id).gte('day', e.start_date));
      return rows.map((r) => r.day);
    },
  });
}

export const enrollmentFor = (rows: PlanEnrollmentRow[] | undefined, id: PlanId) => rows?.find((r) => r.plan_id === id);
