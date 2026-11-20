export function Logo({ className, markOnly = false }: { className?: string; markOnly?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden>
        <path
          d="M14 40c6-10 12-10 18 0s12 10 18 0"
          fill="none"
          stroke="rgb(var(--accent-strong))"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="32" cy="22" r="5" fill="rgb(var(--clay))" />
      </svg>
      {markOnly ? <span className="sr-only">Steady</span> : <span className="text-lg font-bold tracking-tight text-ink">Steady</span>}
    </span>
  );
}
