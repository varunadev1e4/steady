import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Moon } from 'lucide-react';
import { useCheckInRange, useSaveCheckIn } from '@/features/checkin/queries';
import { bedMinutes, hoursBetween, regularity, SLEEP_TIPS, toMinutes } from '@/features/sleep/logic';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { CheckInRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/Layout';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { ChartCard, LineSeries } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';

const clock = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function SleepPage() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const range = useCheckInRange(addDaysISO(today, -29), today);
  const save = useSaveCheckIn();
  const toast = useToast();
  const [day, setDay] = useState(today);
  const [bed, setBed] = useState('');
  const [wake, setWake] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const byDay = useMemo(() => new Map((range.data ?? []).map((c) => [c.day, c])), [range.data]);
  useEffect(() => {
    const c = byDay.get(day);
    setBed(c?.bedtime?.slice(0, 5) ?? '');
    setWake(c?.wake_time?.slice(0, 5) ?? '');
  }, [day, byDay]);

  const last14 = (range.data ?? []).filter((c) => c.day >= addDaysISO(today, -13));
  const reg = regularity(last14.map((c) => ({ bedtime: c.bedtime?.slice(0, 5) ?? null, wake_time: c.wake_time?.slice(0, 5) ?? null })));
  const hours = last14.filter((c) => c.sleep_hours != null).map((c) => Number(c.sleep_hours));
  const avgHours = hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null;

  const series = (pick: (c: CheckInRow) => number | null) => {
    const out: Array<{ x: string; y: number | null }> = [];
    for (let d = addDaysISO(today, -29); d <= today; d = addDaysISO(d, 1)) {
      const c = byDay.get(d);
      out.push({ x: format(parseISODate(d), 'd MMM'), y: c ? pick(c) : null });
    }
    return out;
  };
  const hoursSeries = series((c) => (c.sleep_hours == null ? null : Number(c.sleep_hours)));
  const bedSeries = series((c) => (c.bedtime ? bedMinutes(c.bedtime.slice(0, 5)) : null));
  const wakeSeries = series((c) => (c.wake_time ? toMinutes(c.wake_time.slice(0, 5)) : null));
  const count = (s: Array<{ y: number | null }>) => s.filter((p) => p.y != null).length;

  return (
    <>
      <PageHeader title="Sleep" description="When you sleep matters as well as how long. A regular rhythm helps mood, energy and appetite." />
      <div className="space-y-4">
        <form
          className="card space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!bed || !wake) return setErr('Enter both times.');
            setErr(null);
            const c = byDay.get(day);
            save.mutate(
              {
                day,
                values: {
                  mood: c?.mood ?? null,
                  energy: c?.energy ?? null,
                  stress: c?.stress ?? null,
                  sleep_quality: c?.sleep_quality ?? null,
                  water_glasses: c?.water_glasses ?? 0,
                  note: c?.note ?? null,
                  bedtime: bed,
                  wake_time: wake,
                  sleep_hours: hoursBetween(bed, wake),
                },
              },
              { onSuccess: () => toast(`Saved: ${hoursBetween(bed, wake)} hours`) },
            );
          }}
        >
          <h2 className="flex items-center gap-2 text-base">
            <Moon className="h-5 w-5 text-accent-ink" aria-hidden />
            Log a night
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Woke up on" type="date" max={today} value={day} wrapperClassName="col-span-2" onChange={(e) => e.target.value && setDay(e.target.value)} />
            <TextField label="Went to bed" type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
            <TextField label="Woke up" type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
          </div>
          {bed && wake && <p className="text-sm text-muted">That's about {hoursBetween(bed, wake)} hours in bed.</p>}
          {(err || save.isError) && <FormMessage tone="error">{err ?? errorMessage(save.error)}</FormMessage>}
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
          <p className="text-xs text-muted">You can also add these times on the daily check-in.</p>
        </form>

        {range.isPending ? (
          <CardSkeleton />
        ) : range.isError ? (
          <ErrorState error={range.error} onRetry={() => void range.refetch()} />
        ) : (
          <>
            <section className="card space-y-2" aria-labelledby="reg">
              <h2 id="reg" className="text-base">
                Last 14 days
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Average sleep" value={avgHours == null ? '–' : `${avgHours} h`} />
                <StatTile label="Usual bedtime" value={reg.avgBedtime ?? '–'} hint={reg.bedtimeSpread != null ? `± ${reg.bedtimeSpread} min` : undefined} />
                <StatTile label="Usual wake time" value={reg.avgWake ?? '–'} hint={reg.wakeSpread != null ? `± ${reg.wakeSpread} min` : undefined} />
              </div>
              <p className="text-sm">
                {reg.label == null
                  ? 'Log bedtime and wake time for 3 or more nights to see how regular your sleep is.'
                  : reg.label === 'very regular'
                    ? 'Your sleep times are very regular. That’s great for energy and mood.'
                    : reg.label === 'fairly regular'
                      ? 'Fairly regular. Keeping your wake-up time within about 30 minutes, even at weekends, is the easiest win.'
                      : 'Your sleep times vary quite a bit. Start with a fixed wake-up time; bedtime tends to follow.'}
              </p>
            </section>
            <ChartCard title="Hours of sleep" caption="Most adults need 7–9 hours" empty={count(hoursSeries) < 2}>
              <LineSeries data={hoursSeries} label="Hours of sleep, last 30 days" domain={[0, 'auto']} format={(v) => `${v} h`} target={7} />
            </ChartCard>
            <ChartCard title="Bedtime" caption="Last 30 days" empty={count(bedSeries) < 2} emptyText="Log bedtimes on two or more nights to see a chart.">
              <LineSeries data={bedSeries} label="Bedtime, last 30 days" format={(v) => clock(v + 720)} yFormat={(v) => clock(v + 720)} />
            </ChartCard>
            <ChartCard title="Wake-up time" caption="Last 30 days" empty={count(wakeSeries) < 2} emptyText="Log wake-up times on two or more days to see a chart.">
              <LineSeries data={wakeSeries} label="Wake-up time, last 30 days" format={clock} yFormat={clock} />
            </ChartCard>
            {(range.data ?? []).some((c) => c.bedtime) && (
              <details className="card">
                <summary className="cursor-pointer font-medium">Nights logged</summary>
                <ul className="mt-2 divide-y divide-border text-sm">
                  {(range.data ?? [])
                    .filter((c) => c.bedtime && c.wake_time)
                    .slice()
                    .reverse()
                    .map((c) => (
                      <li key={c.day} className="flex justify-between py-1.5">
                        <span>{formatISODate(c.day, profile.date_format)}</span>
                        <span className="tabular-nums text-muted">
                          {c.bedtime!.slice(0, 5)} → {c.wake_time!.slice(0, 5)} · {Number(c.sleep_hours)} h
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </>
        )}

        <section className="rounded-card bg-panel px-4 py-3 text-sm text-muted">
          <p className="font-medium text-ink">Sleep tips that have good evidence</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {SLEEP_TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
