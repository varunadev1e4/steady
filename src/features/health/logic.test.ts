import { describe, expect, it } from 'vitest';
import { average, bpReference, fromDisplayGlucose, glucoseReference, heartRateReference, toDisplayGlucose } from './logic';

describe('blood pressure reference (2017 ACC/AHA)', () => {
  it('classifies by the higher of the two numbers', () => {
    expect(bpReference(115, 75).label).toMatch(/normal/);
    expect(bpReference(125, 78).label).toMatch(/elevated/);
    expect(bpReference(125, 82).label).toMatch(/stage 1/); // diastolic decides
    expect(bpReference(135, 70).label).toMatch(/stage 1/);
    expect(bpReference(142, 85).label).toMatch(/stage 2/);
    expect(bpReference(120, 95).label).toMatch(/stage 2/);
  });

  it('flags very high readings as urgent', () => {
    expect(bpReference(185, 100).level).toBe('urgent');
    expect(bpReference(160, 125).level).toBe('urgent');
    expect(bpReference(180, 120).level).toBe('notice'); // boundary is "above 180/120"
  });
});

describe('glucose reference (ADA)', () => {
  it('uses fasting thresholds 100 and 126', () => {
    expect(glucoseReference(92, 'fasting').level).toBe('info');
    expect(glucoseReference(100, 'fasting').label).toMatch(/prediabetes/);
    expect(glucoseReference(125, 'fasting').label).toMatch(/prediabetes/);
    expect(glucoseReference(126, 'fasting').label).toMatch(/diabetes range/);
  });

  it('does not apply fasting thresholds to other readings', () => {
    expect(glucoseReference(150, 'after_meal').level).toBe('info');
    expect(glucoseReference(210, 'random').level).toBe('notice');
    expect(glucoseReference(65, 'random').label).toMatch(/low/);
  });

  it('converts units both ways', () => {
    expect(toDisplayGlucose(100, 'mmol/L')).toBe(5.6);
    expect(toDisplayGlucose(99.6, 'mg/dL')).toBe(100);
    expect(fromDisplayGlucose(7, 'mmol/L')).toBe(126.1);
  });
});

describe('heart rate and averages', () => {
  it('describes resting heart rate', () => {
    expect(heartRateReference(72).level).toBe('info');
    expect(heartRateReference(105).level).toBe('notice');
  });

  it('averages ignoring empty values', () => {
    expect(average([120, null, 130, undefined])).toBe(125);
    expect(average([])).toBeNull();
  });
});
