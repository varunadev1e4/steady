import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useReview, useReviews, useSaveReview, useWeekSummary } from '@/features/review/queries';
import { Metric } from '@/features/review/Metric';
import { LinkTabs } from '@/components/ui/Layout';
import { useCompletionMap, useCompletions, useHabits } from '@/features/habits/queries';
import { consistency, weekStartOf } from '@/features/habits/streaks';
import { proteinSummary } from '@/features/food/logic';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { WeekSummary } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconButton } from '@/components/ui/Layout';
import { TextAreaField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { addDaysISO, formatISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';

const fmt = (n: number | null | undefined, digits = 1) => (n == null ? '–' : String(Math.round(Number(n) * 10 ** digits) / 10 ** digits));

export function ReviewPage() {
  const { today, tz, weekStart } = useToday();
  const profile = useLoadedProfile();
  const [params, setParams] = useSearchParams();
  const current = weekStartOf(today, weekStart);
  const requested = params.get('week');
  const week = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? weekStartOf(requested, weekStart) : current;
  const prevWeek = addDaysISO(week, -7);
  const weekEnd = addDaysISO(week, 6);

  const summary = useWeekSummary(week, tz, today);
  const previous = useWeekSummary(prevWeek, tz, today);
  const review = useReview(week);
  const reviews = useReviews();
  const habits = useHabits();
  const completions = useCompletions();
  const byHabit = useCompletionMap(completions.data);
  const save = useSaveReview();
  const toast = useToast();

  const [form, setForm] = useState({ went_well: '', didnt_go_well: '', learned: '', next_focus: '' });
  useEffect(() => {
    if (review.data !== undefined) {
      setForm({
        went_well: review.data?.went_well ?? '',
        didnt_go_well: review.data?.didnt_go_well ?? '',
        learned: review.data?.learned ?? '',
        next_focus: review.data?.next_focus ?? '',
      });
    }
  }, [review.data]);

  const habitStats = (start: string) => {
    let done = 0;
    let due = 0;
    for (const h of habits.data ?? []) {
      if (h.archived_at) continue;
      const c = consistency(h, byHabit.get(h.id) ?? [], start, addDaysISO(start, 6), today, weekStart);
      done += c.done;
      due += c.due;
    }
    return { done, due, pct: due ? Math.round((done / due) * 100) : null };
  };
  const hThis = useMemo(() => habitStats(week), [habits.data, byHabit, week, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const hPrev = useMemo(() => habitStats(prevWeek), [habits.data, byHabit, prevWeek, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = summary.data;
  const p = previous.data;
  const protein = (x?: WeekSummary) => (x ? proteinSummary(x.protein_by_day, profile.protein_target_g) : null);

  return (
    <>
      <PageHeader title="Weekly review" description="A calm look back, then one focus for the week ahead." />
      <ReviewTabs />
      <div className="mb-4 flex items-center justify-between">
        <IconButton label="Previous week" onClick={() => setParams({ week: prevWeek })}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <p className="font-medium">
          {week === current ? 'This week' : 'Week of'} · {formatISODate(week, 'd MMM')} – {formatISODate(weekEnd, 'd MMM yyyy')}
        </p>
        <IconButton label="Next week" disabled={week >= current} onClick={() => setParams(addDaysISO(week, 7) >= current ? {} : { week: addDaysISO(week, 7) })}>
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="space-y-4">
        {summary.isPending ? (
          <CardSkeleton lines={6} />
        ) : summary.isError ? (
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        ) : s ? (
          <section className="card space-y-3" aria-label="Summary">
            <h2 className="text-base">How the week went</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Average mood" value={s.mood_avg} previous={p?.mood_avg ?? null} />
              <Metric label="Average energy" value={s.energy_avg} previous={p?.energy_avg ?? null} />
              <Metric label="Average sleep" value={s.sleep_avg} previous={p?.sleep_avg ?? null} unit="h" />
              <Metric label="Check-in days" value={s.check_in_days} previous={p?.check_in_days ?? null} />
              <Metric label="Habits done" value={hThis.done} previous={hPrev.done} />
              <Metric label="Workouts" value={s.workouts + s.cardio_sessions} previous={p ? p.workouts + p.cardio_sessions : null} />
              <Metric label="Active minutes" value={(s.workout_minutes ?? 0) + (s.cardio_minutes ?? 0)} previous={p ? (p.workout_minutes ?? 0) + (p.cardio_minutes ?? 0) : null} />
              <Metric label="Average steps" value={s.steps_avg} previous={p?.steps_avg ?? null} />
              <Metric label="Average protein" value={protein(s)?.avg ?? null} previous={protein(p)?.avg ?? null} unit=" g" />
              <Metric label="Journal days" value={s.journal_days} previous={p?.journal_days ?? null} />
              <Metric label="People contacted" value={s.people_contacted} previous={p?.people_contacted ?? null} />
              <Metric label="Tasks completed" value={s.tasks_completed} previous={p?.tasks_completed ?? null} />
            </div>
            <ul className="space-y-0.5 text-sm text-muted">
              {hThis.due > 0 && <li>Habits: {hThis.done} of {hThis.due} due ({hThis.pct}%).</li>}
              {s.workouts + s.cardio_sessions > 0 && (
                <li>
                  {s.workouts} strength {s.workouts === 1 ? 'workout' : 'workouts'} and {s.cardio_sessions} cardio
                  {profile.weekly_workout_target ? ` (your target is ${profile.weekly_workout_target})` : ''}.
                </li>
              )}
              {protein(s)?.daysMet != null && <li>Protein target met on {protein(s)!.daysMet} of {protein(s)!.daysLogged} logged days.</li>}
              {s.journal_entries > 0 && <li>{s.journal_entries} journal {s.journal_entries === 1 ? 'entry' : 'entries'}, {s.journal_words.toLocaleString()} words.</li>}
              {s.in_person > 0 && <li>{s.in_person} in-person {s.in_person === 1 ? 'meetup' : 'meetups'}.</li>}
              {s.water_avg != null && <li>Water: {fmt(s.water_avg)} glasses a day on days you logged it.</li>}
              {s.tasks_overdue > 0 && <li>{s.tasks_overdue} {s.tasks_overdue === 1 ? 'task is' : 'tasks are'} waiting from before.</li>}
            </ul>
          </section>
        ) : null}

        <form
          className="card space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ week_start: week, ...form }, { onSuccess: () => toast('Review saved') });
          }}
        >
          <h2 className="text-base">Reflect</h2>
          {review.isError && <ErrorState error={review.error} onRetry={() => void review.refetch()} />}
          <TextAreaField label="What went well?" rows={3} maxLength={5000} value={form.went_well} onChange={(e) => setForm({ ...form, went_well: e.target.value })} className="font-serif" />
          <TextAreaField label="What didn't go so well?" rows={3} maxLength={5000} value={form.didnt_go_well} onChange={(e) => setForm({ ...form, didnt_go_well: e.target.value })} className="font-serif" />
          <TextAreaField label="What did I learn?" rows={3} maxLength={5000} value={form.learned} onChange={(e) => setForm({ ...form, learned: e.target.value })} className="font-serif" />
          <TextAreaField label="One focus for next week" rows={2} maxLength={1000} value={form.next_focus} onChange={(e) => setForm({ ...form, next_focus: e.target.value })} className="font-serif" />
          {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
          <Button type="submit" loading={save.isPending}>
            Save review
          </Button>
        </form>

        {reviews.data && reviews.data.length > 0 && (
          <section aria-labelledby="past">
            <h2 id="past" className="mb-2 text-base">
              Past reviews
            </h2>
            <ul className="card divide-y divide-border py-1">
              {reviews.data.map((r) => (
                <li key={r.id}>
                  <Link to={`/review?week=${r.week_start}`} className="block py-2 hover:text-accent-ink">
                    <span className="font-medium">Week of {formatISODate(r.week_start, profile.date_format)}</span>
                    {r.next_focus && <span className="block truncate text-sm text-muted">Focus: {r.next_focus}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

export function ReviewTabs() {
  return (
    <LinkTabs
      label="Review period"
      items={[
        { to: '/review', label: 'Week', end: true },
        { to: '/review/month', label: 'Month' },
        { to: '/review/year', label: 'Year' },
        { to: '/report', label: 'Report' },
      ]}
    />
  );
}
