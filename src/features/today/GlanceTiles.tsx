import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Droplet, Moon, Plus, Scale, Smile, type LucideIcon } from 'lucide-react';
import { useCheckInRange, useSetWater } from '@/features/checkin/queries';
import { useMeasurements } from '@/features/workouts/queries';
import { formatWeight } from '@/features/workouts/logic';
import { useLoadedProfile } from '@/features/profile/queries';
import { useModuleEnabled, useToday } from '@/features/profile/useToday';
import { moodLabel } from '@/components/ui/scales';
import { IconChip, type Tone } from '@/components/ui/Layout';
import { MiniBars, MiniLine, type MiniPoint } from '@/components/ui/MiniChart';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { addDaysISO, formatISODate, type ISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { haptic } from '@/utils/haptics';

function Tile({
  to,
  label,
  icon,
  tone,
  value,
  unit,
  sub,
  chart,
  action,
  className = '',
}: {
  className?: string;
  to: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  value: ReactNode;
  unit?: string;
  sub: ReactNode;
  chart: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`card card-link relative flex flex-col gap-3 p-4 ${className}`}>
      {/* The whole tile opens the page; the optional action button sits above the link. */}
      <Link to={to} className="absolute inset-0 rounded-card" aria-label={`${label}: open`} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-muted">
          <IconChip icon={icon} tone={tone} size="sm" />
          {label}
        </span>
        {action && <span className="relative z-10">{action}</span>}
      </div>
      <div>
        <p className="leading-none">
          {value === '–' ? (
            <span className="text-xl font-bold text-muted">Not yet</span>
          ) : (
            <span className="display-num text-[2rem]">{value}</span>
          )}
          {unit && <span className="ml-1 text-sm font-semibold text-muted">{unit}</span>}
        </p>
        <p className="mt-1.5 text-xs leading-snug text-muted">{sub}</p>
      </div>
      {/* Above the tile link so each bar and point shows its tooltip on hover. */}
      <div className="relative mt-auto">{chart}</div>
    </div>
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** A row of glanceable tiles: the last 7 days of mood, sleep, steps and water, and the weight trend. */
export function GlanceTiles() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const checkinOn = useModuleEnabled('checkin');
  const from = addDaysISO(today, -6);
  const range = useCheckInRange(from, today);
  const measurements = useMeasurements();
  const setWater = useSetWater();
  const toast = useToast();

  if (range.isPending || measurements.isPending) {
    return (
      <div className="grid grid-cols-2 gap-3" aria-label="Loading your week" role="status">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-card" />
        ))}
      </div>
    );
  }

  const days: ISODate[] = Array.from({ length: 7 }, (_, i) => addDaysISO(from, i));
  const byDay = new Map((range.data ?? []).map((r) => [r.day, r]));
  const label = (d: ISODate) => formatISODate(d, 'EEE d MMM');
  const series = (pick: (r: NonNullable<ReturnType<typeof byDay.get>>) => number | null): MiniPoint[] =>
    days.map((d) => {
      const r = byDay.get(d);
      return { label: label(d), value: r ? pick(r) : null };
    });

  const todayRow = byDay.get(today);
  const yesterday = addDaysISO(today, -1);

  const mood = series((r) => r.mood);
  const moods = mood.flatMap((p) => (p.value != null ? [p.value] : []));
  const sleep = series((r) => (r.sleep_hours == null ? null : Number(r.sleep_hours)));
  const sleeps = sleep.flatMap((p) => (p.value != null ? [p.value] : []));
  const steps = series((r) => r.steps);
  const water = series((r) => r.water_glasses || null);

  const lastNight = todayRow?.sleep_hours ?? byDay.get(yesterday)?.sleep_hours ?? null;
  const stepsShown = todayRow?.steps ?? byDay.get(yesterday)?.steps ?? null;
  const stepsWhen = todayRow?.steps != null ? 'today' : stepsShown != null ? 'yesterday' : null;
  const glasses = todayRow?.water_glasses ?? 0;
  const waterTarget = profile.water_target_glasses ?? 8;
  const stepsTarget = profile.steps_target;

  // Weight: the last 10 weigh-ins, oldest first.
  const weights = (measurements.data ?? []).filter((m) => m.weight_kg != null).slice(0, 10).reverse();
  const latest = weights[weights.length - 1];
  const fourWeeksAgo = addDaysISO(today, -28);
  const baseline = [...weights].reverse().find((w) => w.day <= fourWeeksAgo) ?? weights[0];
  const change = latest && baseline && baseline !== latest ? Number(latest.weight_kg) - Number(baseline.weight_kg) : null;
  const units = profile.units;

  const addGlass = () => {
    haptic();
    setWater.mutate({ day: today, glasses: glasses + 1 }, { onError: (e) => toast(errorMessage(e), 'error') });
  };

  return (
    <section aria-labelledby="glance-title">
      <h2 id="glance-title" className="sr-only">
        Your week at a glance
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {checkinOn && (
          <Tile
            to="/checkin/history"
            label="Mood"
            icon={Smile}
            tone="yellow"
            value={todayRow?.mood ? moodLabel(todayRow.mood) : '–'}
            sub={moods.length ? `Week avg ${moodLabel(Math.round(avg(moods)!))}` : 'Check in to see your week'}
            chart={<MiniBars points={mood} max={5} format={(v) => moodLabel(v)} summary={`Mood for the last 7 days: ${mood.map((p) => `${p.label} ${p.value ? moodLabel(p.value) : 'not logged'}`).join(', ')}.`} />}
          />
        )}
        {checkinOn && (
          <Tile
            to="/sleep"
            label="Sleep"
            icon={Moon}
            tone="violet"
            value={lastNight != null ? round1(Number(lastNight)) : '–'}
            unit={lastNight != null ? 'h' : undefined}
            sub={sleeps.length ? `Week avg ${round1(avg(sleeps)!)} h` : 'Log sleep on your check-in'}
            chart={<MiniBars points={sleep} format={(v) => `${round1(v)} h`} summary={`Sleep for the last 7 days: ${sleep.map((p) => `${p.label} ${p.value != null ? `${round1(p.value)} hours` : 'not logged'}`).join(', ')}.`} />}
          />
        )}
        <Tile
          to="/body/steps"
          label="Steps"
          icon={Activity}
          tone="green"
          value={stepsShown != null ? stepsShown.toLocaleString() : '–'}
          sub={stepsWhen ? `${stepsWhen === 'today' ? 'Today' : 'Yesterday'}${stepsTarget ? ` · goal ${stepsTarget.toLocaleString()}` : ''}` : 'Add today’s steps'}
          chart={<MiniBars points={steps} target={stepsTarget} format={(v) => `${v.toLocaleString()} steps`} summary={`Steps for the last 7 days${stepsTarget ? `, goal ${stepsTarget}` : ''}: ${steps.map((p) => `${p.label} ${p.value ?? 'not logged'}`).join(', ')}.`} />}
        />
        {checkinOn && (
          <Tile
            to="/checkin"
            label="Water"
            icon={Droplet}
            tone="blue"
            value={glasses}
            unit={`/ ${waterTarget}`}
            sub={glasses >= waterTarget ? 'Target reached today' : 'Glasses today'}
            action={
              <button
                type="button"
                onClick={addGlass}
                disabled={setWater.isPending}
                aria-label={`Add a glass of water (now ${glasses})`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-strong text-accent-fg shadow-soft transition-transform hover:bg-accent-hover active:scale-90 disabled:opacity-50"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
            }
            chart={<MiniBars points={water} target={waterTarget} format={(v) => `${v} glasses`} summary={`Water for the last 7 days, target ${waterTarget}: ${water.map((p) => `${p.label} ${p.value ?? 0}`).join(', ')}.`} />}
          />
        )}
        <Tile
          to="/body/measurements"
          label="Weight"
          className={checkinOn ? 'col-span-2' : ''}
          icon={Scale}
          tone="orange"
          value={latest ? formatWeight(Number(latest.weight_kg), units) : '–'}
          unit={latest ? units : undefined}
          sub={
            change != null
              ? `${change <= 0 ? '−' : '+'}${formatWeight(Math.abs(change), units)} ${units} since ${formatISODate(baseline!.day, 'd MMM')}`
              : latest
                ? `Weighed ${formatISODate(latest.day, 'd MMM')}`
                : 'Add a weigh-in'
          }
          chart={
            weights.length > 1 ? (
              <MiniLine
                points={weights.map((w) => ({ label: formatISODate(w.day, 'EEE d MMM'), value: Number(w.weight_kg) }))}
                format={(v) => `${formatWeight(v, units)} ${units}`}
                summary={`Last ${weights.length} weigh-ins: ${weights.map((w) => `${formatISODate(w.day, 'd MMM')} ${formatWeight(Number(w.weight_kg), units)} ${units}`).join(', ')}.`}
              />
            ) : (
              <div className="h-11" />
            )
          }
        />
      </div>
    </section>
  );
}
