export interface Phase {
  label: string;
  seconds: number;
  /** Circle size at the end of the phase (1 = full). */
  scale: number;
}

export interface Pattern {
  key: 'calm' | 'box';
  name: string;
  description: string;
  phases: Phase[];
}

/**
 * Two well-established slow-breathing patterns. Breathing at around six
 * breaths a minute with a longer out-breath is calming for most people;
 * box breathing is an even, easy-to-follow rhythm.
 */
export const PATTERNS: Pattern[] = [
  {
    key: 'calm',
    name: 'Calm (in 4, out 6)',
    description: 'About six slow breaths a minute, with a longer out-breath to help you settle.',
    phases: [
      { label: 'Breathe in', seconds: 4, scale: 1 },
      { label: 'Breathe out', seconds: 6, scale: 0.55 },
    ],
  },
  {
    key: 'box',
    name: 'Box (4-4-4-4)',
    description: 'In, hold, out, hold, four counts each. Steady and easy to follow.',
    phases: [
      { label: 'Breathe in', seconds: 4, scale: 1 },
      { label: 'Hold', seconds: 4, scale: 1 },
      { label: 'Breathe out', seconds: 4, scale: 0.55 },
      { label: 'Hold', seconds: 4, scale: 0.55 },
    ],
  },
];

export const cycleSeconds = (p: Pattern) => p.phases.reduce((s, x) => s + x.seconds, 0);

/** Where we are after `elapsed` seconds: the phase, seconds left in it, and the cycle count. */
export function phaseAt(p: Pattern, elapsed: number): { index: number; left: number; cycle: number } {
  const cycle = cycleSeconds(p);
  const within = ((elapsed % cycle) + cycle) % cycle;
  let t = 0;
  for (let i = 0; i < p.phases.length; i++) {
    if (within < t + p.phases[i].seconds) return { index: i, left: Math.ceil(t + p.phases[i].seconds - within), cycle: Math.floor(elapsed / cycle) };
    t += p.phases[i].seconds;
  }
  return { index: 0, left: p.phases[0].seconds, cycle: Math.floor(elapsed / cycle) };
}
