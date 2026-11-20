import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { FeedbackContext, type ConfirmOptions, type FeedbackApi } from './feedbackContext';
import { cn } from '@/utils/cn';

interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  };

  const toast = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3000);
  }, []);

  const api = useMemo<FeedbackApi>(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <Sheet open={pending != null} onClose={() => settle(false)} title={pending?.title ?? ''}>
        {pending?.body && <p className="text-muted">{pending.body}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => settle(false)}>
            Cancel
          </Button>
          <Button variant={pending?.danger ? 'danger' : 'primary'} onClick={() => settle(true)} autoFocus>
            {pending?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </Sheet>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <p
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto w-full max-w-sm animate-fade-up rounded-lg px-4 py-3.5 text-sm font-medium shadow-lift',
              t.tone === 'error' ? 'bg-danger-soft text-ink' : 'bg-inverse text-inverse-ink',
            )}
          >
            {t.message}
          </p>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}
