import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useCheckInRange, useSetSteps } from '@/features/checkin/queries';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconButton, StatTile } from '@/components/ui/Layout';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { BarSeries, ChartCard } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';

export function StepsPage() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const range = useCheckInRange(addDaysISO(today, -29), today);
  const setSteps = useSetSteps();
  const toast = useToast();
  const [day, setDay] = useState(today);
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const byDay = useMemo(() => new Map((range.data ?? []).filter((c) => c.steps != null).map((c) => [c.day, Number(c.steps)])), [range.data]);
  useEffect(() => {
    const existing = byDay.get(day);
    setValue(existing != null ? String(existing) : '');
  }, [day, byDay]);

  const series = useMemo(() => {
    const out: Array<{ x: string; y: number | null }> = [];
    for (let d = addDaysISO(today, -29); d <= today; d = addDaysISO(d, 1)) out.push({ x: format(parseISODate(d), 'd MMM'), y: byDay.get(d) ?? null });
    return out;
  }, [byDay, today]);

  const avg = (from: string) => {
    const v = [...byDay].filter(([d, s]) => d >= from && s > 0).map(([, s]) => s);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const avg7 = avg(addDaysISO(today, -6));
  const avg30 = avg(addDaysISO(today, -29));
  const target = profile.steps_target;
  const logged = [...byDay].sort(([a], [b]) => b.localeCompare(a));

  return (
    <>
      <PageHeader title="Steps" description="Type in the step count from your phone or watch once a day." />
      <div className="space-y-4">
        <form
          className="card space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(value.replace(/[^\d]/g, ''));
            if (!value.trim() || !Number.isInteger(n) || n < 0 || n > 200000) return setErr('Enter a number of steps between 0 and 200,000.');
            setErr(null);
            setSteps.mutate({ day, steps: n }, { onSuccess: () => toast(`${n.toLocaleString()} steps saved`) });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Steps" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))} placeholder="e.g. 6500" />
            <TextField label="Date" type="date" max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </div>
          <p className="text-xs text-muted">Tip: log yesterday's full count in the morning (change the date), since today's isn't finished yet.</p>
          {(err || setSteps.isError) && <FormMessage tone="error">{err ?? errorMessage(setSteps.error)}</FormMessage>}
          <Button type="submit" loading={setSteps.isPending}>
            Save steps
          </Button>
        </form>

        {range.isPending ? (
          <CardSkeleton />
        ) : range.isError ? (
          <ErrorState error={range.error} onRetry={() => void range.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="7-day average" value={avg7 == null ? '–' : avg7.toLocaleString()} />
              <StatTile label="30-day average" value={avg30 == null ? '–' : avg30.toLocaleString()} />
              <StatTile label="Daily target" value={target ? target.toLocaleString() : '–'} hint={target ? undefined : 'Set in Settings'} />
            </div>
            <ChartCard title="Steps per day" caption="Last 30 days" empty={byDay.size < 2} emptyText="Log two or more days to see a chart.">
              <BarSeries data={series} label="Steps per day, last 30 days" format={(v) => `${v.toLocaleString()} steps`} target={target} interval="preserveStartEnd" />
            </ChartCard>
            <p className="text-xs text-muted">
              Building up gradually matters more than a magic number. Adding about 1,000 steps a day to your current average every week or two is
              a comfortable pace for most beginners.
            </p>
            {logged.length > 0 && (
              <ul className="card divide-y divide-border py-1">
                {logged.map(([d, s]) => (
                  <li key={d} className="flex min-h-12 items-center justify-between">
                    <span>{formatISODate(d, profile.date_format)}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {s.toLocaleString()}
                      <IconButton label={`Clear steps for ${formatISODate(d, 'd MMM')}`} onClick={() => setSteps.mutate({ day: d, steps: null })}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
