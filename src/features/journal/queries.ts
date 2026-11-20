import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap, unwrapMaybe } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { EntryType, JournalEntryRow, Json, PromptCategory, ThoughtRecordRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';
import type { ThoughtFields } from './logic';

export const ENTRY_COLUMNS =
  'id, user_id, day, entry_type, title, body, fields, prompt, mood, tags, pinned, word_count, created_at, updated_at';

export const journalKeys = {
  all: ['journal'] as const,
  list: (f: JournalFilters) => ['journal', 'list', f] as const,
  entry: (id: string) => ['journal', 'entry', id] as const,
  day: (day: ISODate) => ['journal', 'day', day] as const,
  days: (dates: ISODate[]) => ['journal', 'days', dates] as const,
  pinned: ['journal', 'pinned'] as const,
  stats: ['journal', 'stats'] as const,
  prompts: ['journal_prompts'] as const,
  tags: ['tags'] as const,
};

export interface JournalFilters {
  q?: string;
  tag?: string;
  type?: EntryType | '';
  moodMin?: number;
  moodMax?: number;
  from?: ISODate;
  to?: ISODate;
}

const PAGE = 20;

export function useJournalTimeline(filters: JournalFilters) {
  return useInfiniteQuery({
    queryKey: journalKeys.list(filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from('journal_entries').select(ENTRY_COLUMNS);
      if (filters.q?.trim()) q = q.textSearch('search', filters.q.trim(), { type: 'websearch', config: 'english' });
      if (filters.tag) q = q.contains('tags', [filters.tag]);
      if (filters.type) q = q.eq('entry_type', filters.type);
      if (filters.moodMin) q = q.gte('mood', filters.moodMin);
      if (filters.moodMax) q = q.lte('mood', filters.moodMax);
      if (filters.from) q = q.gte('day', filters.from);
      if (filters.to) q = q.lte('day', filters.to);
      const rows = unwrap(
        await q
          .order('day', { ascending: false })
          .order('created_at', { ascending: false })
          .range(pageParam, pageParam + PAGE - 1),
      ) as JournalEntryRow[];
      return { rows, next: rows.length === PAGE ? pageParam + PAGE : undefined };
    },
    getNextPageParam: (last) => last.next,
  });
}

export function useJournalEntry(id: string | undefined) {
  return useQuery({
    queryKey: journalKeys.entry(id ?? 'none'),
    enabled: Boolean(id),
    queryFn: async () => {
      const entry = unwrapMaybe(
        await supabase.from('journal_entries').select(ENTRY_COLUMNS).eq('id', id!).maybeSingle(),
      ) as JournalEntryRow | null;
      if (!entry) return null;
      const thought =
        entry.entry_type === 'thought_record'
          ? (unwrapMaybe(await supabase.from('thought_records').select('*').eq('entry_id', entry.id).maybeSingle()) as ThoughtRecordRow | null)
          : null;
      return { entry, thought };
    },
  });
}

export function useEntriesOnDays(dates: ISODate[]) {
  return useQuery({
    queryKey: journalKeys.days(dates),
    enabled: dates.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('journal_entries')
          .select(ENTRY_COLUMNS)
          .in('day', dates)
          .order('day', { ascending: false }),
      ) as JournalEntryRow[],
  });
}

export function usePinnedEntries() {
  return useQuery({
    queryKey: journalKeys.pinned,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('journal_entries')
          .select(ENTRY_COLUMNS)
          .eq('pinned', true)
          .order('day', { ascending: false })
          .limit(10),
      ) as JournalEntryRow[],
  });
}

export function useJournalStats() {
  return useQuery({
    queryKey: journalKeys.stats,
    queryFn: async () => unwrap(await supabase.rpc('journal_stats')),
  });
}

export function useTags() {
  return useQuery({
    queryKey: journalKeys.tags,
    queryFn: async () => unwrap(await supabase.from('tags').select('name').order('name')).map((t) => t.name),
    staleTime: 5 * 60_000,
  });
}

export interface EntryDraft {
  id?: string;
  day: ISODate;
  entry_type: EntryType;
  title: string;
  body: string;
  fields: Record<string, string>;
  prompt: string | null;
  mood: number | null;
  tags: string[];
  pinned: boolean;
}

/** Saves (creates or updates) an entry and its thought record in one transaction. */
export async function saveEntry(draft: EntryDraft, thought: ThoughtFields | null): Promise<JournalEntryRow> {
  assertOnline();
  return unwrap(
    await supabase.rpc('save_journal_entry', {
      p_entry: draft as unknown as Json,
      p_thought: thought as unknown as Json,
    }),
  ) as JournalEntryRow;
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('journal_entries').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: journalKeys.all }),
  });
}

export function useCustomPrompts() {
  return useQuery({
    queryKey: journalKeys.prompts,
    queryFn: async () => unwrap(await supabase.from('journal_prompts').select('*').order('created_at')),
  });
}

export function useAddPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, category }: { text: string; category: PromptCategory }) => {
      assertOnline();
      return unwrap(await supabase.from('journal_prompts').insert({ text, category }).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: journalKeys.prompts }),
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('journal_prompts').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: journalKeys.prompts }),
  });
}
