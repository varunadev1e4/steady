import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { useToday } from '@/features/profile/useToday';
import { Card } from '@/components/ui/Layout';
import { addDaysISO } from '@/utils/dates';
import { useActivities } from './queries';

/** A 1–10 mood slider with the value shown. */
export function MoodSlider({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} <span className="font-normal text-muted">{value == null ? '(not set)' : `${value} / 10`}</span>
      </label>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value ?? 5}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--accent-strong))]"
      />
      <div className="flex justify-between text-xs text-muted" aria-hidden>
        <span>1 very low</span>
        <span>10 very good</span>
      </div>
    </div>
  );
}

/** Today's planned activities, shown once the user has started using the planner. */
export function ActivitiesTodayCard() {
  const { today } = useToday();
  const recent = useActivities(addDaysISO(today, -14), today);
  const items = recent.data ?? [];
  if (items.length === 0) return null;
  const todays = items.filter((a) => a.day === today);
  return (
    <Card
      title="Something for your mood"
      icon={Sparkles}
      tone="yellow"
      action={
        <Link to="/mind/activities" className="link text-sm">
          {todays.length ? 'Open' : 'Plan one'}
        </Link>
      }
    >
      {todays.length === 0 ? (
        <p className="text-sm text-muted">Nothing planned today. One small thing is enough.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {todays.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              {a.status === 'done' ? <Check className="h-4 w-4 text-accent-ink" aria-label="Done" /> : <span className="h-4 w-4 rounded-full border-2 border-border" aria-hidden />}
              <span className={a.status === 'done' ? 'text-muted line-through' : a.status === 'skipped' ? 'text-muted' : ''}>
                {a.planned_time ? `${a.planned_time.slice(0, 5)} · ` : ''}
                {a.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
