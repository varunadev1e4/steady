import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap, unwrapMaybe } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { NoteRow } from '@/types/database';

export const NOTE_COLUMNS = 'id, user_id, title, body, tags, pinned, archived, created_at, updated_at';
export const noteKeys = {
  all: ['notes'] as const,
  list: (f: NoteFilters) => ['notes', 'list', f] as const,
  one: (id: string) => ['notes', 'one', id] as const,
};

export interface NoteFilters {
  q?: string;
  tag?: string;
  archived: boolean;
}

export function useNotes(f: NoteFilters) {
  return useQuery({
    queryKey: noteKeys.list(f),
    queryFn: async () => {
      let q = supabase.from('notes').select(NOTE_COLUMNS).eq('archived', f.archived);
      if (f.q?.trim()) q = q.textSearch('search', f.q.trim(), { type: 'websearch', config: 'english' });
      if (f.tag) q = q.contains('tags', [f.tag]);
      return unwrap(
        await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(200),
      ) as NoteRow[];
    },
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: noteKeys.one(id ?? 'none'),
    enabled: Boolean(id),
    queryFn: async () => unwrapMaybe(await supabase.from('notes').select(NOTE_COLUMNS).eq('id', id!).maybeSingle()) as NoteRow | null,
  });
}

export type NoteInput = Pick<NoteRow, 'title' | 'body' | 'tags' | 'pinned' | 'archived'>;

export async function saveNote(id: string | undefined, input: Partial<NoteInput>): Promise<NoteRow> {
  assertOnline();
  if (id) return unwrap(await supabase.from('notes').update(input).eq('id', id).select(NOTE_COLUMNS).single()) as NoteRow;
  return unwrap(await supabase.from('notes').insert(input).select(NOTE_COLUMNS).single()) as NoteRow;
}

export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<NoteInput> }) => saveNote(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('notes').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}
