export type CravingTrigger = 'hungry' | 'stressed' | 'sad' | 'bored' | 'tired' | 'habit' | 'social' | 'other';
export type CravingOutcome = 'passed' | 'alternative' | 'ate_some' | 'ate_planned' | 'ate_more';

export const TRIGGERS: Array<{ value: CravingTrigger; label: string }> = [
  { value: 'hungry', label: 'Actually hungry' },
  { value: 'stressed', label: 'Stressed or anxious' },
  { value: 'sad', label: 'Low or sad' },
  { value: 'bored', label: 'Bored' },
  { value: 'tired', label: 'Tired' },
  { value: 'habit', label: 'Habit or routine' },
  { value: 'social', label: 'Social, food around' },
  { value: 'other', label: 'Something else' },
];

export const OUTCOMES: Array<{ value: CravingOutcome; label: string }> = [
  { value: 'passed', label: 'It passed' },
  { value: 'alternative', label: 'Did something else' },
  { value: 'ate_some', label: 'Had a small amount' },
  { value: 'ate_planned', label: 'Ate a proper meal or snack' },
  { value: 'ate_more', label: 'Ate more than I wanted' },
];

export const triggerLabel = (t: string) => TRIGGERS.find((x) => x.value === t)?.label ?? t;
export const outcomeLabel = (o: string) => OUTCOMES.find((x) => x.value === o)?.label ?? o;

/** Ideas for the waiting time, matched to the trigger. */
export const WAIT_IDEAS: Record<CravingTrigger, string> = {
  hungry: 'Real hunger is a good reason to eat. A proper meal or a protein-rich snack will help more than the craving food.',
  stressed: 'Try a few minutes of slow breathing, or step outside. Stress cravings usually fade in 10–20 minutes.',
  sad: 'Be kind to yourself. Message someone, or write a few lines in your journal while you wait.',
  bored: 'Change what you’re doing: a short walk, a chore, a song. Boredom cravings pass quickly once your attention moves.',
  tired: 'Tiredness often shows up as hunger. Water, a short rest, or an earlier night can help.',
  habit: 'Notice the cue (time, place, screen). Doing something different at that moment weakens the habit.',
  social: 'It’s fine to enjoy food with others. Decide how much you want before you start.',
  other: 'Have a glass of water and give it 10 minutes. Then decide calmly.',
};

type C = { trigger: string; logged_at: string; outcome: string | null };

/** Hour of day in a time zone → part of day. */
export function partOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function summarise(items: C[], hourOf: (iso: string) => number) {
  const count = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const withOutcome = items.filter((i) => i.outcome);
  const managed = withOutcome.filter((i) => i.outcome === 'passed' || i.outcome === 'alternative' || i.outcome === 'ate_some' || i.outcome === 'ate_planned').length;
  return {
    total: items.length,
    byTrigger: count(items.map((i) => i.trigger)),
    byTime: count(items.map((i) => partOfDay(hourOf(i.logged_at)))),
    /** Share of logged cravings handled the way you wanted, or null with no outcomes. */
    managedPercent: withOutcome.length ? Math.round((managed / withOutcome.length) * 100) : null,
  };
}
