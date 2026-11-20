import { useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useCheckInRange } from '@/features/checkin/queries';
import { useCardio, useWorkoutsInRange } from '@/features/workouts/queries';
import { useJournalStats } from '@/features/journal/queries';
import { buildDayRecords, compareGroups, moodBySleep, MIN_DAYS, type GroupStat } from '@/features/insights/logic';
import { useToday } from '@/features/profile/useToday';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Controls';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import { addDaysISO } from '@/utils/dates';

const CAUTION = 'A pattern in your data, not proof of cause.';

/** Horizontal bars on a fixed 1–5 scale, labelled with the value and day count. */
function Bars({ groups, label }: { groups: GroupStat[]; label: string }) {
  return (
    <ul className="space-y-3" aria-label={label}>
      {groups.map((g) => (
        <li key={g.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{g.label}</span>
            <span className="text-muted">
              {g.mean == null ? (
                <>Not enough data yet ({g.n} of {MIN_DAYS} days)</>
              ) : (
                <>
                  <span className="font-semibold tabular-nums text-ink">{g.mean.toFixed(1)}</span> · {g.n} days
                </>
              )}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-border/60">
            {g.mean != null && <div className="h-full rounded-full bg-accent" style={{ width: `${((g.mean - 1) / 4) * 100}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function InsightCard({ title, groups, enough, summary }: { title: string; groups: GroupStat[]; enough: boolean; summary?: string }) {
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-base">{title}</h2>
        <p className="text-xs text-muted">{CAUTION}</p>
      </div>
      <Bars groups={groups} label={title} />
      {enough && summary && <p className="text-sm">{summary}</p>}
      {!enough && <p className="text-sm text-muted">Not enough data yet. Each group needs at least {MIN_DAYS} days with a check-in.</p>}
    </section>
  );
}

const diffText = (d: number | null, what: string, a: string, b: string) => {
  if (d == null) return undefined;
  if (Math.abs(d) < 0.1) return `Your average ${what} was about the same on ${a} and ${b}.`;
  return `Your average ${what} was ${Math.abs(d).toFixed(1)} points ${d > 0 ? 'higher' : 'lower'} on ${a} than on ${b}.`;
};

export function InsightsPage() {
  const { today } = useToday();
  const [days, setDays] = useState<'90' | '180' | '365'>('90');
  const from = addDaysISO(today, -(Number(days) - 1));
  const checkIns = useCheckInRange(from, today);
  const workouts = useWorkoutsInRange(from, today);
  const cardio = useCardio(from, today);
  const journal = useJournalStats();

  const records = useMemo(() => {
    if (!checkIns.data || !workouts.data || !cardio.data || !journal.data) return null;
    const moved = [...workouts.data.map((w) => w.day), ...cardio.data.map((c) => c.day)];
    return buildDayRecords(checkIns.data.filter((c) => c.mood != null || c.energy != null), moved, journal.data.days);
  }, [checkIns.data, workouts.data, cardio.data, journal.data]);

  const error = checkIns.error ?? workouts.error ?? cardio.error ?? journal.error;

  return (
    <>
      <PageHeader title="Insights" description="Simple averages from your own check-ins. Nothing here is a diagnosis." />
      <Segmented
        label="Period"
        value={days}
        onChange={setDays}
        options={[
          { value: '90', label: '90 days' },
          { value: '180', label: '6 months' },
          { value: '365', label: '1 year' },
        ]}
        className="mb-4"
      />
      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void checkIns.refetch();
            void workouts.refetch();
            void cardio.refetch();
            void journal.refetch();
          }}
        />
      ) : !records ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-card bg-panel px-4 py-3 text-sm text-muted">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-clay-ink" aria-hidden />
            Based on {records.length} check-in {records.length === 1 ? 'day' : 'days'}. Scores are on a 1–5 scale. Many things
            affect how you feel, so treat these as prompts for curiosity rather than conclusions.
          </p>
          {(() => {
            const c = compareGroups(records, 'mood', (d) => d.worked_out, ['Days you moved', 'Other days']);
            return <InsightCard title="Mood and exercise" groups={c.groups} enough={c.enough} summary={diffText(c.difference, 'mood', 'days you exercised', 'other days')} />;
          })()}
          {(() => {
            const c = compareGroups(records, 'energy', (d) => d.worked_out, ['Days you moved', 'Other days']);
            return <InsightCard title="Energy and exercise" groups={c.groups} enough={c.enough} summary={diffText(c.difference, 'energy', 'days you exercised', 'other days')} />;
          })()}
          {(() => {
            const buckets = moodBySleep(records);
            const shown = buckets.filter((b) => b.mean != null);
            return (
              <InsightCard
                title="Mood by sleep"
                groups={buckets}
                enough={shown.length >= 2}
                summary={
                  shown.length >= 2
                    ? `Your highest average mood was after ${[...shown].sort((a, b) => b.mean! - a.mean!)[0].label.toLowerCase()} of sleep.`
                    : undefined
                }
              />
            );
          })()}
          {(() => {
            const c = compareGroups(records, 'mood', (d) => d.journaled, ['Days you journaled', 'Other days']);
            return <InsightCard title="Mood and journaling" groups={c.groups} enough={c.enough} summary={diffText(c.difference, 'mood', 'days you journaled', 'other days')} />;
          })()}
        </div>
      )}
    </>
  );
}
