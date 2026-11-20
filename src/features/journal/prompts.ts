import type { PromptCategory } from '@/types/database';
import { daysBetween } from '@/features/habits/streaks';
import type { ISODate } from '@/utils/dates';

export const PROMPT_CATEGORIES: Array<{ value: Exclude<PromptCategory, 'custom'>; label: string }> = [
  { value: 'gratitude', label: 'Gratitude' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'goals', label: 'Goals' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'body', label: 'Body and health' },
  { value: 'worries', label: 'Fears and worries' },
  { value: 'wins', label: 'Wins' },
  { value: 'tomorrow', label: 'Tomorrow' },
];

export const categoryLabel = (c: PromptCategory) =>
  c === 'custom' ? 'Your prompt' : (PROMPT_CATEGORIES.find((p) => p.value === c)?.label ?? c);

export interface Prompt {
  category: PromptCategory;
  text: string;
}

/** The built-in library (48 prompts). */
export const BUILT_IN_PROMPTS: Prompt[] = [
  // Gratitude
  { category: 'gratitude', text: 'What are three small things that went right today?' },
  { category: 'gratitude', text: 'Who made your life a little easier this week, and how?' },
  { category: 'gratitude', text: 'What is something you own that you are quietly glad to have?' },
  { category: 'gratitude', text: 'What did you notice today that you usually walk past?' },
  { category: 'gratitude', text: 'Which part of your body are you thankful for today?' },
  { category: 'gratitude', text: 'What is a memory that still makes you smile?' },
  // Reflection
  { category: 'reflection', text: 'What took up most of your attention today? Was it worth it?' },
  { category: 'reflection', text: 'When did you feel most like yourself this week?' },
  { category: 'reflection', text: 'What is something you changed your mind about recently?' },
  { category: 'reflection', text: 'What would you like to do less of? What would you like more of?' },
  { category: 'reflection', text: 'Describe today in five words, then explain one of them.' },
  { category: 'reflection', text: 'What is a pattern you keep noticing in yourself lately?' },
  // Goals
  { category: 'goals', text: 'What matters most to you this month, and why?' },
  { category: 'goals', text: 'What is one small step that would move something important forward?' },
  { category: 'goals', text: 'What would “good enough” look like for the goal you’re working on?' },
  { category: 'goals', text: 'What is getting in the way right now, and what could make it easier?' },
  { category: 'goals', text: 'A year from now, what do you hope you started today?' },
  { category: 'goals', text: 'Which habit is quietly helping you the most?' },
  // Relationships
  { category: 'relationships', text: 'Who do you miss, and what would you say to them?' },
  { category: 'relationships', text: 'Describe a recent conversation that stayed with you.' },
  { category: 'relationships', text: 'Who brings out the best in you? What do they do?' },
  { category: 'relationships', text: 'Is there something you’ve been meaning to tell someone?' },
  { category: 'relationships', text: 'How did you show care for someone this week?' },
  { category: 'relationships', text: 'What kind of friend do you want to be this year?' },
  // Body and health
  { category: 'body', text: 'How does your body feel right now, from head to toe?' },
  { category: 'body', text: 'What helped you sleep well, or kept you awake, recently?' },
  { category: 'body', text: 'What kind of movement felt good this week?' },
  { category: 'body', text: 'What does your energy usually look like across a day?' },
  { category: 'body', text: 'Which meal did you enjoy most this week, and why?' },
  { category: 'body', text: 'What is one kind thing you could do for your body tomorrow?' },
  // Fears and worries
  { category: 'worries', text: 'What is on your mind that you haven’t said out loud?' },
  { category: 'worries', text: 'What is the worry, and what is actually within your control?' },
  { category: 'worries', text: 'If a friend had this worry, what would you tell them?' },
  { category: 'worries', text: 'What is the most likely outcome, not the worst one?' },
  { category: 'worries', text: 'What has helped you get through a hard stretch before?' },
  { category: 'worries', text: 'What would you do differently if you were less afraid?' },
  // Wins
  { category: 'wins', text: 'What is something you handled well today?' },
  { category: 'wins', text: 'What progress did you make this week, however small?' },
  { category: 'wins', text: 'What did you do recently that past-you would be proud of?' },
  { category: 'wins', text: 'What is a skill you’ve slowly got better at?' },
  { category: 'wins', text: 'When did you keep a promise to yourself lately?' },
  { category: 'wins', text: 'What was harder than it looked, and you did it anyway?' },
  // Tomorrow
  { category: 'tomorrow', text: 'What is the one thing that would make tomorrow a good day?' },
  { category: 'tomorrow', text: 'What can you let go of before tomorrow starts?' },
  { category: 'tomorrow', text: 'What are you looking forward to tomorrow?' },
  { category: 'tomorrow', text: 'How do you want to feel at the end of tomorrow?' },
  { category: 'tomorrow', text: 'What could you prepare tonight to make the morning easier?' },
  { category: 'tomorrow', text: 'Who could you check in on tomorrow?' },
];

/** The same prompt all day, a different one each day. */
export function promptForDay(day: ISODate, prompts: Prompt[] = BUILT_IN_PROMPTS): Prompt {
  const n = daysBetween('2000-01-01', day);
  return prompts[((n % prompts.length) + prompts.length) % prompts.length];
}
