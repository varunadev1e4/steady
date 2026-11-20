import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { Cake, HeartHandshake, Pill, Scale, X } from 'lucide-react';
import { useGoals } from '@/features/goals/queries';
import { pathWeight, smoothedWeight, trackStatus, weightPlan } from '@/features/goals/weight';
import { useMeasurements } from '@/features/workouts/queries';
import { formatWeight } from '@/features/workouts/logic';
import { useDoses, useMedications } from '@/features/medications/queries';
import { doseKey, dosesOn } from '@/features/medications/logic';
import { DoseRow } from '@/features/medications/components';
import { useCheckInRange } from '@/features/checkin/queries';
import { useLoadedProfile } from '@/features/profile/queries';
import { useToday } from '@/features/profile/useToday';
import { Card, IconButton } from '@/components/ui/Layout';
import { ProgressBar } from '@/components/ui/Controls';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { addDaysISO } from '@/utils/dates';
import { MED_SUPPORT } from '@/features/medications/logic';

export function WeightGoalCard() {
  const { today, tz } = useToday();
  const units = useLoadedProfile().units;
  const goals = useGoals();
  const measurements = useMeasurements();
  const goal = (goals.data ?? [])
    .filter((g) => g.kind === 'weight' && !g.archived_at && g.due_date && g.start_value != null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!goal || !measurements.data) return null;
  const startKg = Number(goal.start_value);
  const targetKg = Number(goal.target);
  const startDay = formatInTimeZone(new Date(goal.created_at), tz, 'yyyy-MM-dd');
  const weights = measurements.data.filter((m) => m.weight_kg != null).map((m) => ({ day: m.day, kg: Number(m.weight_kg) }));
  const smoothed = smoothedWeight(weights.filter((w) => w.day >= startDay), today) ?? startKg;
  const plan = weightPlan({ startKg, targetKg, startDay, dueDay: goal.due_date!, currentKg: smoothed, today });
  const status = trackStatus(smoothed, pathWeight(startKg, targetKg, startDay, goal.due_date!, today));
  const last = weights[0]?.day;
  const weighInDue = !last || last < addDaysISO(today, -6);
  const lost = Math.max(0, startKg - smoothed);

  return (
    <Card
      icon={/birthday/i.test(goal.title) ? Cake : Scale}
      tone="orange"
      title={goal.title}
      action={
        <Link to="/goals/weight" className="link text-sm">
          Details
        </Link>
      }
    >
      <ProgressBar value={lost} max={Math.max(0.1, startKg - targetKg)} label="Weight goal progress" tone="clay" />
      <p className="mt-2 text-sm text-muted">
        {plan.pace === 'done'
          ? 'Goal reached.'
          : `${formatWeight(lost, units)} ${units} down, ${formatWeight(Math.max(0, smoothed - targetKg), units)} to go · ${plan.weeksLeft} weeks left`}
        {status === 'on_track' && ' · on track'}
        {status === 'ahead' && ' · ahead of plan'}
      </p>
      {weighInDue && (
        <Link to="/goals/weight" className={`${buttonClasses('secondary', 'sm')} mt-2`}>
          Time for your weekly weigh-in
        </Link>
      )}
    </Card>
  );
}

export function MedsTodayCard() {
  const { today, tz } = useToday();
  const meds = useMedications();
  const doses = useDoses(today, today);
  const active = (meds.data ?? []).filter((m) => !m.archived_at);
  if (!meds.data || active.length === 0) return null;
  const due = dosesOn(active, today);
  if (due.length === 0) return null;
  const logged = new Map((doses.data ?? []).map((d) => [doseKey(d.medication_id, d.day, d.scheduled_time), d]));
  const taken = due.filter((d) => logged.get(doseKey(d.medicationId, today, d.time))?.status === 'taken').length;

  return (
    <Card
      title="Medication"
      icon={Pill}
      tone="rose"
      action={
        <Link to="/meds" className="link text-sm">
          {taken} of {due.length} taken
        </Link>
      }
    >

        <ul className="divide-y divide-border">
          {due.map((d) => (
            <DoseRow key={`${d.medicationId}-${d.time}`} med={d.med} time={d.time} day={today} logged={logged.get(doseKey(d.medicationId, today, d.time))} tz={tz} />
          ))}
        </ul>

    </Card>
  );
}

const DISMISS_KEY = 'steady-support-dismissed';

/** Appears only after three low-mood check-ins in a row; can be dismissed for the day. */
export function GentleSupportCard() {
  const { today } = useToday();
  const recent = useCheckInRange(addDaysISO(today, -2), today);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === today;
    } catch {
      return false;
    }
  });
  const moods = (recent.data ?? []).filter((c) => c.mood != null);
  if (dismissed || moods.length < 3 || !moods.every((c) => (c.mood ?? 5) <= 2)) return null;
  return (
    <section className="card relative" aria-labelledby="gentle">
      <IconButton
        label="Hide for today"
        className="absolute right-2 top-2"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISS_KEY, today);
          } catch {
            // ignore
          }
        }}
      >
        <X className="h-4 w-4" />
      </IconButton>
      <h2 id="gentle" className="flex items-center gap-2 pr-10 text-base">
        <HeartHandshake className="h-5 w-5 text-accent-ink" aria-hidden />
        It's been a heavy few days
      </h2>
      <p className="mt-1 text-sm text-muted">
        Be gentle with yourself. Talking to someone can help, whether that's someone you trust, your therapist or prescriber, or{' '}
        <a href={`tel:${MED_SUPPORT.helplineNumber}`} className="link">
          {MED_SUPPORT.helplineName} on {MED_SUPPORT.helplineNumber}
        </a>{' '}
        (free, 24/7). In an emergency, call {MED_SUPPORT.emergency}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/breathe" className={buttonClasses('secondary', 'sm')}>
          A few minutes of breathing
        </Link>
        <Link to="/journal/write?type=brain_dump" className={buttonClasses('ghost', 'sm')}>
          Write it down
        </Link>
      </div>
    </section>
  );
}
