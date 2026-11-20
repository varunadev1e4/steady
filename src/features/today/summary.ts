/**
 * The "gentle summary" line at the top of Today. Plain rules, no AI, and no
 * judgement: it states what's done and what's waiting.
 */
export interface TodayFacts {
  /** null when the check-in module is off */
  checkedIn: boolean | null;
  /** null when the habits module is off */
  habits: { due: number; done: number } | null;
  /** null when the workouts module is off */
  workout: 'done' | 'planned' | 'rest' | null;
  /** null when the tasks module is off */
  tasksDue: number | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function gentleSummary(f: TodayFacts): string {
  const parts: string[] = [];
  if (f.checkedIn === false) parts.push('check-in waiting');
  if (f.habits && f.habits.due > 0) {
    parts.push(
      f.habits.done >= f.habits.due
        ? `all ${plural(f.habits.due, 'habit')} done`
        : `${f.habits.done} of ${plural(f.habits.due, 'habit')} done`,
    );
  }
  if (f.workout === 'done') parts.push('workout done');
  else if (f.workout === 'planned') parts.push('no workout yet');
  else if (f.workout === 'rest') parts.push('rest day');
  if (f.tasksDue && f.tasksDue > 0) parts.push(`${plural(f.tasksDue, 'task')} due`);

  if (parts.length === 0) return 'A fresh day. Start wherever feels easiest.';
  const text = parts.join(', ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

/** True on the user's birthday (month and day match). */
export function isBirthdayToday(birthday: string | null, today: string): boolean {
  return Boolean(birthday && birthday.slice(5) === today.slice(5));
}
