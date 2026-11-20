import { useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { haptic } from '@/utils/haptics';
import { cn } from '@/utils/cn';

const THRESHOLD = 88; // px of drag that commits the action

/**
 * Swipe a row to the right to run an action (e.g. complete a task) on touch
 * screens. Vertical scrolling is untouched, and the same action is always
 * available as a normal button inside the row, so swiping is only a shortcut.
 */
export function SwipeRow({
  children,
  onSwipe,
  label,
  icon: Icon,
  disabled = false,
}: {
  children: ReactNode;
  onSwipe: () => void;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const swiped = useRef(false);
  const armed = dx >= THRESHOLD;

  const reset = () => {
    start.current = null;
    horizontal.current = null;
    setDx(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 flex items-center gap-2 rounded-2xl px-4 text-sm font-bold transition-colors',
          armed ? 'bg-accent-strong text-accent-fg' : 'bg-accent-soft text-ink',
          dx === 0 && 'invisible',
        )}
      >
        <Icon className={cn('h-5 w-5 transition-transform', armed && 'scale-125')} />
        {label}
      </div>
      <div
        className={cn('relative bg-panel', dx === 0 && 'transition-transform duration-200')}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (disabled || e.pointerType === 'mouse') return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          horizontal.current = null;
          swiped.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (horizontal.current == null && Math.abs(mx) + Math.abs(my) > 8) {
            horizontal.current = Math.abs(mx) > Math.abs(my) * 1.4 && mx > 0;
            if (horizontal.current) {
              swiped.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }
          if (!horizontal.current) return;
          const next = Math.max(0, Math.min(mx, 160));
          if (next >= THRESHOLD && dx < THRESHOLD) haptic();
          setDx(next);
        }}
        onPointerUp={() => {
          const commit = horizontal.current && dx >= THRESHOLD;
          reset();
          if (commit) {
            haptic('success');
            onSwipe();
          }
        }}
        onPointerCancel={reset}
        onClickCapture={(e) => {
          // A swipe shouldn't also count as a tap on whatever is under the finger.
          if (swiped.current) {
            e.stopPropagation();
            e.preventDefault();
            swiped.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
