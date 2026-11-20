import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { HealthReadingRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const healthKeys = { all: ['health_readings'] as const };

export function useHealthReadings(from: ISODate) {
  return useQuery({
    queryKey: [...healthKeys.all, from],
    queryFn: async () =>
      unwrap(
        await supabase.from('health_readings').select('*').gte('day', from).order('day', { ascending: false }).order('taken_at', { ascending: false }),
      ) as HealthReadingRow[],
  });
}

export type HealthInput = Pick<HealthReadingRow, 'day' | 'systolic' | 'diastolic' | 'resting_hr' | 'glucose_mg_dl' | 'glucose_context' | 'note'>;

export function useAddReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: HealthInput) => {
      assertOnline();
      return unwrap(await supabase.from('health_readings').insert(v).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: healthKeys.all }),
  });
}

export function useDeleteReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('health_readings').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: healthKeys.all }),
  });
}
