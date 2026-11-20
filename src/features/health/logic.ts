/**
 * Reference ranges for health readings. These are for orientation only and
 * use neutral wording: a single reading is never a diagnosis.
 *  - Blood pressure: 2017 ACC/AHA categories.
 *  - Fasting glucose: American Diabetes Association thresholds.
 */

export type GlucoseUnit = 'mg/dL' | 'mmol/L';
export type GlucoseContext = 'fasting' | 'after_meal' | 'random';

export const MG_PER_MMOL = 18.016;

export const toDisplayGlucose = (mgdl: number, unit: GlucoseUnit) =>
  unit === 'mg/dL' ? Math.round(mgdl) : Math.round((mgdl / MG_PER_MMOL) * 10) / 10;

export const fromDisplayGlucose = (value: number, unit: GlucoseUnit) =>
  unit === 'mg/dL' ? value : Math.round(value * MG_PER_MMOL * 10) / 10;

export interface Reference {
  label: string;
  /** 'info' is neutral; 'notice' suggests mentioning it to a doctor; 'urgent' means seek advice promptly. */
  level: 'info' | 'notice' | 'urgent';
}

export function bpReference(systolic: number, diastolic: number): Reference {
  if (systolic > 180 || diastolic > 120) {
    return { label: 'Very high. If it stays this high on a repeat reading, or you feel unwell, get medical advice promptly.', level: 'urgent' };
  }
  if (systolic >= 140 || diastolic >= 90) return { label: 'In the stage 2 high range', level: 'notice' };
  if (systolic >= 130 || diastolic >= 80) return { label: 'In the stage 1 high range', level: 'notice' };
  if (systolic >= 120) return { label: 'In the elevated range', level: 'info' };
  if (systolic < 90 || diastolic < 60) return { label: 'On the low side', level: 'info' };
  return { label: 'In the normal range', level: 'info' };
}

export function glucoseReference(mgdl: number, context: GlucoseContext): Reference {
  if (mgdl < 70) return { label: 'Below 70 mg/dL (3.9 mmol/L), which is low', level: 'notice' };
  if (context === 'fasting') {
    if (mgdl >= 126) return { label: 'In the diabetes range for a fasting reading', level: 'notice' };
    if (mgdl >= 100) return { label: 'In the prediabetes range for a fasting reading', level: 'notice' };
    return { label: 'In the typical fasting range', level: 'info' };
  }
  if (mgdl >= 200) return { label: 'High for a non-fasting reading', level: 'notice' };
  return { label: 'No fasting reference for this reading', level: 'info' };
}

export function heartRateReference(bpm: number): Reference {
  if (bpm < 50) return { label: 'Below the usual adult resting range (common in very fit people)', level: 'info' };
  if (bpm > 100) return { label: 'Above the usual adult resting range of 60–100', level: 'notice' };
  if (bpm < 60) return { label: 'Low end of the usual range', level: 'info' };
  return { label: 'In the usual adult resting range (60–100)', level: 'info' };
}

export function average(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => x != null && !Number.isNaN(Number(x))).map(Number);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export const HEALTH_SOURCES = [
  'Whelton PK, et al. 2017 ACC/AHA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults. Hypertension. 2018;71(6):e13–e115.',
  'American Diabetes Association. Standards of Care in Diabetes: Diagnosis and Classification of Diabetes.',
];
