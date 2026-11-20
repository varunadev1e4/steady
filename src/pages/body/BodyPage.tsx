import { Link } from 'react-router-dom';
import { Activity, Apple, Camera, ChevronRight, Dumbbell, Footprints, Play, Ruler, Stethoscope } from 'lucide-react';
import { useRecentWorkouts, useTemplates } from '@/features/workouts/queries';
import { plannedTemplate } from '@/features/workouts/logic';
import { useStart } from '@/features/workouts/useStart';
import { weekStartOf, weekdayOf } from '@/features/habits/streaks';
import { useModuleEnabled, useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import type { LucideIcon } from 'lucide-react';
import { IconChip, type Tone } from '@/components/ui/Layout';

function HubLink({ to, icon, title, text, tone = 'green' }: { to: string; icon: LucideIcon; title: string; text: string; tone?: Tone }) {
  return (
    <Link to={to} className="card card-link flex items-center gap-4">
      <IconChip icon={icon} tone={tone} size="lg" />
      <span className="flex-1">
        <span className="font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
    </Link>
  );
}

export function TodayWorkoutCard() {
  const { today, weekStart } = useToday();
  const profile = useLoadedProfile();
  const templates = useTemplates();
  const recent = useRecentWorkouts();
  const { start, pending } = useStart();

  if (templates.isPending || recent.isPending) return <CardSkeleton lines={2} />;
  if (templates.isError || recent.isError) {
    return (
      <ErrorState
        error={templates.error ?? recent.error}
        onRetry={() => {
          void templates.refetch();
          void recent.refetch();
        }}
      />
    );
  }
  const todays = recent.data.filter((w) => w.day === today);
  const planned = plannedTemplate(templates.data, weekdayOf(today));
  const ws = weekStartOf(today, weekStart);
  const weekCount = recent.data.filter((w) => w.day >= ws).length;
  const target = profile.weekly_workout_target;

  return (
    <section className="card" aria-labelledby="tw">
      <div className="flex items-center justify-between gap-2">
        <h2 id="tw" className="flex items-center gap-3 text-base">
          <IconChip icon={Dumbbell} tone="blue" size="sm" />
          Today's workout
        </h2>
        <span className="text-sm text-muted">
          {weekCount}
          {target ? ` of ${target}` : ''} this week
        </span>
      </div>
      {todays.length > 0 ? (
        <div className="mt-2 space-y-1">
          {todays.map((w) => (
            <Link key={w.id} to={`/workouts/log/${w.id}`} className="flex items-center justify-between rounded-input bg-accent-soft px-3 py-2 text-accent-ink">
              <span className="font-medium">{w.name}</span>
              <span className="text-sm">{w.ended_at ? 'Done' : 'In progress · continue'}</span>
            </Link>
          ))}
        </div>
      ) : planned ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p>{planned.name}</p>
          <Button size="sm" loading={pending} onClick={() => start(planned)}>
            <Play className="h-4 w-4" aria-hidden />
            Start
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-muted">Rest day</p>
          <Button size="sm" variant="secondary" loading={pending} onClick={() => start(null)}>
            Log one anyway
          </Button>
        </div>
      )}
    </section>
  );
}

export function BodyPage() {
  const workoutsOn = useModuleEnabled('workouts');
  const foodOn = useModuleEnabled('food');
  return (
    <>
      <PageHeader title="Body" description="Movement, food and measurements." />
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {workoutsOn && (
          <div className="lg:col-span-2">
            <TodayWorkoutCard />
          </div>
        )}
        {workoutsOn && (
          <HubLink to="/plans" icon={Footprints} title="Beginner plans" text="Guided walking, home strength and gentle yoga, starting from zero" />
        )}
        {workoutsOn && <HubLink to="/workouts" icon={Dumbbell} tone="blue" title="Workouts" text="Log sets, templates, exercises and progress" />}
        {foodOn && <HubLink to="/food" icon={Apple} tone="orange" title="Food and water" text="Meals, protein and your food library" />}
        <HubLink to="/body/steps" icon={Activity} tone="green" title="Steps" text="Daily steps from your phone, averages and a chart" />
        <HubLink to="/body/measurements" icon={Ruler} tone="violet" title="Measurements" text="Body weight trend and optional measurements" />
        <HubLink to="/body/health" icon={Stethoscope} tone="rose" title="Health readings" text="Blood pressure, blood sugar and resting heart rate" />
        <HubLink to="/body/photos" icon={Camera} tone="yellow" title="Progress photos" text="Private photos to compare over time" />
      </div>
    </>
  );
}
