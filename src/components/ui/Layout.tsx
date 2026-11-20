import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export type Tone = 'green' | 'blue' | 'violet' | 'orange' | 'yellow' | 'rose';

// Full class names so Tailwind keeps them.
const TONE: Record<Tone, string> = {
  green: 'bg-tone-green text-tone-green-ink',
  blue: 'bg-tone-blue text-tone-blue-ink',
  violet: 'bg-tone-violet text-tone-violet-ink',
  orange: 'bg-tone-orange text-tone-orange-ink',
  yellow: 'bg-tone-yellow text-tone-yellow-ink',
  rose: 'bg-tone-rose text-tone-rose-ink',
};

/** A round, colour-coded icon badge that identifies a module. */
export function IconChip({ icon: Icon, tone = 'green', size = 'md' }: { icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        TONE[tone],
        size === 'sm' ? 'h-8 w-8' : size === 'md' ? 'h-10 w-10' : 'h-12 w-12',
      )}
      aria-hidden
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-5 w-5' : 'h-6 w-6'} />
    </span>
  );
}

/** A titled card section (Material 3 filled card), optionally with a module icon. */
export function Card({
  title,
  action,
  children,
  className,
  titleId,
  icon,
  tone,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  titleId?: string;
  icon?: LucideIcon;
  tone?: Tone;
}) {
  return (
    <section className={cn('card', className)} aria-labelledby={titleId}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon && <IconChip icon={icon} tone={tone} size="sm" />}
            {title && (
              <h2 id={titleId} className="truncate text-base">
                {title}
              </h2>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Material 3 primary tabs (each view has its own URL). */
export function LinkTabs({ items, label }: { items: Array<{ to: string; label: string; end?: boolean }>; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-5 flex overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) =>
            cn(
              'relative flex min-h-12 flex-1 items-center justify-center whitespace-nowrap px-4 text-sm font-semibold transition-colors',
              isActive ? 'text-accent-ink' : 'text-muted hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              {i.label}
              {isActive && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-accent-ink" aria-hidden />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** A tappable row that links somewhere. */
export function RowLink({ to, children, meta }: { to: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-12 items-center gap-3 py-2 transition-colors hover:text-accent-ink">
      <span className="min-w-0 flex-1">{children}</span>
      {meta && <span className="shrink-0 text-sm text-muted">{meta}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-3.5 py-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums leading-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Material 3 standard icon button. */
export function IconButton({
  label,
  onClick,
  children,
  className,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}
