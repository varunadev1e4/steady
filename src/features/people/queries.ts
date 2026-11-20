import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { InteractionKind, PersonRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const peopleKeys = {
  people: ['people'] as const,
  interactions: ['interactions'] as const,
  forPerson: (id: string) => ['interactions', 'person', id] as const,
  range: (from: ISODate, to: ISODate) => ['interactions', 'range', from, to] as const,
  followUps: (id: string) => ['follow_ups', id] as const,
};

export function usePeople() {
  return useQuery({
    queryKey: peopleKeys.people,
    queryFn: async () => unwrap(await supabase.from('people').select('*').order('name')),
  });
}

export function useInteractions(personId: string) {
  return useQuery({
    queryKey: peopleKeys.forPerson(personId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('interactions')
          .select('*')
          .eq('person_id', personId)
          .order('day', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100),
      ),
  });
}

export function useInteractionsRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: peopleKeys.range(from, to),
    queryFn: async () =>
      unwrap(await supabase.from('interactions').select('person_id, day, kind').gte('day', from).lte('day', to)),
  });
}

/** Logging an interaction also updates last_contacted_on (database trigger, same transaction). */
export function useLogInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { person_id: string; kind: InteractionKind; day: ISODate; note?: string | null }) => {
      assertOnline();
      return unwrap(await supabase.from('interactions').insert({ ...v, note: v.note || null }).select('*').single());
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: peopleKeys.people });
      void qc.invalidateQueries({ queryKey: peopleKeys.interactions });
    },
  });
}

export function useDeleteInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('interactions').delete().eq('id', id));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: peopleKeys.people });
      void qc.invalidateQueries({ queryKey: peopleKeys.interactions });
    },
  });
}

export type PersonInput = Pick<
  PersonRow,
  'name' | 'relationship' | 'birthday_month' | 'birthday_day' | 'birth_year' | 'notes' | 'contact_every_days'
>;

export function useSavePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: Partial<PersonInput> & { archived_at?: string | null } }) => {
      assertOnline();
      if (id) return unwrap(await supabase.from('people').update(input).eq('id', id).select('*').single());
      return unwrap(await supabase.from('people').insert(input as PersonInput).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: peopleKeys.people }),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('people').delete().eq('id', id));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: peopleKeys.people });
      void qc.invalidateQueries({ queryKey: peopleKeys.interactions });
    },
  });
}

export function useFollowUps(personId: string) {
  return useQuery({
    queryKey: peopleKeys.followUps(personId),
    queryFn: async () =>
      unwrap(await supabase.from('follow_ups').select('*').eq('person_id', personId).order('created_at')),
  });
}

export function useFollowUpMutations(personId: string) {
  const qc = useQueryClient();
  const done = () => void qc.invalidateQueries({ queryKey: peopleKeys.followUps(personId) });
  const add = useMutation({
    mutationFn: async (text: string) => {
      assertOnline();
      unwrap(await supabase.from('follow_ups').insert({ person_id: personId, text }));
    },
    onSuccess: done,
  });
  const toggle = useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      assertOnline();
      unwrap(await supabase.from('follow_ups').update({ done_at: isDone ? new Date().toISOString() : null }).eq('id', id));
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('follow_ups').delete().eq('id', id));
    },
    onSuccess: done,
  });
  return { add, toggle, remove };
}
