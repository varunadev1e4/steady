import { useEffect } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '@/utils/cn';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/**
 * A 6-digit PIN pad: dots for progress, large keys, and keyboard support
 * (digits and Backspace). Calls onComplete when the 6th digit is entered.
 */
export function PinPad({
  value,
  onChange,
  onComplete,
  disabled = false,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  disabled?: boolean;
  length?: number;
}) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === 'del') return onChange(value.slice(0, -1));
    if (value.length >= length) return;
    const next = value + k;
    onChange(next);
    if (next.length === length) onComplete(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="mx-auto w-full max-w-[18rem]">
      <div className="mb-8 flex justify-center gap-4" aria-label={`${value.length} of ${length} digits entered`} role="status">
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={cn('h-3.5 w-3.5 rounded-full transition-all', i < value.length ? 'scale-110 bg-accent-strong' : 'bg-outline/40')}
            aria-hidden
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(k)}
              aria-label={k === 'del' ? 'Delete last digit' : k}
              className={cn(
                'flex aspect-square items-center justify-center rounded-full text-2xl font-semibold transition-all active:scale-95 disabled:opacity-50',
                k === 'del' ? 'text-muted hover:bg-raised' : 'bg-panel text-ink hover:bg-raised',
              )}
            >
              {k === 'del' ? <Delete className="h-6 w-6" aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
