import { describe, expect, it } from 'vitest';
import { PATTERNS, cycleSeconds, phaseAt } from './patterns';

const calm = PATTERNS.find((p) => p.key === 'calm')!;
const box = PATTERNS.find((p) => p.key === 'box')!;

describe('breathing patterns', () => {
  it('calm is six breaths a minute, box is sixteen-second cycles', () => {
    expect(60 / cycleSeconds(calm)).toBe(6);
    expect(cycleSeconds(box)).toBe(16);
  });

  it('finds the current phase and seconds left', () => {
    expect(phaseAt(calm, 0)).toEqual({ index: 0, left: 4, cycle: 0 });
    expect(phaseAt(calm, 3.2)).toEqual({ index: 0, left: 1, cycle: 0 });
    expect(phaseAt(calm, 4)).toEqual({ index: 1, left: 6, cycle: 0 });
    expect(phaseAt(calm, 10)).toEqual({ index: 0, left: 4, cycle: 1 });
    expect(phaseAt(box, 9)).toMatchObject({ index: 2, left: 3 });
  });
});
