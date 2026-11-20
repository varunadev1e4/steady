import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { PATTERNS, phaseAt, type Pattern } from '@/features/breathe/patterns';
import { useCompletionMap, useCompletions, useHabits, useToggleCompletion } from '@/features/habits/queries';
import { useToday } from '@/features/profile/useToday';
import { useWakeLock } from '@/lib/wakeLock';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { useToast } from '@/components/ui/feedbackContext';
import { formatDuration } from '@/features/plans/logic';
import { errorMessage } from '@/utils/errors';

const MINUTES = ['1', '3', '5'] as const;

export function BreathePage() {
  const { today } = useToday();
  const [patternKey, setPatternKey] = useState<Pattern['key']>('calm');
  const [minutes, setMinutes] = useState<(typeof MINUTES)[number]>('3');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef<number | null>(null);
  const base = useRef(0);
  const pattern = PATTERNS.find((p) => p.key === patternKey)!;
  const total = Number(minutes) * 60;
  const done = elapsed >= total;
  useWakeLock(running);

  useEffect(() => {
    if (!running) return;
    started.current = Date.now();
    const id = window.setInterval(() => {
      const e = base.current + (Date.now() - (started.current ?? Date.now())) / 1000;
      if (e >= total) {
        setElapsed(total);
        setRunning(false);
        base.current = total;
        navigator.vibrate?.(300);
      } else {
        setElapsed(e);
      }
    }, 100);
    return () => {
      window.clearInterval(id);
      base.current += (Date.now() - (started.current ?? Date.now())) / 1000;
    };
  }, [running, total]);

  const reset = () => {
    setRunning(false);
    base.current = 0;
    setElapsed(0);
  };

  const { index, left } = phaseAt(pattern, elapsed);
  const phase = pattern.phases[index];
  const active = running || (elapsed > 0 && !done);
  // The circle animates to this phase's size over the phase's length.
  const scale = active ? phase.scale : 0.55;

  // Offer to tick a breathing habit if the user has one.
  const habits = useHabits();
  const completions = useCompletions();
  const byHabit = useCompletionMap(completions.data);
  const toggle = useToggleCompletion();
  const toast = useToast();
  const breathingHabit = habits.data?.find((h) => !h.archived_at && /breath/i.test(h.name));
  const habitDone = breathingHabit ? byHabit.get(breathingHabit.id)?.has(today) : false;

  return (
    <>
      <PageHeader title="Breathe" description="A few minutes of slow breathing. Sit comfortably and follow the circle." />
      <div className="space-y-4">
        {!active && !done && (
          <div className="card space-y-3">
            <Segmented
              label="Pattern"
              value={patternKey}
              onChange={(k) => {
                setPatternKey(k);
                reset();
              }}
              options={PATTERNS.map((p) => ({ value: p.key, label: p.name }))}
            />
            <p className="text-sm text-muted">{pattern.description}</p>
            <Segmented
              label="Length"
              value={minutes}
              onChange={(m) => {
                setMinutes(m);
                reset();
              }}
              options={MINUTES.map((m) => ({ value: m, label: `${m} min` }))}
            />
          </div>
        )}

        <section className="card flex flex-col items-center gap-5 py-8" aria-live="polite">
          <div className="relative flex h-60 w-60 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full bg-accent/25"
              style={{
                transform: `scale(${scale})`,
                transition: `transform ${active ? phase.seconds : 0.3}s ease-in-out`,
              }}
              aria-hidden
            />
            <div className="relative text-center">
              <p className="text-2xl font-semibold">{done ? 'Done' : active ? phase.label : 'Ready'}</p>
              {active && <p className="mt-1 text-4xl font-semibold tabular-nums">{left}</p>}
            </div>
          </div>
          <p className="text-sm tabular-nums text-muted">
            {done ? `${minutes} minutes complete` : `${formatDuration(Math.max(0, Math.ceil(total - elapsed)))} left`}
          </p>
          <div className="flex gap-2">
            {!done && (
              <Button size="lg" onClick={() => setRunning((r) => !r)}>
                {running ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
                {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
              </Button>
            )}
            {(elapsed > 0 || done) && (
              <Button size="lg" variant="secondary" onClick={reset}>
                <RotateCcw className="h-5 w-5" aria-hidden />
                {done ? 'Again' : 'Reset'}
              </Button>
            )}
          </div>
          {done && breathingHabit && !habitDone && (
            <Button
              variant="ghost"
              onClick={() =>
                toggle.mutate(
                  { habitId: breathingHabit.id, day: today, done: true },
                  { onSuccess: () => toast(`Ticked “${breathingHabit.name}”`), onError: (e) => toast(errorMessage(e), 'error') },
                )
              }
            >
              Tick “{breathingHabit.name}” for today
            </Button>
          )}
        </section>
        <p className="text-xs text-muted">
          Breathe through your nose if you can, gently and without straining. If you feel light-headed, return to normal breathing.
        </p>
      </div>
    </>
  );
}
