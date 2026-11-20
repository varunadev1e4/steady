/**
 * Beginner plans: content and progressions.
 *
 * Written for adults starting from zero, including people living with
 * obesity: low-impact, joint-friendly, short sessions that build slowly.
 * The numbers follow published guidance (see SOURCES):
 *  - WHO 2020 / US 2018 guidelines: 150–300 min a week of moderate activity
 *    and muscle-strengthening on 2+ days; any amount is better than none,
 *    and short bouts count.
 *  - ACSM (Donnelly 2009): start at the low end and progress; ~150 min/week
 *    for health, more (~250+ min/week) helps most with weight management.
 *  - ACSM resistance training for novices (2009): 1–3 sets of 8–12 reps,
 *    2–3 non-consecutive days a week.
 *  - Intensity by feel: the talk test and a 0–10 effort scale (Borg CR10);
 *    brisk walking ≈ 100 steps a minute (CADENCE-Adults, 2019).
 */

export type PlanId = 'walk-12' | 'home-strength-8' | 'gentle-yoga-8';
export type PlanKind = 'walk' | 'strength' | 'yoga';

export interface Step {
  name: string;
  /** Timed step (seconds). */
  seconds?: number;
  /** Rep-based step, e.g. "2 × 8–10" or "10 each side". */
  reps?: string;
  /** How to do it, in order. */
  cues: string[];
  easier?: string;
  harder?: string;
}

export interface PlanWeek {
  week: number;
  sessions: number;
  /** Approximate minutes per session. */
  minutes: number;
  focus: string;
  steps: Step[];
}

export interface StrengthTarget {
  name: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
}

export interface Plan {
  id: PlanId;
  kind: PlanKind;
  title: string;
  short: string;
  summary: string;
  weeksTotal: number;
  defaultDays: number[];
  daysHint: string;
  howHard: string[];
  whyItWorks: string[];
  tips: string[];
  /** Cardio activity name used when logging (walk, yoga). */
  logActivity?: 'Walk' | 'Yoga';
  weeks: PlanWeek[];
}

/* -------------------------------------------------------------- walking -- */

const easy = (min: number): Step => ({
  name: 'Easy warm-up walk',
  seconds: min * 60,
  cues: ['Walk at a relaxed pace.', 'Let your arms swing naturally and breathe easily.'],
});
const cool = (min: number): Step => ({
  name: 'Easy cool-down walk',
  seconds: min * 60,
  cues: ['Slow back down to an easy pace.', 'Let your breathing settle before you stop.'],
});
const comfortable = (min: number): Step => ({
  name: 'Comfortable walk',
  seconds: min * 60,
  cues: ['A steady pace where you can still talk in full sentences.', 'Effort about 3 out of 10.'],
  easier: 'Slow down or stop for a minute whenever you need to. That still counts.',
});
const brisk = (min: number): Step => ({
  name: 'Brisk walk',
  seconds: min * 60,
  cues: [
    'Walk with purpose, as if you are a little late.',
    'You can talk, but not sing. Effort about 4 out of 10.',
    'Roughly 100 steps a minute if you count for 15 seconds (about 25 steps).',
    'Stand tall, look ahead, swing your arms.',
  ],
  easier: 'Ease back to a comfortable pace for a minute, then pick it up again.',
  harder: 'Choose a route with a gentle hill.',
});
const faster = (): Step => ({
  name: 'Faster minute',
  seconds: 60,
  cues: ['Pick up the pace so talking is harder (effort about 5–6 out of 10).', 'Still a walk, not a jog.'],
});

function walkWeek(week: number, minutes: number, focus: string, steps: Step[]): PlanWeek {
  return { week, sessions: 5, minutes, focus, steps };
}

const intervals = (rounds: number): Step[] =>
  Array.from({ length: rounds }, () => [faster(), brisk(2)]).flat();

export const WALKING: Plan = {
  id: 'walk-12',
  kind: 'walk',
  title: 'Walking: 10 to 45 minutes',
  short: 'Walking plan',
  summary:
    'Twelve weeks from a 10-minute easy walk to 45 minutes of brisk walking, five days a week. You reach the recommended 150 minutes a week by week 8.',
  weeksTotal: 12,
  defaultDays: [1, 2, 3, 4, 5],
  daysHint: 'Five days a week. Any five, and two short walks in one day count too.',
  howHard: [
    'Talk test: on easy and comfortable walks you can chat in full sentences; on brisk walks you can talk but not sing.',
    'On a 0–10 effort scale, easy is 2, comfortable 3, brisk 4. Faster minutes (week 9 on) are 5–6.',
    'You should finish feeling you could have done a little more.',
  ],
  whyItWorks: [
    'Walking is low-impact, needs no equipment and is the easiest activity to keep doing for years.',
    'The time goes up by only a few minutes a week, so your joints, feet and heart adapt together.',
    'Brisk walking (about 100 steps a minute) counts as moderate activity, which is what health guidelines measure.',
  ],
  tips: [
    'Supportive, cushioned shoes and comfortable socks help more than any gadget.',
    'Choose flat, even routes at first. A shopping centre or corridor works in bad weather.',
    'Sore feet or shins? Repeat the week rather than pushing on.',
    'Busy day? Two 10-minute walks are as good as one 20-minute walk.',
  ],
  logActivity: 'Walk',
  weeks: [
    walkWeek(1, 10, 'Just get out of the door. Easy pace the whole way.', [
      { ...comfortable(10), name: 'Easy walk', cues: ['Relaxed pace, as if window shopping.', 'You should be able to chat the whole time.'] },
    ]),
    walkWeek(2, 12, 'A little longer, still comfortable.', [easy(2), comfortable(8), cool(2)]),
    walkWeek(3, 15, 'Fifteen minutes: a real habit is forming.', [easy(3), comfortable(10), cool(2)]),
    walkWeek(4, 18, 'Your first brisk walking. Talk, but not sing.', [easy(3), brisk(13), cool(2)]),
    walkWeek(5, 20, 'Twenty minutes, mostly brisk.', [easy(3), brisk(15), cool(2)]),
    walkWeek(6, 25, 'A bigger step up. Repeat the week if it feels like too much.', [easy(3), brisk(20), cool(2)]),
    walkWeek(7, 28, 'Settling into longer walks.', [easy(3), brisk(23), cool(2)]),
    walkWeek(8, 30, '30 minutes, 5 days: 150 minutes a week. That meets the guidelines.', [easy(3), brisk(25), cool(2)]),
    walkWeek(9, 30, 'Add a few faster minutes to build fitness.', [easy(3), brisk(5), ...intervals(4), brisk(8), cool(2)]),
    walkWeek(10, 35, 'Building towards the amount that helps most with weight.', [easy(3), brisk(30), cool(2)]),
    walkWeek(11, 40, 'Forty minutes. Mix in faster minutes if you like.', [easy(3), brisk(10), ...intervals(5), brisk(10), cool(2)]),
    walkWeek(12, 45, '45 minutes, 5 days: about 225 minutes a week. Keep this up for good.', [easy(3), brisk(40), cool(2)]),
  ],
};

/* ------------------------------------------------------------- strength -- */

const warmUp: Step[] = [
  {
    name: 'Marching on the spot',
    seconds: 120,
    cues: ['March in place, lifting your knees to a comfortable height.', 'Swing your arms. Hold a counter if you need balance.'],
  },
  { name: 'Arm circles', seconds: 40, cues: ['Arms out to the sides, small circles forwards for 20 seconds, then backwards.'] },
  {
    name: 'Practice sit-to-stands',
    reps: '5 easy',
    cues: ['Stand up from a chair and sit back down slowly, using your hands if you like.'],
  },
];

const coolDown: Step[] = [
  {
    name: 'Calf stretch at a wall',
    seconds: 60,
    cues: ['Hands on the wall, one foot back with the heel down and the leg straight.', 'Lean in until you feel the back of the lower leg. 30 seconds each side.'],
  },
  {
    name: 'Front-of-thigh stretch',
    seconds: 60,
    cues: ['Hold a chair for balance. Bend one knee and hold your ankle (or a towel looped round it).', 'Knees together, stand tall. 30 seconds each side.'],
    easier: 'Do it lying on your side on a bed instead.',
  },
  {
    name: 'Chest stretch in a doorway',
    seconds: 30,
    cues: ['Forearms on the door frame at shoulder height, step one foot through until you feel the chest open.'],
  },
  {
    name: 'Seated hamstring stretch',
    seconds: 60,
    cues: ['Sit on the edge of a chair, one leg straight with the heel on the floor.', 'Lean forward from the hips with a straight back. 30 seconds each side.'],
  },
];

const EX = {
  sitToStand: {
    name: 'Chair sit-to-stand',
    cues: [
      'Sit on the front half of a sturdy chair (no wheels), feet flat and hip-width apart.',
      'Lean forward slightly and push through your heels to stand up tall.',
      'Lower yourself slowly, counting to two, until you touch the seat.',
    ],
    easier: 'Push off your thighs or the armrests, or add a firm cushion to raise the seat.',
    harder: 'Arms crossed, and take 3 seconds to sit down.',
  },
  wallPushUp: {
    name: 'Wall push-up',
    cues: [
      'Stand an arm’s length from a wall, hands on it at shoulder height, a little wider than your shoulders.',
      'Keep your body straight from head to heels and bend your elbows to bring your chest towards the wall.',
      'Push back to the start. Breathe out as you push.',
    ],
    easier: 'Stand closer to the wall.',
    harder: 'Step your feet further back.',
  },
  counterPushUp: {
    name: 'Counter push-up',
    cues: [
      'Hands on the edge of a kitchen counter or sturdy table, shoulder-width apart.',
      'Walk your feet back until your body is a straight line.',
      'Lower your chest towards the edge, then push away.',
    ],
    easier: 'Go back to the wall, or step your feet closer.',
    harder: 'Use a lower, stable surface such as a sturdy bench.',
  },
  bridge: {
    name: 'Glute bridge',
    cues: [
      'Lie on your back on a mat or your bed, knees bent, feet flat and hip-width apart.',
      'Squeeze your buttocks and lift your hips until your body is straight from shoulders to knees.',
      'Pause for a moment, then lower slowly.',
    ],
    easier: 'Lift only part of the way.',
    harder: 'Hold for 3 seconds at the top of each rep.',
  },
  backpackRow: {
    name: 'Backpack row',
    cues: [
      'Put a few books or water bottles in a backpack.',
      'Hold a chair back with one hand and lean forward from the hips, back flat. Let the bag hang in your other hand.',
      'Pull the bag towards your hip, elbow close to your side, and squeeze your shoulder blade. Lower slowly.',
      'Do all reps on one side, then the other.',
    ],
    easier: 'Use a lighter bag.',
    harder: 'Add a bottle or book each week.',
  },
  calfRaise: {
    name: 'Calf raise at the counter',
    cues: ['Hold a counter lightly. Rise up onto the balls of your feet, then lower slowly.'],
    harder: 'Pause for 2 seconds at the top.',
  },
  wallPlank: {
    name: 'Wall plank (reps = seconds)',
    cues: [
      'Forearms on a wall at shoulder height, then step back so your body leans in a straight line.',
      'Tighten your stomach as if bracing for a cough and keep breathing.',
      'Log the seconds you held as “reps”.',
    ],
    easier: 'Stand closer to the wall.',
    harder: 'Step further back.',
  },
  stepUp: {
    name: 'Step-up on the bottom stair',
    cues: [
      'Hold the rail. Step up with one foot onto the bottom stair.',
      'Press through that heel to bring the other foot up, then step down with the same foot first.',
      'Do all reps leading with one leg, then the other.',
    ],
    easier: 'Use a lower step, or hold the rail with both hands.',
    harder: 'Slow down on the way down.',
  },
  inclinePlank: {
    name: 'Incline plank (reps = seconds)',
    cues: [
      'Hands on a counter or the arm of a sturdy sofa, arms straight.',
      'Walk your feet back until your body is a straight line. Brace and breathe.',
      'Log the seconds you held as “reps”.',
    ],
    easier: 'Go back to the wall plank.',
  },
} as const;

/** Every exercise the plan uses, added to the user's library when it starts. */
export const STRENGTH_LIBRARY = [
  { name: EX.sitToStand.name, muscle_group: 'legs', equipment: 'bodyweight' },
  { name: EX.wallPushUp.name, muscle_group: 'chest', equipment: 'bodyweight' },
  { name: EX.counterPushUp.name, muscle_group: 'chest', equipment: 'bodyweight' },
  { name: EX.bridge.name, muscle_group: 'glutes', equipment: 'bodyweight' },
  { name: EX.backpackRow.name, muscle_group: 'back', equipment: 'other' },
  { name: EX.calfRaise.name, muscle_group: 'legs', equipment: 'bodyweight' },
  { name: EX.wallPlank.name, muscle_group: 'core', equipment: 'bodyweight' },
  { name: EX.stepUp.name, muscle_group: 'legs', equipment: 'bodyweight' },
  { name: EX.inclinePlank.name, muscle_group: 'core', equipment: 'bodyweight' },
] as const;

interface Phase {
  weeks: number[];
  focus: string;
  targets: StrengthTarget[];
}

const t = (name: string, sets: number, min: number, max: number): StrengthTarget => ({ name, target_sets: sets, rep_min: min, rep_max: max });

/** Four two-week phases; the template's targets are updated phase by phase. */
export const STRENGTH_PHASES: Phase[] = [
  {
    weeks: [1, 2],
    focus: 'Learn the movements. 2 sets each, stopping with 2–3 reps still in the tank.',
    targets: [
      t(EX.sitToStand.name, 2, 8, 10),
      t(EX.wallPushUp.name, 2, 8, 10),
      t(EX.bridge.name, 2, 8, 10),
      t(EX.backpackRow.name, 2, 8, 10),
      t(EX.calfRaise.name, 2, 10, 12),
      t(EX.wallPlank.name, 2, 15, 20),
    ],
  },
  {
    weeks: [3, 4],
    focus: 'Same moves, a few more reps.',
    targets: [
      t(EX.sitToStand.name, 2, 10, 12),
      t(EX.wallPushUp.name, 2, 10, 12),
      t(EX.bridge.name, 2, 10, 12),
      t(EX.backpackRow.name, 2, 10, 12),
      t(EX.calfRaise.name, 2, 12, 15),
      t(EX.wallPlank.name, 2, 20, 30),
    ],
  },
  {
    weeks: [5, 6],
    focus: 'A third set and harder versions: counter push-ups, step-ups and an incline plank.',
    targets: [
      t(EX.sitToStand.name, 3, 10, 12),
      t(EX.counterPushUp.name, 3, 8, 10),
      t(EX.bridge.name, 3, 12, 15),
      t(EX.backpackRow.name, 3, 10, 12),
      t(EX.stepUp.name, 3, 8, 10),
      t(EX.inclinePlank.name, 3, 20, 30),
    ],
  },
  {
    weeks: [7, 8],
    focus: 'Build on it: more reps, slower lowering, a slightly heavier bag.',
    targets: [
      t(EX.sitToStand.name, 3, 12, 15),
      t(EX.counterPushUp.name, 3, 10, 12),
      t(EX.bridge.name, 3, 12, 15),
      t(EX.backpackRow.name, 3, 12, 15),
      t(EX.stepUp.name, 3, 10, 12),
      t(EX.inclinePlank.name, 3, 30, 40),
    ],
  },
];

const exStep = (target: StrengthTarget): Step => {
  const ex = Object.values(EX).find((e) => e.name === target.name)!;
  const perSide = ex === EX.backpackRow || ex === EX.stepUp ? ' each side' : '';
  const unit = target.name.includes('reps = seconds') ? ' seconds' : '';
  return {
    name: ex.name.replace(' (reps = seconds)', ''),
    reps: `${target.target_sets} × ${target.rep_min}–${target.rep_max}${unit}${perSide}`,
    cues: [...ex.cues, 'Rest 60–90 seconds between sets.'],
    easier: 'easier' in ex ? ex.easier : undefined,
    harder: 'harder' in ex ? ex.harder : undefined,
  };
};

export const phaseForWeek = (week: number): Phase =>
  STRENGTH_PHASES.find((p) => p.weeks.includes(week)) ?? STRENGTH_PHASES[STRENGTH_PHASES.length - 1];

export const STRENGTH: Plan = {
  id: 'home-strength-8',
  kind: 'strength',
  title: 'Home strength: no equipment',
  short: 'Strength plan',
  summary:
    'Eight weeks of joint-friendly bodyweight exercises at home, 2 days a week (3 if you feel good). About 20–30 minutes with a chair, a wall and a backpack.',
  weeksTotal: 8,
  defaultDays: [2, 5],
  daysHint: 'Two days a week with at least one rest day between (for example Tuesday and Friday).',
  howHard: [
    'Finish each set feeling you could do 2–3 more good reps. That is enough to get stronger.',
    'Effort about 5–6 out of 10. Breathe out as you push or stand up; never hold your breath.',
    'Mild muscle soreness for a day or two is normal after a new exercise. Sharp or joint pain is not: stop that movement.',
  ],
  whyItWorks: [
    'Guidelines recommend muscle-strengthening on at least 2 days a week. It protects joints, helps blood sugar and keeps everyday tasks easy.',
    'Every move is done standing, against a wall or on a bed or mat, with nothing jumping or kneeling, which is kinder to knees and backs.',
    'Reps and sets go up every two weeks, and harder versions arrive only after the basics feel solid.',
  ],
  tips: [
    'Starting the plan creates a “Home strength” workout template. Log your sets in the workout logger; it remembers last time’s numbers.',
    'When a phase changes, tap “Use these targets” so your template matches.',
    'Quality first: slow, controlled reps beat fast ones.',
    'Keep a 5-minute warm-up and cool-down every time.',
  ],
  weeks: Array.from({ length: 8 }, (_, i) => {
    const week = i + 1;
    const phase = phaseForWeek(week);
    return {
      week,
      sessions: 2,
      minutes: week <= 4 ? 20 : 30,
      focus: phase.focus,
      steps: [...warmUp, ...phase.targets.map(exStep), ...coolDown],
    };
  }),
};

/* ----------------------------------------------------------------- yoga -- */

const s = (name: string, seconds: number, cues: string[], easier?: string, harder?: string): Step => ({
  name,
  seconds,
  cues,
  easier,
  harder,
});

const breathing = s('Belly breathing (seated)', 120, [
  'Sit tall on a chair, feet flat, one hand on your belly.',
  'Breathe in through your nose so your belly rises, then breathe out slowly, a little longer than the in-breath.',
]);
const neck = s('Neck release', 60, ['Seated. Tilt your right ear towards your right shoulder and hold 30 seconds, then the left side.', 'Keep your shoulders relaxed and down.']);
const shoulders = s('Shoulder rolls', 30, ['Roll your shoulders up, back and down, slowly.']);
const seatedCatCow = s('Seated cat–cow', 60, [
  'Hands on your knees. Breathing in, lift your chest and gently arch your back.',
  'Breathing out, round your back and drop your chin. Move slowly with your breath.',
]);
const sideStretch = s('Seated side stretch', 60, ['Reach one arm overhead and lean gently to the other side. 30 seconds each side.', 'Keep both sit bones on the chair.']);
const seatedTwist = s('Seated twist', 60, ['Sit tall, place one hand on the opposite knee and turn gently to look behind you. 30 seconds each side.', 'Twist from the middle of your back, not your neck.']);
const mountain = s('Mountain pose', 60, ['Stand tall, feet hip-width, weight even. Arms by your sides.', 'Lengthen through the top of your head and breathe slowly.'], 'Keep a chair beside you to touch for balance.');
const chairFold = s('Half forward fold at a chair', 60, [
  'Stand facing the back of a chair, hands on top of it.',
  'Walk your feet back and hinge from your hips until your back is flat, like a table. Soften your knees.',
], 'Bend your knees more.');
const calf = s('Calf stretch at a wall', 60, ['Hands on the wall, one foot back with heel down. 30 seconds each side.']);
const warrior2Chair = s('Warrior II with a chair', 60, [
  'Stand with your feet wide, right toes turned out, a chair by your right leg for support.',
  'Bend your right knee over your ankle (only as far as is comfortable) and reach your arms out. 30 seconds each side.',
], 'Keep the bend small and one hand on the chair.');
const restSeated = s('Rest (relaxation)', 180, [
  'Lie on your back with a pillow under your knees, or sit back in your chair.',
  'Close your eyes, let your whole body be heavy and breathe normally.',
]);
const catCow = s('Cat–cow on hands and knees', 60, [
  'Hands under shoulders, knees under hips, with a folded blanket under your knees.',
  'Breathing in, let your belly sink and look forward. Breathing out, round your back.',
], 'Do the seated version instead.');
const child = s("Child's pose (wide knees)", 60, [
  'From hands and knees, bring your big toes together, knees wide, and sit back towards your heels.',
  'Rest your forehead on a pillow or your stacked hands.',
], 'Put a pillow between your heels and buttocks.');
const lowLunge = s('Low lunge with a chair', 60, [
  'Hands on a chair seat, step one foot forward and the other back, back knee down on a cushion.',
  'Shift your hips gently forward to stretch the front of the back hip. 30 seconds each side.',
], 'Keep the back knee lifted and the stance shorter.');
const tree = (sec: number) =>
  s('Tree pose at a wall', sec, [
    'Stand side-on to a wall with one hand on it. Rest the sole of your other foot on your ankle or calf (never on the knee).',
    `Hold ${sec / 2} seconds each side, eyes on one spot.`,
  ], 'Keep your toes on the floor (kickstand).');
const bridgePose = s('Bridge pose', 60, ['Lie on your back, knees bent. Lift your hips slowly as you breathe in, lower as you breathe out. 5 slow rounds.']);
const figure4 = (sec: number) =>
  s('Reclined figure-4 stretch', sec, ['Lying on your back, cross one ankle over the opposite knee.', `Gently draw the legs towards you until you feel the outer hip. ${sec / 2} seconds each side.`], 'Keep the bottom foot on the floor.');
const sunSalChair = s('Chair sun salutation (×3)', 180, [
  'Seated: breathe in, sweep your arms overhead.',
  'Breathe out, fold forward over your thighs.',
  'Breathe in, rise halfway with a flat back. Breathe out, fold.',
  'Breathe in, sweep up to sitting tall, arms overhead. Breathe out, hands to heart. Repeat 3 times.',
]);
const warrior1 = s('Warrior I with a chair', 60, ['Step one foot back, back heel down and turned out. Bend the front knee gently, hands on hips or a chair. 30 seconds each side.']);
const warrior2 = s('Warrior II', 90, ['Feet wide, front knee bent over the ankle, arms long, gaze over the front hand. 45 seconds each side.'], 'Use a chair under the front thigh.');
const triangle = s('Triangle with a chair', 60, ['Feet wide, front toes out. Reach forward, then rest your front hand on a chair seat and lift the other arm. 30 seconds each side.']);
const wallDog = s('Downward dog at the wall', 60, ['Hands on the wall at hip height, walk back and hinge until your arms and back form a long line. Soft knees.']);
const reclinedTwist = s('Reclined twist', 90, ['On your back, knees bent, let both knees drop to one side with a pillow underneath. 45 seconds each side.']);
const restLong = { ...restSeated, seconds: 300 };

const YOGA_PHASES: Array<{ weeks: number[]; minutes: number; focus: string; steps: Step[] }> = [
  {
    weeks: [1, 2],
    minutes: 15,
    focus: 'Mostly seated and standing at a chair. Learn to move with your breath.',
    steps: [breathing, neck, shoulders, seatedCatCow, sideStretch, seatedTwist, mountain, chairFold, calf, warrior2Chair, restSeated],
  },
  {
    weeks: [3, 4, 5],
    minutes: 18,
    focus: 'Add gentle floor poses with padding and support.',
    steps: [breathing, neck, seatedCatCow, sideStretch, seatedTwist, mountain, chairFold, catCow, child, lowLunge, tree(60), bridgePose, figure4(60), restSeated],
  },
  {
    weeks: [6, 7, 8],
    minutes: 25,
    focus: 'A flowing practice: chair sun salutations and standing poses.',
    steps: [breathing, seatedCatCow, sideStretch, seatedTwist, sunSalChair, mountain, warrior1, warrior2, triangle, wallDog, tree(90), child, bridgePose, reclinedTwist, figure4(90), restLong],
  },
];

export const YOGA: Plan = {
  id: 'gentle-yoga-8',
  kind: 'yoga',
  title: 'Gentle yoga: chair-supported',
  short: 'Yoga plan',
  summary:
    'Eight weeks of gentle, supported yoga for flexibility, balance and calm, 3 days a week. Sessions grow from 15 to 25 minutes, starting in a chair.',
  weeksTotal: 8,
  defaultDays: [1, 3, 6],
  daysHint: 'Three days a week. It also makes a good rest-day activity alongside walking.',
  howHard: [
    'Move into each stretch only until you feel a mild pull, never pain.',
    'Keep breathing slowly through your nose. If you can’t, ease off.',
    'Use props freely: a chair, a wall, pillows and a folded blanket under your knees.',
  ],
  whyItWorks: [
    'Gentle yoga improves flexibility, balance and how you feel, and helps with stress and sleep.',
    'Starting seated and at a chair makes every pose accessible from day one, whatever your size or stiffness.',
    'Yoga is a helpful partner to walking and strength work; on its own it isn’t a substitute for moderate activity.',
  ],
  tips: [
    'Practise on a non-slip surface with a sturdy chair (no wheels) and a wall nearby.',
    'Avoid hot yoga while you’re starting out.',
    'If getting down to the floor is hard, do the floor poses on your bed.',
    'Choose a quiet time; the end-of-session rest is part of the practice.',
  ],
  logActivity: 'Yoga',
  weeks: Array.from({ length: 8 }, (_, i) => {
    const week = i + 1;
    const phase = YOGA_PHASES.find((p) => p.weeks.includes(week))!;
    return { week, sessions: 3, minutes: phase.minutes, focus: phase.focus, steps: phase.steps };
  }),
};

export const PLANS: Plan[] = [WALKING, STRENGTH, YOGA];
export const planById = (id: string): Plan | undefined => PLANS.find((p) => p.id === id);

/* ---------------------------------------------------------- shared text -- */

export const BEFORE_YOU_START = {
  checkFirst: [
    'chest pain, pressure or tightness, at rest or when active',
    'dizziness or fainting',
    'a known heart, lung or kidney condition',
    'diabetes or high blood pressure, especially if you take medication for it',
    'joint pain, a recent injury or surgery',
    'been told by a doctor to limit activity',
  ],
  stopSigns: [
    'chest pain or pressure',
    'breathlessness that doesn’t settle when you slow down',
    'feeling faint or dizzy',
    'a racing or irregular heartbeat',
    'sharp or joint pain',
  ],
  reassurance: [
    'Starting with light-to-moderate activity is safe for most people without symptoms, at any size.',
    'Mild muscle soreness for 1–3 days after something new is normal and fades as you adapt.',
    'Activity improves blood pressure, blood sugar, mood, sleep and fitness even before, or without, weight loss. For weight loss, food matters most; for keeping weight off, regular activity of around 250 minutes a week or more helps most.',
  ],
};

export const SUGGESTED_WEEK = [
  { day: 'Mon', plan: 'Walk' },
  { day: 'Tue', plan: 'Walk + Strength' },
  { day: 'Wed', plan: 'Walk' },
  { day: 'Thu', plan: 'Walk + Yoga' },
  { day: 'Fri', plan: 'Walk + Strength' },
  { day: 'Sat', plan: 'Yoga or rest' },
  { day: 'Sun', plan: 'Rest' },
];

export const SOURCES = [
  'World Health Organization. WHO guidelines on physical activity and sedentary behaviour. Geneva: WHO; 2020.',
  'U.S. Department of Health and Human Services. Physical Activity Guidelines for Americans, 2nd edition. 2018.',
  'Donnelly JE, et al. ACSM Position Stand: Appropriate physical activity intervention strategies for weight loss and prevention of weight regain for adults. Med Sci Sports Exerc. 2009;41(2):459–471.',
  'American College of Sports Medicine. Position Stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc. 2009;41(3):687–708.',
  'Riebe D, et al. Updating ACSM’s recommendations for exercise preparticipation health screening. Med Sci Sports Exerc. 2015;47(11):2473–2479.',
  'Tudor-Locke C, et al. Walking cadence (steps/min) and intensity in 21–40 year olds: CADENCE-adults. Int J Behav Nutr Phys Act. 2019;16:8.',
  'Borg GA. Psychophysical bases of perceived exertion. Med Sci Sports Exerc. 1982;14(5):377–381.',
  'Lauche R, et al. A systematic review and meta-analysis on the effects of yoga on weight-related outcomes. Prev Med. 2016;87:213–232.',
  'Cramer H, Ostermann T, Dobos G. Injuries and other adverse events associated with yoga practice: a systematic review of epidemiological studies. J Sci Med Sport. 2018;21(2):147–154.',
];
