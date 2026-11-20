import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { MedicationDoseRow, MedicationNoteRow, MedicationRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const medKeys = {
  meds: ['medications'] as const,
  doses: ['medication_doses'] as const,
  notes: ['medication_notes'] as const,
};

export function useMedications() {
  return useQuery({
    queryKey: medKeys.meds,
    queryFn: async () => unwrap(await supabase.from('medications').select('*').order('name')) as MedicationRow[],
  });
}

export function useDoses(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: [...medKeys.doses, from, to],
    queryFn: async () =>
      unwrap(await supabase.from('medication_doses').select('*').gte('day', from).lte('day', to).order('taken_at')) as MedicationDoseRow[],
  });
}

const refresh = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: medKeys.doses });
  void qc.invalidateQueries({ queryKey: medKeys.meds }); // pill counts change
};

/** Mark a dose taken or skipped (pill count updated in the same transaction). */
export function useLogDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { medicationId: string; day: ISODate; time: string | null; status: 'taken' | 'skipped'; note?: string | null }) => {
      assertOnline();
      return unwrap(
        await supabase.rpc('log_dose', { p_medication: v.medicationId, p_day: v.day, p_time: v.time, p_status: v.status, p_note: v.note ?? null }),
      );
    },
    onSuccess: () => refresh(qc),
  });
}

export function useUndoDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doseId: string) => {
      assertOnline();
      unwrap(await supabase.rpc('undo_dose', { p_dose: doseId }));
    },
    onSuccess: () => refresh(qc),
  });
}

export type MedicationInput = Pick<
  MedicationRow,
  'name' | 'dose' | 'form' | 'purpose' | 'instructions' | 'schedule_times' | 'weekdays' | 'as_needed' | 'start_date' | 'end_date' | 'pills_left' | 'pills_per_dose' | 'refill_at'
>;

export function useSaveMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: Partial<MedicationInput> & { archived_at?: string | null } }) => {
      assertOnline();
      if (id) return unwrap(await supabase.from('medications').update(input).eq('id', id).select('*').single());
      return unwrap(await supabase.from('medications').insert(input as MedicationInput).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: medKeys.meds }),
  });
}

export function useDeleteMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('medications').delete().eq('id', id));
    },
    onSuccess: () => refresh(qc),
  });
}

export function useMedNotes() {
  return useQuery({
    queryKey: medKeys.notes,
    queryFn: async () => unwrap(await supabase.from('medication_notes').select('*').order('day', { ascending: false }).order('created_at', { ascending: false }).limit(200)) as MedicationNoteRow[],
  });
}

export function useAddMedNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { medication_id: string | null; day: ISODate; text: string }) => {
      assertOnline();
      unwrap(await supabase.from('medication_notes').insert(v));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: medKeys.notes }),
  });
}

export function useDeleteMedNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('medication_notes').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: medKeys.notes }),
  });
}
