import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, CheckCircle2, CloudOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errors';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** A card-shaped loading placeholder with a few text lines. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-3" role="status" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-5 w-1/3" />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** A small, calm illustration: an organic blob with floating dots and the icon on top. */
function EmptyArt({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="relative mb-5 flex h-32 w-40 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 160 128" className="absolute inset-0 h-full w-full">
        <path
          d="M80 10c26 0 52 10 60 34s-4 50-26 64-52 14-74 2S6 74 14 50 54 10 80 10z"
          fill="rgb(var(--accent-container))"
        />
        <circle cx="22" cy="24" r="6" fill="rgb(var(--tone-yellow))" />
        <circle cx="140" cy="20" r="4" fill="rgb(var(--tone-rose))" />
        <circle cx="146" cy="100" r="7" fill="rgb(var(--tone-blue))" />
        <circle cx="12" cy="96" r="3.5" fill="rgb(var(--tone-violet))" />
        <path d="M118 30l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="rgb(var(--accent-strong))" opacity="0.5" />
      </svg>
      <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-panel text-accent-ink shadow-soft">
        <Icon className="h-8 w-8" />
      </span>
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-10 text-center', className)}>
      {Icon && <EmptyArt icon={Icon} />}
      <h2 className="text-xl">{title}</h2>
      {children && <div className="mt-2 max-w-sm text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "This didn't load",
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-8 text-center', className)} role="alert">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-soft text-amber-ink">
        <CloudOff className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-base">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline message under a form: errors on the error container, success on the secondary container. */
export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm', tone === 'error' ? 'bg-danger-soft text-ink' : 'bg-accent-soft text-ink')}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'error' ? 'text-danger' : 'text-accent-ink')} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
