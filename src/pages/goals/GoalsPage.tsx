import { useState } from 'react';
import { Archive, Check, Flag, Pencil, Plus, Scale, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useActivityData, useDeleteGoal, useGoals, useSaveGoal } from '@/features/goals/queries';
import { computeMilestones, GOAL_KINDS, goalProgress, type GoalKind } from '@/features/goals/logic';
import { formatWeight, toKg } from '@/features/workouts/logic';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { GoalRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Controls';
import { SelectField, TextField } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, EmptyState, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { formatISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

const kindInfo = (k: string) => GOAL_KINDS.find((g) => g.value === k) ?? GOAL_KINDS[GOAL_KINDS.length - 1];

const SUGGESTED: Array<{ title: string; kind: GoalKind; target: number }> = [
  { title: 'Walk 30 minutes without stopping', kind: 'longest_walk', target: 30 },
  { title: '150 active minutes this week', kind: 'weekly_activity_minutes', target: 150 },
  { title: '2 strength workouts this week', kind: 'workouts_per_week', target: 2 },
  { title: 'Average 7,000 steps a day', kind: 'steps_daily_avg', target: 7000 },
];

function GoalForm({ goal, onDone, latestWeightKg }: { goal: GoalRow | null; onDone: () => void; latestWeightKg: number | null }) {
  const profile = useLoadedProfile();
  const units = profile.units;
  const save = useSaveGoal();
  const [kind, setKind] = useState<GoalKind>((goal?.kind as GoalKind) ?? 'longest_walk');
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState(goal ? String(goal.kind === 'weight' ? formatWeight(Number(goal.target), units) : Number(goal.target)) : '');
  const [current, setCurrent] = useState(goal?.current_value != null ? String(Number(goal.current_value)) : '');
  const [unit, setUnit] = useState(goal?.unit ?? '');
  const [due, setDue] = useState(goal?.due_date ?? '');
  const [err, setErr] = useState<string | null>(null);
  const info = kindInfo(kind);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const t = Number(target);
        if (!title.trim()) return setErr('Give the goal a name.');
        if (!target || Number.isNaN(t) || t <= 0) return setErr('Enter a target above zero.');
        if (kind === 'weight' && latestWeightKg == null && !goal) return setErr('Log your weight under Body → Measurements first, so progress has a starting point.');
        setErr(null);
        save.mutate(
          {
            id: goal?.id,
            input: {
              title: title.trim(),
              kind,
              target: kind === 'weight' ? Math.round(toKg(t, units) * 100) / 100 : t,
              start_value: kind === 'weight' ? (goal?.start_value ?? latestWeightKg) : null,
              current_value: kind === 'custom' && current ? Number(current) : null,
              unit: kind === 'custom' ? unit.trim() || null : null,
              due_date: due || null,
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      {!goal && (
        <SelectField
          label="What kind of goal?"
          value={kind}
          onChange={(e) => setKind(e.target.value as GoalKind)}
          options={GOAL_KINDS.map((g) => ({ value: g.value, label: g.label }))}
          hint={info.hint}
        />
      )}
      <TextField label="Name" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Walk 30 minutes without stopping" />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={`Target${kind === 'weight' ? ` (${units})` : info.unit ? ` (${info.unit})` : ''}`}
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ''))}
        />
        <TextField label="By (optional)" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      {kind === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Progress so far" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value.replace(/[^\d.]/g, ''))} />
          <TextField label="Unit (optional)" maxLength={20} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. books" />
        </div>
      )}
      {kind === 'weight' && latestWeightKg != null && !goal && (
        <p className="text-sm text-muted">Starting from your latest weight: {formatWeight(latestWeightKg, units)} {units}.</p>
      )}
      {(err || save.isError) && <FormMessage tone="error">{err ?? errorMessage(save.error)}</FormMessage>}
      <Button type="submit" loading={save.isPending}>
        {goal ? 'Save goal' : 'Add goal'}
      </Button>
    </form>
  );
}

export function GoalsPage() {
  const { today, weekStart } = useToday();
  const profile = useLoadedProfile();
  const goals = useGoals();
  const activity = useActivityData();
  const save = useSaveGoal();
  const del = useDeleteGoal();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<GoalRow | 'new' | null>(null);

  const pending = goals.isPending || activity.isPending;
  const error = goals.error ?? activity.error;
  const active = (goals.data ?? []).filter((g) => !g.archived_at);
  const milestones = activity.data ? computeMilestones(activity.data, weekStart) : [];
  const reached = milestones.filter((m) => m.achievedOn);

  const show = (g: GoalRow, v: number | null) => {
    if (v == null) return '–';
    if (g.kind === 'weight') return `${formatWeight(v, profile.units)} ${profile.units}`;
    const u = g.kind === 'custom' ? g.unit ?? '' : kindInfo(g.kind).unit;
    return `${Math.round(v * 10) / 10 === Math.round(v) ? Math.round(v).toLocaleString() : v}${u ? ` ${u}` : ''}`;
  };

  return (
    <>
      <PageHeader
        title="Goals"
        description="Progress fills in from what you already log."
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden />
            New goal
          </Button>
        }
      />
      <Sheet open={editing != null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New goal' : 'Edit goal'}>
        <GoalForm
          goal={editing === 'new' ? null : editing}
          latestWeightKg={activity.data?.latestWeightKg ?? null}
          onDone={() => {
            toast('Goal saved');
            setEditing(null);
          }}
        />
      </Sheet>

      <Link to="/goals/weight" className={`${buttonClasses('secondary')} mb-4 w-full`}>
        <Scale className="h-4 w-4" aria-hidden />
        {(goals.data ?? []).some((g) => g.kind === 'weight' && !g.archived_at && g.due_date) ? 'Open my weight goal' : 'Set a weight goal with a date'}
      </Link>
      {pending ? (
        <CardSkeleton lines={4} />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void goals.refetch();
            void activity.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          {active.length === 0 ? (
            <EmptyState icon={Target} title="No goals yet">
              <p>Pick something meaningful and reachable. A few to start with:</p>
              <div className="mt-3 flex flex-col gap-2">
                {SUGGESTED.map((s) => (
                  <Button
                    key={s.title}
                    size="sm"
                    variant="secondary"
                    loading={save.isPending}
                    onClick={() => save.mutate({ input: { title: s.title, kind: s.kind, target: s.target } }, { onSuccess: () => toast('Goal added') })}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {s.title}
                  </Button>
                ))}
              </div>
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {active.map((g) => {
                const p = goalProgress(g, activity.data!, today, weekStart);
                const weekly = g.kind === 'weekly_activity_minutes' || g.kind === 'workouts_per_week';
                return (
                  <li key={g.id} className="card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium">
                          {p.reached && <Check className="h-4 w-4 shrink-0 text-accent-ink" aria-label="Reached" />}
                          {g.kind === 'weight' && g.due_date ? (
                            <Link to="/goals/weight" className="hover:text-accent-ink">
                              {g.title}
                            </Link>
                          ) : (
                            g.title
                          )}
                        </p>
                        <p className="text-sm text-muted">
                          {show(g, p.current)} of {show(g, Number(g.target))}
                          {weekly && ' this week'}
                          {g.kind === 'weight' && g.start_value != null && ` · started at ${formatWeight(Number(g.start_value), profile.units)}`}
                          {g.due_date && ` · by ${formatISODate(g.due_date, profile.date_format)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <IconButton label="Edit goal" onClick={() => setEditing(g)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Archive goal" onClick={() => save.mutate({ id: g.id, input: { archived_at: new Date().toISOString() } })}>
                          <Archive className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Delete goal"
                          onClick={async () => {
                            if (await confirm({ title: `Delete “${g.title}”?`, confirmLabel: 'Delete', danger: true })) del.mutate(g.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                    <ProgressBar value={p.percent} max={100} label={`${g.title} progress`} />
                    {p.reached && <p className="text-sm text-accent-ink">{weekly ? 'Reached this week.' : 'Reached.'} Well done.</p>}
                    {g.kind === 'weight' && activity.data?.latestWeightKg == null && (
                      <p className="text-xs text-muted">Log your weight under Body → Measurements to see progress.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <section className="card" aria-labelledby="ms">
            <h2 id="ms" className="flex items-center gap-2 text-base">
              <Flag className="h-4 w-4 text-clay-ink" aria-hidden />
              Milestones
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {reached.length ? `${reached.length} of ${milestones.length} reached so far.` : 'These fill in as you go. No pressure.'}
            </p>
            <ul className="mt-3 space-y-2">
              {milestones.map((m) => (
                <li key={m.key} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                      m.achievedOn ? 'border-accent bg-accent text-accent-fg' : 'border-border',
                    )}
                    aria-hidden
                  >
                    {m.achievedOn && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span className={cn('text-sm', !m.achievedOn && 'text-muted')}>
                    <span className="font-medium">{m.label}</span>
                    <span className="block text-xs text-muted">
                      {m.achievedOn ? `Reached ${formatISODate(m.achievedOn, profile.date_format)}` : m.hint}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
