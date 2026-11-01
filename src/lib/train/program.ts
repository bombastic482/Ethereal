/**
 * Builds the week's workouts from what you have and where you are, and moves you along as you
 * get stronger.
 *
 * Two full-body sessions alternate: A leans on pushing and legs, B on pulling, the back of the
 * body and core. Each movement slot climbs a ladder of exercises (wall push-up, incline, knees,
 * full push-up…). You start on the rung that fits, and when you hit the top of the rep range on
 * every set the next session offers the harder rung; when the first set falls short it offers
 * the easier one.
 *
 * Week one is deliberately light: two sets and fewer exercises. Plans that start at full volume
 * are the ones that never get started; the job of week one is only to show up.
 */
import { EXERCISES, exerciseById, type Equipment, type Exercise } from './exercises.ts';

export type Session = 'A' | 'B';

export interface TrainSetup {
  /** What you have beyond floor space. */
  equipment: Equipment[];
  /** Training days, 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  minutes: 20 | 30 | 45;
  /** 1 new to training, 2 some experience, 3 trains regularly. */
  level: 1 | 2 | 3;
  /** No jumping, no deep single-leg loading, flat walks only. */
  easyOnLegs: boolean;
  /** Monday-agnostic ISO date the plan started; week numbers count from here. */
  startedOn: string;
  /** Current rung per ladder, by ladder key. */
  rungs: Record<string, string>;
}

/** Each ladder runs from easiest to hardest. */
export const LADDERS: Record<string, string[]> = {
  push: [
    'wall-push-up',
    'incline-push-up',
    'knee-push-up',
    'push-up',
    'diamond-push-up',
    'decline-push-up',
  ],
  shoulders: ['prone-y-raise', 'pike-push-up'],
  squat: ['chair-squat', 'squat', 'split-squat', 'bulgarian-split-squat'],
  lunge: ['split-squat', 'reverse-lunge'],
  pull: ['towel-row', 'doorframe-row', 'table-row'],
  back: ['prone-y-raise', 'superman'],
  bridge: ['glute-bridge', 'single-leg-glute-bridge', 'hip-thrust'],
  hinge: ['good-morning', 'single-leg-rdl'],
  plank: ['knee-plank', 'plank', 'hollow-hold'],
  core: ['dead-bug', 'bird-dog', 'reverse-crunch'],
  cardio: ['march-in-place', 'mountain-climber', 'step-back-burpee'],
  arms: ['towel-curl'],
};

/** Starting rung per ladder for each level. */
const START: Record<1 | 2 | 3, Record<string, number>> = {
  1: {
    push: 1,
    shoulders: 0,
    squat: 0,
    lunge: 0,
    pull: 0,
    back: 0,
    bridge: 0,
    hinge: 0,
    plank: 0,
    core: 0,
    cardio: 0,
    arms: 0,
  },
  2: {
    push: 2,
    shoulders: 0,
    squat: 1,
    lunge: 0,
    pull: 1,
    back: 1,
    bridge: 0,
    hinge: 0,
    plank: 1,
    core: 1,
    cardio: 0,
    arms: 0,
  },
  3: {
    push: 3,
    shoulders: 1,
    squat: 2,
    lunge: 1,
    pull: 1,
    back: 1,
    bridge: 1,
    hinge: 1,
    plank: 1,
    core: 2,
    cardio: 1,
    arms: 0,
  },
};

/** Slots per session, most important first; shorter sessions use fewer. */
const SLOTS: Record<Session, string[]> = {
  A: ['push', 'squat', 'shoulders', 'plank', 'bridge', 'cardio'],
  B: ['pull', 'bridge', 'back', 'lunge', 'core', 'arms', 'hinge'],
};

const WARM_UP = ['arm-circles', 'cat-cow'];
const COOL_DOWN = ['hip-flexor-stretch', 'childs-pose'];

/** Not offered when going easy on the legs. */
const HARD_ON_LEGS = new Set([
  'bulgarian-split-squat',
  'step-back-burpee',
  'mountain-climber',
  'reverse-lunge',
]);

export const DEFAULT_WEEKDAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [6, 0, 1, 2, 3, 4],
};

export function defaultSetup(today: string, level: 1 | 2 | 3 = 1): TrainSetup {
  return {
    equipment: ['towel'],
    weekdays: DEFAULT_WEEKDAYS[3]!,
    minutes: 30,
    level,
    easyOnLegs: false,
    startedOn: today,
    rungs: startingRungs(level),
  };
}

export function startingRungs(level: 1 | 2 | 3): Record<string, string> {
  return Object.fromEntries(
    Object.entries(LADDERS).map(([key, ladder]) => [key, ladder[START[level][key] ?? 0]!]),
  );
}

export const usable = (e: Exercise, setup: Pick<TrainSetup, 'equipment' | 'easyOnLegs'>): boolean =>
  e.equipment.every((q) => q === 'none' || setup.equipment.includes(q)) &&
  !(setup.easyOnLegs && HARD_ON_LEGS.has(e.id));

/**
 * The exercise to do for a ladder: the current rung if you can do it with what you have, else
 * the nearest usable rung below it, else the nearest above.
 */
export function pick(ladder: string, setup: TrainSetup): Exercise | undefined {
  const rungs = LADDERS[ladder] ?? [];
  const at = Math.max(0, rungs.indexOf(setup.rungs[ladder] ?? rungs[0]!));
  const order = [...rungs.slice(0, at + 1).reverse(), ...rungs.slice(at + 1)];
  for (const id of order) {
    const e = exerciseById(id);
    if (e && usable(e, setup)) return e;
  }
  return undefined;
}

export interface Prescription {
  exercise: Exercise;
  ladder: string;
  sets: number;
  /** Reps per set, or seconds per hold. */
  low: number;
  high: number;
  restSec: number;
}

export interface Workout {
  session: Session;
  week: number;
  warmUp: Prescription[];
  main: Prescription[];
  coolDown: Prescription[];
  /** Walking after the session, in minutes, if a treadmill or space to walk is available. */
  walkMinutes: number;
  walkTip: string;
  estimatedMinutes: number;
}

const DAY = 864e5;
const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Week number since the plan started, from 1. */
export function weekOf(setup: TrainSetup, date: string): number {
  return Math.max(1, Math.floor((parse(date) - parse(setup.startedOn)) / (7 * DAY)) + 1);
}

/** Which session falls on a training day: alternating A and B through the plan. */
export function sessionOn(setup: TrainSetup, date: string): Session | null {
  const days = [...setup.weekdays].sort((a, b) => a - b);
  const weekday = new Date(parse(date)).getUTCDay();
  if (!days.includes(weekday)) return null;
  let count = 0;
  for (let t = parse(setup.startedOn); t < parse(date); t += DAY) {
    if (days.includes(new Date(t).getUTCDay())) count++;
  }
  return count % 2 === 0 ? 'A' : 'B';
}

export function prescribe(
  e: Exercise,
  ladder: string,
  sets: number,
  level: number,
  restSec: number,
): Prescription {
  if (e.unit === 'seconds') {
    const base = e.pattern === 'cardio' ? 30 : 20 + level * 5;
    return { exercise: e, ladder, sets, low: base, high: base + 15, restSec };
  }
  const [low, high] = e.level >= 4 ? [5, 10] : e.level >= 3 ? [6, 12] : [8, 15];
  return { exercise: e, ladder, sets, low, high, restSec };
}

/** The workout for one session in a given week. */
export function buildWorkout(setup: TrainSetup, session: Session, week: number): Workout {
  const starter = week === 1;
  const slotCount = setup.minutes === 20 ? 4 : setup.minutes === 30 ? 5 : 6;
  const count = starter ? Math.min(slotCount, 4) : slotCount;
  const sets = starter ? 2 : setup.minutes === 45 && week >= 3 ? 4 : 3;
  const rest = setup.minutes === 20 ? 45 : 60;
  const seen = new Set<string>();
  const main: Prescription[] = [];
  for (const ladder of SLOTS[session]) {
    if (main.length >= count) break;
    const e = pick(ladder, setup);
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    main.push(prescribe(e, ladder, sets, setup.level, rest));
  }
  const easy = (id: string, seconds: number): Prescription => ({
    exercise: exerciseById(id)!,
    ladder: 'mobility',
    sets: 1,
    low: seconds,
    high: seconds,
    restSec: 0,
  });
  const warmUp = WARM_UP.map((id) => easy(id, 45));
  const coolDown = COOL_DOWN.map((id) => easy(id, 40));
  const treadmill = setup.equipment.includes('treadmill');
  const walkMinutes = starter ? 15 : setup.minutes === 20 ? 15 : setup.minutes === 30 ? 20 : 30;
  const walkTip = treadmill
    ? setup.easyOnLegs
      ? 'Treadmill at an easy pace, about 4 km/h, incline 0.'
      : 'Treadmill around 4 km/h, incline 3 to 6. Talking should take a little effort.'
    : 'A brisk walk, indoors or out. Talking should take a little effort.';
  const work = main.reduce((sum, p) => {
    const perSet = p.exercise.unit === 'seconds' ? p.high : p.high * 3.5;
    const sides = p.exercise.perSide ? 2 : 1;
    return sum + p.sets * (perSet * sides + p.restSec);
  }, 0);
  const estimatedMinutes = Math.round((work + 45 * 2 + 40 * 2 + 60) / 60);
  return { session, week, warmUp, main, coolDown, walkMinutes, walkTip, estimatedMinutes };
}

/**
 * The nearest usable exercise one step harder or easier on the same ladder, if there is one.
 * Used for mid-workout swaps and for the end-of-session suggestions.
 */
export function neighbour(
  ladder: string,
  id: string,
  direction: 'harder' | 'easier',
  setup: Pick<TrainSetup, 'equipment' | 'easyOnLegs'>,
): Exercise | undefined {
  const rungs = LADDERS[ladder] ?? [];
  const i = rungs.indexOf(id);
  if (i < 0) return undefined;
  const step = direction === 'harder' ? 1 : -1;
  for (let j = i + step; j >= 0 && j < rungs.length; j += step) {
    const e = exerciseById(rungs[j]!);
    if (e && usable(e, setup)) return e;
  }
  return undefined;
}

export interface LoggedSet {
  exerciseId: string;
  /** Reps, or seconds for holds. */
  value: number;
}

export interface Suggestion {
  ladder: string;
  from: string;
  to: string;
  direction: 'harder' | 'easier';
}

/**
 * After a session: offer the harder rung when every set reached the top of the range, the easier
 * one when the first set fell short of the bottom.
 */
export function suggestions(
  workout: Workout,
  logged: LoggedSet[],
  setup: TrainSetup,
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const p of workout.main) {
    const sets = logged.filter((s) => s.exerciseId === p.exercise.id);
    if (sets.length === 0) continue;
    const direction =
      sets.length >= p.sets && sets.every((s) => s.value >= p.high)
        ? 'harder'
        : sets[0]!.value < p.low
          ? 'easier'
          : null;
    if (!direction) continue;
    const to = neighbour(p.ladder, p.exercise.id, direction, setup);
    if (to) out.push({ ladder: p.ladder, from: p.exercise.id, to: to.id, direction });
  }
  return out;
}

/** Calories for a session: strength time at the exercises' METs, net of rest, plus the walk. */
export function workoutKcal(
  workout: Workout,
  logged: LoggedSet[],
  weightKg: number,
  minutes: number,
): number {
  if (!(weightKg > 0) || !(minutes > 0)) return 0;
  const mets = logged.map((s) => exerciseById(s.exerciseId)?.met ?? 3.5);
  const met = mets.length ? mets.reduce((a, b) => a + b, 0) / mets.length : 3.5;
  return Math.round(((Math.max(0, met - 1) * 3.5 * weightKg) / 200) * minutes);
}

export const allExerciseIds = () => EXERCISES.map((e) => e.id);
