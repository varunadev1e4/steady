/**
 * Sleep timing. Bedtimes are measured on a clock that runs from noon to noon,
 * so 23:30 and 00:30 are an hour apart (not 23 hours).
 */

export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Minutes after noon (bedtime scale): 22:00 → 600, 01:00 → 780. */
export const bedMinutes = (t: string) => (toMinutes(t) + 12 * 60) % (24 * 60);

/** Hours between bedtime and wake time, across midnight. */
export function hoursBetween(bedtime: string, wake: string): number {
  let diff = toMinutes(wake) - toMinutes(bedtime);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 2) / 2; // nearest half hour, like the check-in stepper
}

function sd(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length));
}

export interface Regularity {
  /** Typical variation in minutes (standard deviation), or null with fewer than 3 nights. */
  bedtimeSpread: number | null;
  wakeSpread: number | null;
  avgBedtime: string | null;
  avgWake: string | null;
  label: 'very regular' | 'fairly regular' | 'irregular' | null;
}

const fmt = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function regularity(nights: Array<{ bedtime: string | null; wake_time: string | null }>): Regularity {
  const beds = nights.filter((n) => n.bedtime).map((n) => bedMinutes(n.bedtime!));
  const wakes = nights.filter((n) => n.wake_time).map((n) => toMinutes(n.wake_time!));
  const bedtimeSpread = sd(beds);
  const wakeSpread = sd(wakes);
  const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const ab = avg(beds);
  const aw = avg(wakes);
  const worst = Math.max(bedtimeSpread ?? -1, wakeSpread ?? -1);
  return {
    bedtimeSpread,
    wakeSpread,
    avgBedtime: ab == null ? null : fmt(ab + 12 * 60),
    avgWake: aw == null ? null : fmt(aw),
    label: worst < 0 ? null : worst <= 30 ? 'very regular' : worst <= 60 ? 'fairly regular' : 'irregular',
  };
}

export const SLEEP_TIPS = [
  'Keep the same wake-up time every day, including weekends. It anchors your body clock more than bedtime does.',
  'Get daylight in the morning, and dim screens and lights in the hour before bed.',
  'If you can’t sleep after about 20 minutes, get up and do something calm in low light, then go back when sleepy.',
  'Keep caffeine to the morning, and avoid heavy meals and alcohol close to bedtime.',
  'Most adults need 7–9 hours. If you often feel unrested despite enough time in bed, mention it to your doctor (snoring or pauses in breathing are worth checking).',
];
