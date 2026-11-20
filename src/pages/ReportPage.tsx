import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { ArrowLeft, Printer } from 'lucide-react';
import { usePeriodSummary } from '@/features/review/queries';
import { useMeasurements } from '@/features/workouts/queries';
import { formatWeight } from '@/features/workouts/logic';
import { useGoals } from '@/features/goals/queries';
import { useAssessments, useActivities, useCravings } from '@/features/mind/queries';
import { ASSESSMENTS, severity } from '@/features/mind/assessments';
import { liftByCategory } from '@/features/mind/activities';
import { summarise, triggerLabel } from '@/features/mind/cravings';
import { useDoses, useMedications } from '@/features/medications/queries';
import { adherence } from '@/features/medications/logic';
import { useHealthReadings } from '@/features/health/queries';
import { average, toDisplayGlucose } from '@/features/health/logic';
import { useCheckInRange } from '@/features/checkin/queries';
import { regularity } from '@/features/sleep/logic';
import { proteinSummary } from '@/features/food/logic';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import { addDaysISO, formatISODate } from '@/utils/dates';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-border pt-3">
      <h2 className="text-base">{title}</h2>
      <div className="mt-1 space-y-0.5 text-sm">{children}</div>
    </section>
  );
}

const Line = ({ label, value }: { label: string; value: ReactNode }) => (
  <p className="flex justify-between gap-4">
    <span className="text-muted">{label}</span>
    <span className="text-right tabular-nums">{value}</span>
  </p>
);

function Report() {
  const { today, tz, now } = useToday();
  const profile = useLoadedProfile();
  const units = profile.units;
  const [params, setParams] = useSearchParams();
  const days = [30, 90].includes(Number(params.get('days'))) ? Number(params.get('days')) : 30;
  const from = addDaysISO(today, -(days - 1));

  const summary = usePeriodSummary(from, today, tz, today);
  const measurements = useMeasurements();
  const goals = useGoals();
  const assessments = useAssessments();
  const meds = useMedications();
  const doses = useDoses(from, today);
  const health = useHealthReadings(from);
  const checkIns = useCheckInRange(from, today);
  const cravings = useCravings(from);
  const activities = useActivities(from, today);

  if (summary.isPending) return <CardSkeleton lines={8} />;
  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  const s = summary.data;

  const weights = (measurements.data ?? []).filter((m) => m.day >= from && m.weight_kg != null);
  const latestW = weights[0];
  const firstW = weights[weights.length - 1];
  const goal = (goals.data ?? []).find((g) => g.kind === 'weight' && !g.archived_at && g.due_date);
  const latestA = (k: 'phq9' | 'gad7') => (assessments.data ?? []).filter((a) => a.kind === k);
  const nowHHmm = formatInTimeZone(now, tz, 'HH:mm');
  const activeMeds = (meds.data ?? []).filter((m) => !m.archived_at);
  const bp = (health.data ?? []).filter((r) => r.systolic != null);
  const fasting = (health.data ?? []).filter((r) => r.glucose_context === 'fasting' && r.glucose_mg_dl != null);
  const reg = regularity((checkIns.data ?? []).map((c) => ({ bedtime: c.bedtime?.slice(0, 5) ?? null, wake_time: c.wake_time?.slice(0, 5) ?? null })));
  const cs = summarise(cravings.data ?? [], (iso) => Number(formatInTimeZone(new Date(iso), tz, 'H')));
  const lifts = liftByCategory(activities.data ?? []).filter((l) => l.lift != null);
  const done = (activities.data ?? []).filter((a) => a.status === 'done').length;
  const weeks = days / 7;
  const activeMin = (s.workout_minutes ?? 0) + (s.cardio_minutes ?? 0);
  const protein = proteinSummary(s.protein_by_day, profile.protein_target_g);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/review" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Review
        </Link>
        <Segmented
          label="Period"
          value={String(days) as '30' | '90'}
          onChange={(v) => setParams({ days: v })}
          options={[
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
          className="w-48"
        />
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          Print or save as PDF
        </Button>
      </div>
      <header>
        <h1 className="text-2xl">Body and mind report</h1>
        <p className="text-sm text-muted">
          {profile.display_name ? `${profile.display_name} · ` : ''}
          {formatISODate(from, profile.date_format)} – {formatISODate(today, profile.date_format)} ({days} days). Self-recorded in the Steady app.
        </p>
      </header>

      <Block title="Weight">
        <Line label="Latest" value={latestW ? `${formatWeight(Number(latestW.weight_kg), units)} ${units} (${formatISODate(latestW.day, 'd MMM')})` : '–'} />
        <Line
          label="Change in period"
          value={latestW && firstW && latestW !== firstW ? `${formatWeight(Number(latestW.weight_kg) - Number(firstW.weight_kg), units)} ${units} since ${formatISODate(firstW.day, 'd MMM')}` : '–'}
        />
        {goal && <Line label="Goal" value={`${goal.title} (target ${formatWeight(Number(goal.target), units)} ${units})`} />}
      </Block>

      <Block title="Mood and anxiety">
        <Line label="Average daily mood (1–5)" value={s.mood_avg ?? '–'} />
        <Line label="Average energy / stress (1–5)" value={`${s.energy_avg ?? '–'} / ${s.stress_avg ?? '–'}`} />
        <Line label="Check-in days" value={`${s.check_in_days} of ${days}`} />
        {(['phq9', 'gad7'] as const).map((k) => {
          const rows = latestA(k);
          const last = rows[0];
          const prev = rows[1];
          return (
            <Line
              key={k}
              label={ASSESSMENTS[k].name}
              value={last ? `${last.score} (${severity(k, last.score).toLowerCase()}) on ${formatISODate(last.day, 'd MMM')}${prev ? `; previous ${prev.score} on ${formatISODate(prev.day, 'd MMM')}` : ''}` : 'not done'}
            />
          );
        })}
      </Block>

      <Block title="Sleep">
        <Line label="Average sleep" value={s.sleep_avg != null ? `${s.sleep_avg} h` : '–'} />
        <Line label="Usual bedtime / wake time" value={reg.avgBedtime ? `${reg.avgBedtime} / ${reg.avgWake ?? '–'}` : '–'} />
        <Line label="Regularity" value={reg.label ? `${reg.label} (bed ±${reg.bedtimeSpread ?? '–'} min, wake ±${reg.wakeSpread ?? '–'} min)` : '–'} />
      </Block>

      <Block title="Activity">
        <Line label="Active minutes per week (average)" value={Math.round(activeMin / weeks)} />
        <Line label="Strength workouts / cardio sessions" value={`${s.workouts} / ${s.cardio_sessions}`} />
        <Line label="Average steps (days logged)" value={s.steps_avg != null ? `${Number(s.steps_avg).toLocaleString()} (${s.steps_days} days)` : '–'} />
      </Block>

      {activeMeds.length > 0 && (
        <Block title="Medication">
          {activeMeds.map((m) => {
            const a = adherence([m], doses.data ?? [], from, today, today, nowHHmm);
            return (
              <Line
                key={m.id}
                label={`${m.name}${m.dose ? ` ${m.dose}` : ''}`}
                value={m.as_needed ? `${(doses.data ?? []).filter((d) => d.medication_id === m.id && d.status === 'taken').length} times (as needed)` : a.percent == null ? '–' : `${a.taken} of ${a.expected} doses taken (${a.percent}%)`}
              />
            );
          })}
        </Block>
      )}

      {(bp.length > 0 || fasting.length > 0) && (
        <Block title="Health readings">
          {bp.length > 0 && <Line label="Average blood pressure" value={`${Math.round(average(bp.map((r) => r.systolic))!)}/${Math.round(average(bp.map((r) => r.diastolic))!)} (${bp.length} readings)`} />}
          {fasting.length > 0 && (
            <Line label={`Average fasting sugar (${profile.glucose_unit})`} value={`${average(fasting.map((r) => toDisplayGlucose(Number(r.glucose_mg_dl), profile.glucose_unit)))} (${fasting.length} readings)`} />
          )}
        </Block>
      )}

      <Block title="Food">
        <Line label="Average protein (days logged)" value={protein.avg != null ? `${protein.avg} g (${protein.daysLogged} days)` : '–'} />
        <Line label="Average water (glasses)" value={s.water_avg ?? '–'} />
        <Line label="Cravings logged" value={cs.total ? `${cs.total}; most often ${triggerLabel(cs.byTrigger[0][0]).toLowerCase()}${cs.managedPercent != null ? `; handled as wanted ${cs.managedPercent}%` : ''}` : 'none'} />
      </Block>

      <Block title="Mood-lifting activities">
        <Line label="Activities done" value={done} />
        {lifts.length > 0 ? (
          lifts.map((l) => <Line key={l.key} label={`${l.label}: average mood change (1–10)`} value={`${l.lift! > 0 ? '+' : ''}${l.lift} over ${l.n}`} />)
        ) : (
          <p className="text-muted">Not enough before/after ratings yet.</p>
        )}
      </Block>

      <p className="text-xs text-muted">
        Scores and averages are self-reported and descriptive, not a diagnosis. PHQ-9 and GAD-7 by Drs. Spitzer, Williams, Kroenke and colleagues (Pfizer, free to use).
      </p>
    </div>
  );
}

export function ReportPage() {
  return (
    <>
      <Report />
    </>
  );
}
