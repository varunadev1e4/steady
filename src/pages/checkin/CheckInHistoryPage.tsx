import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useCheckInRange } from '@/features/checkin/queries';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { weekStartOf } from '@/features/habits/streaks';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Controls';
import { moodLabel } from '@/components/ui/scales';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import { ChartCard, LineSeries } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { cn } from '@/utils/cn';

const MOOD_SHADE = ['', 'bg-accent/15', 'bg-accent/35', 'bg-accent/55', 'bg-accent/75', 'bg-accent'];

export function CheckInHistoryPage() {
  const { today, weekStart } = useToday();
  const profile = useLoadedProfile();
  const [range, setRange] = useState<'30' | '90'>('30');
  const days = Number(range);
  const from = addDaysISO(today, -(days - 1));
  const q = useCheckInRange(addDaysISO(today, -89), today);

  const byDay = useMemo(() => new Map((q.data ?? []).map((c) => [c.day, c])), [q.data]);
  const series = useMemo(() => {
    const out: Array<{ x: string; mood: number | null; energy: number | null; sleep: number | null; water: number | null }> = [];
    for (let d = from; d <= today; d = addDaysISO(d, 1)) {
      const c = byDay.get(d);
      out.push({
        x: d,
        mood: c?.mood ?? null,
        energy: c?.energy ?? null,
        sleep: c?.sleep_hours == null ? null : Number(c.sleep_hours),
        water: c && c.water_glasses > 0 ? c.water_glasses : null,
      });
    }
    return out;
  }, [byDay, from, today]);

  const tick = (x: string) => format(parseISODate(x), 'd MMM');
  const pick = (k: 'mood' | 'energy' | 'sleep' | 'water') => series.map((s) => ({ x: tick(s.x), y: s[k] }));
  const count = (k: 'mood' | 'energy' | 'sleep' | 'water') => series.filter((s) => s[k] != null).length;

  // Heat-map: 13 weeks, one column per week.
  const gridStart = weekStartOf(addDaysISO(today, -7 * 12), weekStart);
  const weeks: string[][] = [];
  for (let w = gridStart; w <= today; w = addDaysISO(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysISO(w, i)));
  }

  return (
    <>
      <PageHeader title="Check-in history" description="Tap a day to add or edit its check-in." />
      {q.isPending ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <div className="space-y-4">
          <section className="card">
            <h2 className="text-base">Mood calendar</h2>
            <p className="mt-0.5 text-sm text-muted">The last 13 weeks. Darker means a better mood.</p>
            <div className="mt-3">
              <div className="flex gap-[3px] sm:gap-1" role="grid" aria-label="Mood by day">
                {weeks.map((week) => (
                  <div key={week[0]} className="flex min-w-0 flex-1 flex-col gap-[3px] sm:gap-1" role="row">
                    {week.map((d) => {
                      const c = byDay.get(d);
                      const future = d > today;
                      const label = `${formatISODate(d, 'EEE d MMM')}: ${c?.mood ? `mood ${moodLabel(c.mood)}` : 'no check-in'}`;
                      return future ? (
                        <span key={d} className="aspect-square w-full" role="gridcell" aria-hidden />
                      ) : (
                        <Link
                          key={d}
                          to={`/checkin?day=${d}`}
                          role="gridcell"
                          aria-label={label}
                          title={label}
                          className={cn(
                            'aspect-square w-full rounded-[4px] border border-transparent hover:border-ink/40',
                            c?.mood ? MOOD_SHADE[c.mood] : 'bg-border/60',
                            d === today && 'ring-1 ring-ink/50',
                          )}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted" aria-hidden>
              Rough
              {MOOD_SHADE.slice(1).map((c) => (
                <span key={c} className={cn('h-3 w-3 rounded-[3px]', c)} />
              ))}
              Great
            </div>
          </section>

          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />

          <ChartCard title="Mood" caption="1 rough · 5 great" empty={count('mood') < 2}>
            <LineSeries data={pick('mood')} label="Mood over time" domain={[1, 5]} format={(v) => `${v} · ${moodLabel(v)}`} />
          </ChartCard>
          <ChartCard title="Energy" caption="1 drained · 5 full of energy" empty={count('energy') < 2}>
            <LineSeries data={pick('energy')} label="Energy over time" domain={[1, 5]} />
          </ChartCard>
          <ChartCard title="Sleep" caption="Hours slept" empty={count('sleep') < 2}>
            <LineSeries data={pick('sleep')} label="Hours slept over time" domain={[0, 'auto']} format={(v) => `${v} h`} />
          </ChartCard>
          <ChartCard
            title="Water"
            caption={profile.water_target_glasses ? `Glasses a day · your target is ${profile.water_target_glasses}` : 'Glasses a day'}
            empty={count('water') < 2}
          >
            <LineSeries data={pick('water')} label="Water over time" domain={[0, 'auto']} format={(v) => `${v} glasses`} />
          </ChartCard>
          <p className="text-center text-xs text-muted">For self-reflection only, not a medical or diagnostic tool.</p>
        </div>
      )}
    </>
  );
}
