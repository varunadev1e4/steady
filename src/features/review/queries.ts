import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap, unwrapMaybe } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { WeekSummary, WeeklyReviewRow } from '@/types/database';
import { addDaysISO, type ISODate } from '@/utils/dates';

export const reviewKeys = {
  all: ['weekly_reviews'] as const,
  one: (week: ISODate) => ['weekly_reviews', week] as const,
  summary: (week: ISODate) => ['week_summary', week] as const,
};

export function useWeekSummary(weekStart: ISODate, tz: string, today: ISODate) {
  return useQuery({
    queryKey: [...reviewKeys.summary(weekStart), today],
    queryFn: async () =>
      unwrap(
        await supabase.rpc('week_summary', { p_start: weekStart, p_end: addDaysISO(weekStart, 6), p_tz: tz, p_today: today }),
      ) as WeekSummary,
  });
}

/** The same summary over any date range (months and years). */
export function usePeriodSummary(start: ISODate, end: ISODate, tz: string, today: ISODate) {
  return useQuery({
    queryKey: ['period_summary', start, end, today],
    queryFn: async () =>
      unwrap(await supabase.rpc('week_summary', { p_start: start, p_end: end, p_tz: tz, p_today: today })) as WeekSummary,
  });
}

export function useReview(weekStart: ISODate) {
  return useQuery({
    queryKey: reviewKeys.one(weekStart),
    queryFn: async () => unwrapMaybe(await supabase.from('weekly_reviews').select('*').eq('week_start', weekStart).maybeSingle()),
  });
}

export function useReviews() {
  return useQuery({
    queryKey: reviewKeys.all,
    queryFn: async () =>
      unwrap(await supabase.from('weekly_reviews').select('*').order('week_start', { ascending: false }).limit(104)),
  });
}

export type ReviewInput = Pick<WeeklyReviewRow, 'week_start' | 'went_well' | 'didnt_go_well' | 'learned' | 'next_focus'>;

export function useSaveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ReviewInput) => {
      assertOnline();
      return unwrap(await supabase.from('weekly_reviews').upsert(v, { onConflict: 'user_id,week_start' }).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: reviewKeys.all }),
  });
}
