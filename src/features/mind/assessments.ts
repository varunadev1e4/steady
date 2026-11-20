/**
 * PHQ-9 and GAD-7: standard, freely reproducible self-report questionnaires.
 * Developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and
 * colleagues, with an educational grant from Pfizer Inc. No permission
 * required to reproduce, translate, display or distribute.
 *
 * Scores describe symptom levels over the last two weeks. They are not a
 * diagnosis; they're most useful as a trend shared with a clinician.
 */

export type AssessmentKind = 'phq9' | 'gad7';

export const ANSWER_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
] as const;

export const DIFFICULTY_OPTIONS = [
  { value: 0, label: 'Not difficult at all' },
  { value: 1, label: 'Somewhat difficult' },
  { value: 2, label: 'Very difficult' },
  { value: 3, label: 'Extremely difficult' },
] as const;

export const PHQ9_ITEMS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself, or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed. Or the opposite: being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead, or of hurting yourself in some way',
];

export const GAD7_ITEMS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen',
];

export const ASSESSMENTS: Record<AssessmentKind, { name: string; about: string; items: string[]; max: number }> = {
  phq9: { name: 'PHQ-9 (mood)', about: 'Nine questions about low mood and depression symptoms.', items: PHQ9_ITEMS, max: 27 },
  gad7: { name: 'GAD-7 (anxiety)', about: 'Seven questions about anxiety and worry.', items: GAD7_ITEMS, max: 21 },
};

export const STEM = 'Over the last 2 weeks, how often have you been bothered by the following problems?';
export const DIFFICULTY_QUESTION =
  'If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?';

export const ATTRIBUTION =
  'PHQ-9 and GAD-7 were developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.';

/** The PHQ-9 question about self-harm (index 8). Any answer above 0 shows support straight away. */
export const PHQ9_SAFETY_ITEM = 8;

export function score(answers: number[]): number {
  return answers.reduce((s, a) => s + a, 0);
}

/** Standard severity bands. */
export function severity(kind: AssessmentKind, total: number): string {
  if (total <= 4) return 'Minimal';
  if (total <= 9) return 'Mild';
  if (total <= 14) return 'Moderate';
  if (kind === 'phq9') return total <= 19 ? 'Moderately severe' : 'Severe';
  return 'Severe';
}

export function needsSafetySupport(kind: AssessmentKind, answers: Array<number | null>): boolean {
  return kind === 'phq9' && (answers[PHQ9_SAFETY_ITEM] ?? 0) > 0;
}

/** Days since the last check of this kind, or null if never done. */
export const CHECK_INTERVAL_DAYS = 28;
