import { useEffect, useState } from 'react';
import { Timer, X } from 'lucide-react';

/**
 * In-app rest timer. It counts from a fixed end time, so it stays accurate
 * if the tab is briefly in the background. It only runs while Steady is
 * open; there are no background notifications.
 */
export function RestTimer({ endsAt, onChange }: { endsAt: number | null; onChange: (endsAt: number | null) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (endsAt && left === 0) navigator.vibrate?.(200);
  }, [endsAt, left]);

  if (!endsAt) return null;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div
      role="timer"
      aria-live="off"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-panel/95 px-4 py-2 backdrop-blur md:bottom-0 md:left-60"
    >
      <div className="mx-auto flex max-w-content items-center gap-3">
        <Timer className="h-5 w-5 text-clay-ink" aria-hidden />
        <span className="flex-1 text-sm">
          {left > 0 ? (
            <>
              Rest <span className="ml-1 text-lg font-semibold tabular-nums">{mm}:{ss}</span>
            </>
          ) : (
            <span className="font-medium">Rest done. Ready when you are.</span>
          )}
        </span>
        <button type="button" className="min-h-9 rounded-input px-2 text-sm font-medium hover:bg-surface" onClick={() => onChange(Math.max(Date.now(), endsAt - 15_000))}>
          −15s
        </button>
        <button type="button" className="min-h-9 rounded-input px-2 text-sm font-medium hover:bg-surface" onClick={() => onChange(Math.max(Date.now(), endsAt) + 15_000)}>
          +15s
        </button>
        <button type="button" aria-label="Close rest timer" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface" onClick={() => onChange(null)}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
