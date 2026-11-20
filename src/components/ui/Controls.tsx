import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { MOODS, normaliseTag } from './scales';
import { cn } from '@/utils/cn';

/* ------------------------------------------------------------ Segmented -- */

/** Material 3 segmented buttons: one outlined pill, the selected segment tonal with a check. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  const showCheck = options.length <= 3;
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex overflow-hidden rounded-full border border-outline', className)}>
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-center gap-1.5 px-3 text-sm font-semibold transition-colors',
              i > 0 && 'border-l border-outline',
              active ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-raised',
            )}
          >
            {active && showCheck && <Check className="h-4 w-4 shrink-0" aria-hidden />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- Stepper -- */

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-ink transition-colors hover:bg-raised active:scale-95 disabled:opacity-40"
        onClick={() => onChange(clamp(value - step))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      <output className="min-w-16 text-center text-3xl font-bold tabular-nums" aria-live="polite">
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-muted">{suffix}</span>}
      </output>
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-strong text-accent-fg shadow-soft transition-colors hover:bg-accent-hover active:scale-95 disabled:opacity-40"
        onClick={() => onChange(clamp(value + step))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

/* --------------------------------------------------------- Rating scale -- */

/** A 1–5 picker. Mood uses faces; other scales use numbers with end labels. */
export function RatingPicker({
  label,
  value,
  onChange,
  kind = 'number',
  lowLabel,
  highLabel,
  allowClear = true,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  kind?: 'mood' | 'number';
  lowLabel?: string;
  highLabel?: string;
  allowClear?: boolean;
}) {
  const id = useId();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, (value ?? 0) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(1, (value ?? 2) - 1));
    }
  };
  return (
    <div>
      <p id={id} className="label">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-5 gap-2" onKeyDown={onKey}>
        {MOODS.map((m) => {
          const active = value === m.value;
          const Icon = m.icon;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active || (value == null && m.value === 3) ? 0 : -1}
              aria-label={kind === 'mood' ? m.label : String(m.value)}
              onClick={() => onChange(active && allowClear ? null : m.value)}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-sm font-semibold transition-all',
                active ? 'bg-accent-strong text-accent-fg shadow-soft' : 'bg-surface text-ink hover:bg-raised',
              )}
            >
              {kind === 'mood' ? (
                <>
                  <Icon className="h-6 w-6" aria-hidden />
                  <span className="text-[0.6875rem]">{m.label}</span>
                </>
              ) : (
                <span className="text-base">{m.value}</span>
              )}
            </button>
          );
        })}
      </div>
      {kind === 'number' && (lowLabel || highLabel) && (
        <div className="mt-1.5 flex justify-between text-xs text-muted" aria-hidden>
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Tag input -- */

export function TagInput({
  label = 'Tags',
  value,
  onChange,
  suggestions = [],
  max = 20,
}: {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  max?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const t = normaliseTag(raw);
    if (t && !value.includes(t) && value.length < max) onChange([...value, t]);
    setDraft('');
  };
  const listId = `${id}-list`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="input flex flex-wrap items-center gap-1.5 py-2">
        {value.map((t) => (
          <span key={t} className="inline-flex h-8 items-center gap-1 rounded-chip border border-outline pl-3 pr-1.5 text-sm font-medium text-ink">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="rounded-full p-0.5 hover:bg-raised">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={suggestions.length ? listId : undefined}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) add(v.slice(0, -1));
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? '' : 'Add a tag, then Enter'}
          className="min-w-24 flex-1 bg-transparent py-1 outline-none placeholder:text-muted/70"
          aria-describedby={`${id}-hint`}
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions
              .filter((s) => !value.includes(s))
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>
        )}
      </div>
      <p id={`${id}-hint`} className="sr-only">
        Press Enter or comma to add a tag.
      </p>
    </div>
  );
}

/* --------------------------------------------------------- Progress bar -- */

/** Material 3 linear progress: rounded indicator on a tonal track. */
export function ProgressBar({
  value,
  max,
  label,
  tone = 'accent',
}: {
  value: number;
  max: number;
  label: string;
  tone?: 'accent' | 'clay';
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn('h-2 w-full overflow-hidden rounded-full', tone === 'accent' ? 'bg-accent-soft' : 'bg-clay-soft')}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-300', tone === 'accent' ? 'bg-accent' : 'bg-clay')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ----------------------------------------------------------------- Chip -- */

/** Material 3 filter chip. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-chip border px-3 py-1 text-sm font-medium transition-colors',
        active ? 'border-transparent bg-accent-soft text-ink' : 'border-outline text-ink hover:bg-raised',
      )}
    >
      {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}
