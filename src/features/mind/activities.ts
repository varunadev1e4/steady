/**
 * Behavioural activation: planning small, valued activities and noticing
 * how they affect mood. Ideas are grouped the usual way: things for
 * enjoyment, a sense of achievement, connection, movement and self-care.
 */
export type ActivityCategory = 'pleasure' | 'achievement' | 'connection' | 'movement' | 'self_care' | 'other';

export const CATEGORIES: Array<{ value: ActivityCategory; label: string }> = [
  { value: 'pleasure', label: 'Enjoyment' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'connection', label: 'Connection' },
  { value: 'movement', label: 'Movement' },
  { value: 'self_care', label: 'Self-care' },
  { value: 'other', label: 'Other' },
];

export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? 'Other';

export const ACTIVITY_IDEAS: Record<Exclude<ActivityCategory, 'other'>, string[]> = {
  pleasure: ['Listen to three favourite songs', 'Watch one episode of something light', 'Cook a dish I like', 'Sit outside with tea for 10 minutes', 'Read a few pages of a book', 'Do a small creative thing (draw, write, play music)'],
  achievement: ['Clear one small area (a desk, a shelf)', 'Do one task I’ve been putting off for 10 minutes', 'Pay a bill or sort one bit of admin', 'Learn something for 15 minutes', 'Plan tomorrow’s meals'],
  connection: ['Message a friend', 'Call a family member', 'Have a meal with someone', 'Say thank you to someone', 'Reply to a message I’ve been avoiding'],
  movement: ['10-minute walk outside', 'Gentle stretching for 5 minutes', 'Walk to a nearby shop instead of ordering', 'Dance to one song', 'Today’s plan session'],
  self_care: ['Shower and put on fresh clothes', 'Make a proper breakfast', 'Get to bed on time', '5 minutes of slow breathing', 'Tidy my bed', 'Step into daylight for 10 minutes'],
};

export interface ActivityLike {
  title: string;
  category: string;
  status: string;
  mood_before: number | null;
  mood_after: number | null;
}

export interface LiftStat {
  key: string;
  label: string;
  n: number;
  /** Average change in mood (after − before), or null with fewer than `min` ratings. */
  lift: number | null;
}

const rated = (a: ActivityLike) => a.status === 'done' && a.mood_before != null && a.mood_after != null;

/** Average mood change per category, only reported with at least `min` rated activities. */
export function liftByCategory(items: ActivityLike[], min = 3): LiftStat[] {
  return CATEGORIES.map((c) => {
    const r = items.filter((a) => rated(a) && a.category === c.value);
    const lift = r.length >= min ? Math.round((r.reduce((s, a) => s + (a.mood_after! - a.mood_before!), 0) / r.length) * 10) / 10 : null;
    return { key: c.value, label: c.label, n: r.length, lift };
  }).filter((s) => s.n > 0);
}

/** Activities that most reliably lifted mood (at least `min` ratings each). */
export function topActivities(items: ActivityLike[], min = 2, limit = 3): LiftStat[] {
  const groups = new Map<string, ActivityLike[]>();
  for (const a of items.filter(rated)) {
    const k = a.title.trim().toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  return [...groups.values()]
    .filter((g) => g.length >= min)
    .map((g) => ({ key: g[0].title.toLowerCase(), label: g[0].title, n: g.length, lift: Math.round((g.reduce((s, a) => s + (a.mood_after! - a.mood_before!), 0) / g.length) * 10) / 10 }))
    .filter((s) => (s.lift ?? 0) > 0)
    .sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0))
    .slice(0, limit);
}
