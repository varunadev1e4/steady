import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format } from 'date-fns';
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Pin,
  Plus,
  Search,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import {
  useAddPrompt,
  useCustomPrompts,
  useDeletePrompt,
  useEntriesOnDays,
  useJournalStats,
  useJournalTimeline,
  usePinnedEntries,
  useTags,
  type JournalFilters,
} from '@/features/journal/queries';
import { ENTRY_TYPES, entryTypeLabel, groupByMonth, onThisDayDates, preview, writingStreak } from '@/features/journal/logic';
import { BUILT_IN_PROMPTS, PROMPT_CATEGORIES, categoryLabel, promptForDay, type Prompt } from '@/features/journal/prompts';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { EntryType, JournalEntryRow, PromptCategory } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Sheet } from '@/components/ui/Sheet';
import { Segmented } from '@/components/ui/Controls';
import { MOODS } from '@/components/ui/scales';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/Layout';
import { CardSkeleton, EmptyState, ErrorState, FormMessage } from '@/components/ui/States';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

function EntryCard({ entry }: { entry: JournalEntryRow }) {
  const profile = useLoadedProfile();
  const Mood = MOODS.find((m) => m.value === entry.mood)?.icon;
  return (
    <Link to={`/journal/write/${entry.id}`} className="card block transition-colors hover:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {formatISODate(entry.day, profile.date_format)} · {entryTypeLabel(entry.entry_type)}
          </p>
          <h3 className="mt-0.5 truncate text-base">{entry.title || preview(entry.body, 60) || 'Untitled'}</h3>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-muted">
          {entry.pinned && <Pin className="h-4 w-4 text-clay-ink" aria-label="Pinned" />}
          {Mood && <Mood className="h-4 w-4" aria-label={`Mood ${entry.mood}`} />}
        </span>
      </div>
      {entry.title && entry.body && <p className="mt-1.5 line-clamp-2 font-serif text-muted">{preview(entry.body)}</p>}
      {entry.tags.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1">
          {entry.tags.map((t) => (
            <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-ink">
              {t}
            </span>
          ))}
        </p>
      )}
    </Link>
  );
}

function PromptCard() {
  const { today } = useToday();
  const navigate = useNavigate();
  const custom = useCustomPrompts();
  const [offset, setOffset] = useState(0);
  const [managing, setManaging] = useState(false);
  const all: Prompt[] = useMemo(
    () => [...BUILT_IN_PROMPTS, ...(custom.data ?? []).map((p) => ({ category: p.category, text: p.text }))],
    [custom.data],
  );
  const base = promptForDay(today, all);
  const prompt = offset === 0 ? base : all[(all.indexOf(base) + offset * 7) % all.length];

  return (
    <section className="card" aria-labelledby="prompt-title">
      <p id="prompt-title" className="text-xs font-medium text-clay-ink">
        {offset === 0 ? "Today's prompt" : 'Another prompt'} · {categoryLabel(prompt.category)}
      </p>
      <p className="mt-2 font-serif text-lg leading-relaxed">{prompt.text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => navigate(`/journal/write?type=free&prompt=${encodeURIComponent(prompt.text)}`)}
        >
          Write about this
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOffset((o) => o + 1)}>
          <Shuffle className="h-4 w-4" aria-hidden />
          Shuffle
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setManaging(true)}>
          Your prompts
        </Button>
      </div>
      <Sheet open={managing} onClose={() => setManaging(false)} title="Your prompts" description="Your own prompts join the daily rotation.">
        <CustomPrompts />
      </Sheet>
    </section>
  );
}

function CustomPrompts() {
  const prompts = useCustomPrompts();
  const add = useAddPrompt();
  const del = useDeletePrompt();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<PromptCategory>('custom');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t.length < 3) return setError('Write at least a few words.');
          setError(null);
          add.mutate({ text: t, category }, { onSuccess: () => setText('') });
        }}
      >
        <TextAreaField label="New prompt" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} error={error ?? undefined} />
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as PromptCategory)}
          options={[{ value: 'custom', label: 'My own' }, ...PROMPT_CATEGORIES]}
        />
        {add.isError && <FormMessage tone="error">{errorMessage(add.error)}</FormMessage>}
        <Button type="submit" loading={add.isPending}>
          Save prompt
        </Button>
      </form>
      {prompts.data && prompts.data.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {prompts.data.map((p) => (
            <li key={p.id} className="flex items-start gap-2 py-2">
              <span className="flex-1 font-serif">{p.text}</span>
              <IconButton label="Delete prompt" onClick={() => del.mutate(p.id)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewEntrySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="New entry">
      <ul className="space-y-2">
        {ENTRY_TYPES.map((t) => (
          <li key={t.value}>
            <Link to={`/journal/write?type=${t.value}`} className="block rounded-input border border-border bg-surface px-4 py-3 hover:bg-panel">
              <span className="font-medium">{t.label}</span>
              <span className="block text-sm text-muted">{t.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function FiltersSheet({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: JournalFilters;
  onApply: (f: JournalFilters) => void;
}) {
  const tags = useTags();
  const [f, setF] = useState(filters);
  useEffect(() => setF(filters), [filters, open]);
  const moodOptions = [{ value: '', label: 'Any' }, ...MOODS.map((m) => ({ value: String(m.value), label: `${m.value} · ${m.label}` }))];
  return (
    <Sheet open={open} onClose={onClose} title="Filter entries">
      <div className="space-y-4">
        <SelectField
          label="Tag"
          value={f.tag ?? ''}
          onChange={(e) => setF({ ...f, tag: e.target.value || undefined })}
          options={[{ value: '', label: 'Any tag' }, ...(tags.data ?? []).map((t) => ({ value: t, label: t }))]}
        />
        <SelectField
          label="Type"
          value={f.type ?? ''}
          onChange={(e) => setF({ ...f, type: (e.target.value || '') as EntryType | '' })}
          options={[{ value: '', label: 'Any type' }, ...ENTRY_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Mood from" value={f.moodMin ? String(f.moodMin) : ''} onChange={(e) => setF({ ...f, moodMin: Number(e.target.value) || undefined })} options={moodOptions} />
          <SelectField label="Mood to" value={f.moodMax ? String(f.moodMax) : ''} onChange={(e) => setF({ ...f, moodMax: Number(e.target.value) || undefined })} options={moodOptions} />
          <TextField label="From date" type="date" value={f.from ?? ''} onChange={(e) => setF({ ...f, from: e.target.value || undefined })} />
          <TextField label="To date" type="date" value={f.to ?? ''} onChange={(e) => setF({ ...f, to: e.target.value || undefined })} />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              onApply(f);
              onClose();
            }}
          >
            Apply filters
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onApply({ q: f.q });
              onClose();
            }}
          >
            Clear
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function CalendarView({ onPickDay }: { onPickDay: (day: string) => void }) {
  const { today, weekStart } = useToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const start = `${month}-01`;
  const end = format(addMonths(parseISODate(start), 1), 'yyyy-MM-dd');
  const days = useQuery({
    queryKey: ['journal', 'month', month],
    queryFn: async () =>
      new Set(
        unwrap(await supabase.from('journal_entries').select('day').gte('day', start).lt('day', end)).map((r) => r.day),
      ),
  });
  const leading = (parseISODate(start).getDay() - weekStart + 7) % 7;
  const cells: string[] = [];
  for (let d = start; d < end; d = addDaysISO(d, 1)) cells.push(d);

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base">{format(parseISODate(start), 'MMMM yyyy')}</h2>
        <div className="flex">
          <IconButton label="Previous month" onClick={() => setMonth(format(addMonths(parseISODate(start), -1), 'yyyy-MM'))}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton
            label="Next month"
            disabled={month >= today.slice(0, 7)}
            onClick={() => setMonth(format(addMonths(parseISODate(start), 1), 'yyyy-MM'))}
          >
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>
      </div>
      {days.isError ? (
        <ErrorState error={days.error} onRetry={() => void days.refetch()} />
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: leading }, (_, i) => (
            <span key={i} />
          ))}
          {cells.map((d) => {
            const has = days.data?.has(d);
            return (
              <button
                key={d}
                type="button"
                disabled={!has}
                onClick={() => onPickDay(d)}
                aria-label={`${formatISODate(d, 'EEE d MMM')}${has ? ': has entries' : ''}`}
                className={cn(
                  'relative flex aspect-square items-center justify-center rounded-[6px] text-sm tabular-nums',
                  has ? 'bg-accent-soft font-semibold text-accent-ink hover:bg-accent/30' : 'text-muted',
                  d === today && 'ring-1 ring-ink/40',
                )}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function JournalHome() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const stats = useJournalStats();
  const pinned = usePinnedEntries();
  const onThisDay = useEntriesOnDays(useMemo(() => onThisDayDates(today), [today]));
  const [newOpen, setNewOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<JournalFilters>({});

  useEffect(() => {
    const id = window.setTimeout(() => setFilters((f) => ({ ...f, q: search.trim() || undefined })), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const timeline = useJournalTimeline(filters);
  const rows = useMemo(() => timeline.data?.pages.flatMap((p) => p.rows) ?? [], [timeline.data]);
  const groups = useMemo(() => groupByMonth(rows), [rows]);
  const streak = stats.data ? writingStreak(stats.data.days, today) : null;
  const activeFilters = Object.entries(filters).filter(([k, v]) => k !== 'q' && v != null && v !== '');
  const filtering = activeFilters.length > 0 || Boolean(filters.q);

  return (
    <>
      <PageHeader
        title="Journal"
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New entry
          </Button>
        }
      />
      <NewEntrySheet open={newOpen} onClose={() => setNewOpen(false)} />
      <div className="space-y-4">
        <PromptCard />

        {stats.data && stats.data.total_entries > 0 && (
          <p className="text-sm text-muted">
            {stats.data.total_entries} {stats.data.total_entries === 1 ? 'entry' : 'entries'} ·{' '}
            {stats.data.total_words.toLocaleString()} words written
            {streak && streak.current > 0 && (
              <>
                {' '}· <span className="text-clay-ink">{streak.current}-day writing streak</span>
              </>
            )}
            {streak && streak.longest > 1 && ` · longest ${streak.longest} days`}
          </p>
        )}

        {onThisDay.data && onThisDay.data.length > 0 && (
          <section aria-labelledby="otd" className="space-y-2">
            <h2 id="otd" className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-clay-ink" aria-hidden />
              On this day
            </h2>
            {onThisDay.data.slice(0, 3).map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </section>
        )}

        {pinned.data && pinned.data.length > 0 && !filtering && (
          <section aria-labelledby="pinned" className="space-y-2">
            <h2 id="pinned" className="flex items-center gap-2 text-base">
              <Pin className="h-4 w-4 text-clay-ink" aria-hidden />
              Pinned
            </h2>
            {pinned.data.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </section>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              aria-label="Search entries"
              placeholder="Search your journal"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <Button variant="secondary" onClick={() => setFiltersOpen(true)} aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {activeFilters.length > 0 && <span className="tabular-nums">{activeFilters.length}</span>}
          </Button>
        </div>
        <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} onApply={setFilters} />
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, [k]: undefined }))}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-ink"
              >
                {k === 'type' ? entryTypeLabel(v as EntryType) : k === 'from' || k === 'to' ? `${k} ${formatISODate(String(v), profile.date_format)}` : k.startsWith('mood') ? `${k === 'moodMin' ? 'mood ≥' : 'mood ≤'} ${v}` : String(v)}
                <X className="h-3.5 w-3.5" aria-label="Remove filter" />
              </button>
            ))}
          </div>
        )}

        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'timeline', label: 'Timeline' },
            {
              value: 'calendar',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden /> Calendar
                </span>
              ),
            },
          ]}
        />

        {view === 'calendar' ? (
          <CalendarView
            onPickDay={(d) => {
              setFilters((f) => ({ ...f, from: d, to: d }));
              setView('timeline');
            }}
          />
        ) : timeline.isPending ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : timeline.isError ? (
          <ErrorState error={timeline.error} onRetry={() => void timeline.refetch()} />
        ) : rows.length === 0 ? (
          filtering ? (
            <EmptyState icon={Search} title="No entries match">
              Try a different word or clear the filters.
            </EmptyState>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Your journal is empty"
              action={
                <Link to="/journal/write" className={buttonClasses('primary')}>
                  Write your first entry
                </Link>
              }
            >
              A few lines is plenty. Nobody else can read this.
            </EmptyState>
          )
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.month} aria-labelledby={`m-${g.month}`} className="space-y-2">
                <h2 id={`m-${g.month}`} className="text-sm font-semibold text-muted">
                  {g.label}
                </h2>
                {g.items.map((e) => (
                  <EntryCard key={e.id} entry={e} />
                ))}
              </section>
            ))}
            {timeline.hasNextPage && (
              <Button variant="secondary" block loading={timeline.isFetchingNextPage} onClick={() => void timeline.fetchNextPage()}>
                Load older entries
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export function JournalPage() {
  return (
    <>
      <JournalHome />
    </>
  );
}
