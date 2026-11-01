/**
 * Turns a workout into the ordered steps the player walks through: warm-up moves, every working
 * set with a rest after it, the cool-down, then the walk. Kept apart from the player so the
 * sequencing can be tested without a browser.
 */
import { exerciseById } from './exercises.ts';
import {
  prescribe,
  type LoggedSet,
  type Prescription,
  type TrainSetup,
  type Workout,
} from './program.ts';
import type { WorkoutLog } from './store.ts';

export type WorkStep = { kind: 'work'; p: Prescription; slot: number; set: number };
export type Step =
  | { kind: 'warm' | 'cool'; p: Prescription; index: number; of: number }
  | WorkStep
  | { kind: 'rest'; sec: number; next: WorkStep | null }
  | { kind: 'walk'; minutes: number; tip: string };

/** Extra rest when the next set is a different exercise: time to set up. */
export const CHANGEOVER_SEC = 15;

export function buildSteps(w: Workout): Step[] {
  const steps: Step[] = [];
  w.warmUp.forEach((p, index) => steps.push({ kind: 'warm', p, index, of: w.warmUp.length }));
  const work: WorkStep[] = w.main.flatMap((p, slot) =>
    Array.from({ length: p.sets }, (_, set) => ({ kind: 'work' as const, p, slot, set })),
  );
  work.forEach((step, i) => {
    steps.push(step);
    const next = work[i + 1];
    if (next) {
      const sec = step.p.restSec + (next.slot === step.slot ? 0 : CHANGEOVER_SEC);
      steps.push({ kind: 'rest', sec, next });
    }
  });
  w.coolDown.forEach((p, index) => steps.push({ kind: 'cool', p, index, of: w.coolDown.length }));
  if (w.walkMinutes > 0) steps.push({ kind: 'walk', minutes: w.walkMinutes, tip: w.walkTip });
  return steps;
}

/** The workout with its main exercises replaced by the ones chosen during the session. */
export function withSwaps(w: Workout, main: readonly string[], setup: TrainSetup): Workout {
  return {
    ...w,
    main: w.main.map((p, i) => {
      const id = main[i];
      const e = id && id !== p.exercise.id ? exerciseById(id) : undefined;
      return e ? prescribe(e, p.ladder, p.sets, setup.level, p.restSec) : p;
    }),
  };
}

/** Logged working sets, in order, from the per-step values. */
export function loggedSets(steps: readonly Step[], values: Record<number, number>): LoggedSet[] {
  const out: LoggedSet[] = [];
  steps.forEach((s, i) => {
    const v = values[i];
    if (s.kind === 'work' && typeof v === 'number' && v > 0)
      out.push({ exerciseId: s.p.exercise.id, value: v });
  });
  return out;
}

/** What you did on an exercise the last time it was in a session: one value per set. */
export function lastPerformance(log: readonly WorkoutLog[], exerciseId: string): number[] | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const sets = log[i]!.sets.filter((s) => s.exerciseId === exerciseId).map((s) => s.value);
    if (sets.length) return sets;
  }
  return null;
}

/** A sensible starting value for a set: last time's number for that set, else mid-range. */
export function startValue(p: Prescription, set: number, last: number[] | null): number {
  const prev = last?.[set] ?? last?.[last.length - 1];
  if (prev && prev > 0) return Math.min(Math.max(prev, 1), p.high + 10);
  return Math.round((p.low + p.high) / 2);
}

/** Whole-week streak: consecutive weeks, ending this one or last, with at least one session. */
export function weekStreak(log: readonly WorkoutLog[], startedOn: string, today: string): number {
  const DAY = 864e5;
  const t0 = Date.parse(`${startedOn}T00:00:00Z`);
  const weekIdx = (d: string) => Math.floor((Date.parse(`${d}T00:00:00Z`) - t0) / (7 * DAY));
  const weeks = new Set(log.map((l) => weekIdx(l.date)));
  let w = weekIdx(today);
  if (!weeks.has(w)) w -= 1;
  let n = 0;
  while (w >= 0 && weeks.has(w)) {
    n++;
    w--;
  }
  return n;
}
