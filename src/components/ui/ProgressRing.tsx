import { Check } from 'lucide-react';

// Eight little dots that drift outwards once when the day is complete.
const BURST = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return { bx: `${Math.round(Math.cos(a) * 54)}px`, by: `${Math.round(Math.sin(a) * 54)}px`, tone: i % 2 ? '--clay' : '--accent-strong' };
});

/** A circular progress indicator with the count in the middle, and a quiet celebration at 100%. */
export function ProgressRing({ done, total, size = 76, label }: { done: number; total: number; size?: number; label: string }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      {complete &&
        BURST.map((b, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 animate-burst rounded-full"
            style={{ ['--bx' as string]: b.bx, ['--by' as string]: b.by, backgroundColor: `rgb(var(${b.tone}))`, animationDelay: `${i * 30}ms` }}
          />
        ))}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-accent-on-container/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="text-accent-strong transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden>
        {complete ? (
          <span key="done" className="flex h-11 w-11 animate-pop items-center justify-center rounded-full bg-accent-strong text-accent-fg">
            <Check className="h-6 w-6" strokeWidth={3} />
          </span>
        ) : (
          <span className="display-num text-2xl text-accent-on-container">
            {done}
            <span className="text-sm font-semibold opacity-70">/{total}</span>
          </span>
        )}
      </span>
    </div>
  );
}
