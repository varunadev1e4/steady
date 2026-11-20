import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addMonths, endOfMonth, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { usePeriodSummary } from '@/features/review/queries';
import { Metric } from '@/features/review/Metric';
import { useCheckInRange } from '@/features/checkin/queries';
import { useCardio, useWorkoutsInRange } from '@/features/workouts/queries';
import { usePeople } from '@/features/people/queries';
import { ENTRY_COLUMNS } from '@/features/journal/queries';
import { entryTypeLabel, preview } from '@/features/journal/logic';
import { activeMinutesByDay } from '@/features/goals/logic';
import { proteinSummary } from '@/features/food/logic';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { JournalEntryRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconButton } from '@/components/ui/Layout';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import { BarSeries, ChartCard, LineSeries } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate, toISODate, type ISODate } from '@/utils/dates';
import { ReviewTabs } from './ReviewPage';

type Mode = 'month' | 'year';

function periodBounds(mode: Mode, key: string): { start: ISODate; end: ISODate; label: string; prevKey: string; nextKey: string } {
  if (mode === 'month') {
    const first = parseISODate(`${key}-01`);
    return {
      start: toISODate(first),
      end: toISODate(endOfMonth(first)),
      label: format(first, 'MMMM yyyy'),
      prevKey: format(addMonths(first, -1), 'yyyy-MM'),
      nextKey: format(addMonths(first, 1), 'yyyy-MM'),
    };
  }
  const y = Number(key);
  return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y), prevKey: String(y - 1), nextKey: String(y + 1) };
}

function useHighlights(start: ISODate, end: ISODate) {
  return useQuery({
    queryKey: ['journal', 'highlights', start, end],
    queryFn: async () => {
      const pinned = unwrap(await supabase.from('journal_entries').select(ENTRY_COLUMNS).gte('day', start).lte('day', end).eq('pinned', true).order('day').limit(3)) as JournalEntryRow[];
      const longest = unwrap(await supabase.from('journal_entries').select(ENTRY_COLUMNS).gte('day', start).lte('day', end).order('word_count', { ascending: false }).limit(3)) as JournalEntryRow[];
      const seen = new Set<string>();
      return [...pinned, ...longest].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).slice(0, 3);
    },
  });
}

function useInteractionCounts(start: ISODate, end: ISODate) {
  return useQuery({
    queryKey: ['interactions', 'period', start, end],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('interactions').select('person_id').gte('day', start).lte('day', end));
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.person_id, (counts.get(r.person_id) ?? 0) + 1);
      return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);
    },
  });
}

function PeriodReview({ mode }: { mode: Mode }) {
  const { today, tz, weekStart } = useToday();
  const profile = useLoadedProfile();
  const [params, setParams] = useSearchParams();
  const currentKey = mode === 'month' ? today.slice(0, 7) : today.slice(0, 4);
  const raw = params.get(mode === 'month' ? 'm' : 'y');
  const key = raw && (mode === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}$/).test(raw) && raw <= currentKey ? raw : currentKey;
  const b = periodBounds(mode, key);
  const prev = periodBounds(mode, b.prevKey);
  const periodName = mode === 'month' ? 'last month' : 'last year';

  const summary = usePeriodSummary(b.start, b.end, tz, today);
  const previous = usePeriodSummary(prev.start, prev.end, tz, today);
  const checkIns = useCheckInRange(b.start, b.end);
  const workouts = useWorkoutsInRange(b.start, b.end);
  const cardio = useCardio(b.start, b.end);
  const highlights = useHighlights(b.start, b.end);
  const contacts = useInteractionCounts(b.start, b.end);
  const people = usePeople();

  const charts = useMemo(() => {
    const ci = checkIns.data ?? [];
    const active = activeMinutesByDay({ cardio: cardio.data ?? [], workouts: workouts.data ?? [] });
    if (mode === 'month') {
      const mood: Array<{ x: string; y: number | null }> = [];
      const weeks = new Map<ISODate, number>();
      for (let d = b.start; d <= b.end && d <= today; d = addDaysISO(d, 1)) {
        mood.push({ x: format(parseISODate(d), 'd'), y: ci.find((c) => c.day === d)?.mood ?? null });
      }
      for (const [d, m] of active) {
        let ws = d;
        while (parseISODate(ws).getDay() !== weekStart) ws = addDaysISO(ws, -1);
        weeks.set(ws, (weeks.get(ws) ?? 0) + m);
      }
      const act = [...weeks].sort(([a], [c]) => a.localeCompare(c)).map(([w, m]) => ({ x: `w/c ${format(parseISODate(w), 'd MMM')}`, y: m }));
      return { mood, moodLabel: 'Mood by day', act, actLabel: 'Active minutes by week', moodCount: mood.filter((m) => m.y != null).length };
    }
    const mood: Array<{ x: string; y: number | null }> = [];
    const act: Array<{ x: string; y: number | null }> = [];
    for (let m = 1; m <= 12; m++) {
      const prefix = `${key}-${String(m).padStart(2, '0')}`;
      const moods = ci.filter((c) => c.day.startsWith(prefix) && c.mood != null).map((c) => c.mood!);
      const label = format(parseISODate(`${prefix}-01`), 'MMM');
      mood.push({ x: label, y: moods.length ? Math.round((moods.reduce((a, c) => a + c, 0) / moods.length) * 10) / 10 : null });
      let mins = 0;
      for (const [d, v] of active) if (d.startsWith(prefix)) mins += v;
      act.push({ x: label, y: mins || null });
    }
    return { mood, moodLabel: 'Average mood by month', act, actLabel: 'Active minutes by month', moodCount: mood.filter((m) => m.y != null).length };
  }, [checkIns.data, cardio.data, workouts.data, mode, b.start, b.end, key, today, weekStart]);

  const s = summary.data;
  const p = previous.data;
  const protein = (x?: typeof s) => (x ? proteinSummary(x.protein_by_day, profile.protein_target_g) : null);
  const personName = (id: string) => people.data?.find((x) => x.id === id)?.name ?? 'Someone';

  return (
    <>
      <PageHeader title={mode === 'month' ? 'Monthly review' : 'Yearly review'} description="A look back at your own records." />
      <ReviewTabs />
      <div className="mb-4 flex items-center justify-between">
        <IconButton label={`Previous ${mode}`} onClick={() => setParams({ [mode === 'month' ? 'm' : 'y']: b.prevKey })}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <p className="font-medium">{b.label}</p>
        <IconButton label={`Next ${mode}`} disabled={key >= currentKey} onClick={() => setParams(b.nextKey >= currentKey ? {} : { [mode === 'month' ? 'm' : 'y']: b.nextKey })}>
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>

      {summary.isPending ? (
        <CardSkeleton lines={6} />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : s ? (
        <div className="space-y-4">
          <section className="card" aria-label="Summary">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Average mood" value={s.mood_avg} previous={p?.mood_avg ?? null} periodName={periodName} />
              <Metric label="Average sleep" value={s.sleep_avg} previous={p?.sleep_avg ?? null} unit="h" periodName={periodName} />
              <Metric label="Check-in days" value={s.check_in_days} previous={p?.check_in_days ?? null} periodName={periodName} />
              <Metric label="Active minutes" value={(s.workout_minutes ?? 0) + (s.cardio_minutes ?? 0)} previous={p ? (p.workout_minutes ?? 0) + (p.cardio_minutes ?? 0) : null} periodName={periodName} />
              <Metric label="Workouts" value={s.workouts} previous={p?.workouts ?? null} periodName={periodName} />
              <Metric label="Average steps" value={s.steps_avg} previous={p?.steps_avg ?? null} periodName={periodName} />
              <Metric label="Habit ticks" value={s.habit_completions} previous={p?.habit_completions ?? null} periodName={periodName} />
              <Metric label="Average protein" value={protein(s)?.avg ?? null} previous={protein(p)?.avg ?? null} unit=" g" periodName={periodName} />
              <Metric label="Journal days" value={s.journal_days} previous={p?.journal_days ?? null} periodName={periodName} />
              <Metric label="People contacted" value={s.people_contacted} previous={p?.people_contacted ?? null} periodName={periodName} />
              <Metric label="Met in person" value={s.in_person} previous={p?.in_person ?? null} periodName={periodName} />
              <Metric label="Tasks done" value={s.tasks_completed} previous={p?.tasks_completed ?? null} periodName={periodName} />
            </div>
          </section>

          <ChartCard title={charts.moodLabel} caption="1 rough · 5 great" empty={charts.moodCount < 2}>
            {mode === 'month' ? (
              <LineSeries data={charts.mood} label={charts.moodLabel} domain={[1, 5]} />
            ) : (
              <BarSeries data={charts.mood} label={charts.moodLabel} format={(v) => `${v} / 5`} />
            )}
          </ChartCard>
          <ChartCard title={charts.actLabel} caption="Walks, cardio and logged workouts" empty={charts.act.filter((a) => a.y).length === 0} emptyText="No activity logged in this period.">
            <BarSeries data={charts.act} label={charts.actLabel} format={(v) => `${v} min`} tone="second" />
          </ChartCard>

          {contacts.data && contacts.data.length > 0 && (
            <section className="card">
              <h2 className="text-base">Most in touch with</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {contacts.data.map(([id, n]) => (
                  <li key={id} className="flex justify-between">
                    <Link to={`/people/${id}`} className="hover:text-accent-ink">
                      {personName(id)}
                    </Link>
                    <span className="text-muted">{n} {n === 1 ? 'time' : 'times'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2 className="text-base">From your journal</h2>
            <>
              {highlights.data && highlights.data.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {highlights.data.map((e) => (
                    <li key={e.id}>
                      <Link to={`/journal/write/${e.id}`} className="block rounded-input bg-surface px-3 py-2 hover:bg-bg">
                        <span className="text-xs text-muted">
                          {formatISODate(e.day, profile.date_format)} · {entryTypeLabel(e.entry_type)}
                          {e.pinned && ' · pinned'}
                        </span>
                        <span className="block font-medium">{e.title || preview(e.body, 60)}</span>
                        {e.title && <span className="line-clamp-2 block font-serif text-sm text-muted">{preview(e.body, 160)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">No entries in this period.</p>
              )}
            </>
          </section>
          <p className="text-center text-xs text-muted">
            {s.journal_entries} journal {s.journal_entries === 1 ? 'entry' : 'entries'} · {s.journal_words.toLocaleString()} words · {s.meals} meals logged
          </p>
        </div>
      ) : null}
    </>
  );
}

export function MonthReviewPage() {
  return <PeriodReview key="month" mode="month" />;
}

export function YearReviewPage() {
  return <PeriodReview key="year" mode="year" />;
}
