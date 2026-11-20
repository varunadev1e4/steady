import type { HabitColor, HabitFrequency, TargetTime } from '@/types/database';

/**
 * Habit ideas: small, specific, evidence-informed habits that suit someone
 * building health from the ground up. Each is added only when the user picks
 * it. Names include a cue where possible ("after a meal"), because habits tied
 * to an existing routine stick better.
 */
export type IdeaGroup = 'move' | 'eat' | 'sleep' | 'mind' | 'connect';

export interface HabitIdea {
  key: string;
  group: IdeaGroup;
  name: string;
  why: string;
  icon: string;
  color: HabitColor;
  frequency: HabitFrequency;
  times_per_week?: number;
  target_time: TargetTime;
  grace_enabled: boolean;
}

export const IDEA_GROUPS: Array<{ key: IdeaGroup; label: string }> = [
  { key: 'move', label: 'Move' },
  { key: 'eat', label: 'Eat' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'mind', label: 'Mind' },
  { key: 'connect', label: 'Connect and care' },
];

const daily = (
  key: string,
  group: IdeaGroup,
  name: string,
  why: string,
  icon: string,
  color: HabitColor,
  target_time: TargetTime = 'any',
): HabitIdea => ({ key, group, name, why, icon, color, frequency: 'daily', target_time, grace_enabled: true });

const weekly = (
  key: string,
  group: IdeaGroup,
  name: string,
  why: string,
  icon: string,
  color: HabitColor,
  times: number,
): HabitIdea => ({ key, group, name, why, icon, color, frequency: 'weekly', times_per_week: times, target_time: 'any', grace_enabled: true });

export const HABIT_IDEAS: HabitIdea[] = [
  // Move
  daily('walk-after-meal', 'move', 'Walk 10 minutes after a meal', 'A short walk after eating helps your body handle blood sugar, and every minute counts towards your weekly activity.', 'footprints', 'sage'),
  weekly('strength-2x', 'move', 'Strength session', 'Guidelines recommend muscle-strengthening on 2 days a week. It protects joints and helps blood sugar.', 'dumbbell', 'clay', 2),
  daily('morning-stretch', 'move', 'Stretch for 5 minutes in the morning', 'Keeps stiff joints moving and is an easy first win of the day.', 'sun', 'amber', 'morning'),
  // Eat
  daily('veg-two-meals', 'eat', 'Vegetables with lunch and dinner', 'Vegetables add fibre and volume, so meals fill you up for fewer calories.', 'leaf', 'sage'),
  daily('protein-each-meal', 'eat', 'Protein with every meal', 'Protein keeps you fuller for longer and helps protect muscle while losing weight.', 'apple', 'amber'),
  daily('no-sugary-drinks', 'eat', 'No sugary drinks today', 'Drinks with sugar add calories without filling you up. Swapping them is one of the simplest changes.', 'droplet', 'sky'),
  daily('water-with-meals', 'eat', 'A glass of water with each meal', 'An easy way to drink enough, anchored to something you already do.', 'droplet', 'sky'),
  daily('kitchen-closed', 'eat', 'Kitchen closed after dinner', 'A clear end to eating for the day makes late-night snacking less likely.', 'moon', 'plum', 'evening'),
  // Sleep
  daily('same-bedtime', 'sleep', 'In bed at the same time (±30 min)', 'Regular sleep timing supports sleep quality, energy, appetite and mood.', 'bed', 'plum', 'evening'),
  daily('screens-off', 'sleep', 'Screens off 30 minutes before bed', 'Less late-evening scrolling makes it easier to wind down and fall asleep.', 'phone-off', 'stone', 'evening'),
  daily('morning-light', 'sleep', '10 minutes of daylight in the morning', 'Morning light helps set your body clock, which helps you sleep at night.', 'sun', 'amber', 'morning'),
  // Mind
  daily('journal-line', 'mind', 'Write one line in my journal', 'A tiny daily reflection builds self-awareness. Steady’s journal makes it quick.', 'pen', 'clay', 'evening'),
  daily('gratitude', 'mind', 'Note three good things from today', 'Noticing what went well, however small, is linked to better mood over time.', 'heart', 'clay', 'evening'),
  daily('breathing', 'mind', '5 minutes of slow breathing', 'Slow breathing with a longer out-breath calms the stress response.', 'brain', 'sky'),
  daily('read', 'mind', 'Read 10 pages', 'A calm, screen-free habit that also helps you wind down.', 'book', 'sky', 'evening'),
  // Connect and care
  weekly('reach-out', 'connect', 'Message or call someone I care about', 'Staying in touch is one of the strongest supports for wellbeing.', 'heart', 'sage', 2),
  daily('medication', 'connect', 'Take my medication or vitamins', 'Only if you have something prescribed or recommended. Ticking it off avoids double doses.', 'pill', 'stone', 'morning'),
];

/** A balanced first set: one move, two eat, one sleep, one mind. */
export const STARTER_SET = ['walk-after-meal', 'veg-two-meals', 'no-sugary-drinks', 'same-bedtime', 'journal-line'];

export const ideaByKey = (key: string) => HABIT_IDEAS.find((i) => i.key === key);

export const sameHabitName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
