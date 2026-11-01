/** Training setup and workout history, stored locally like the rest of your data. */
import { createStore } from '../store';
import type { LoggedSet, Session, TrainSetup } from './program';

export interface WorkoutLog {
  id: string;
  date: string;
  session: Session;
  week: number;
  /** Whole session, warm-up to cool-down, in minutes. */
  minutes: number;
  sets: LoggedSet[];
  kcal: number;
  /** How it felt, asked at the end: 1 easy, 2 about right, 3 hard. */
  feel?: 1 | 2 | 3;
}

/** A workout that was started and not yet finished, so it can be resumed. */
export interface InProgress {
  date: string;
  session: Session;
  week: number;
  /** Exercise ids by main-slot index, after any swaps made during the session. */
  main: string[];
  step: number;
  /** Logged value per step index (reps, or seconds held). */
  values: Record<number, number>;
  /** Active time so far, in ms, excluding pauses. */
  activeMs: number;
  /** The session's variant, so a resumed short or comeback session keeps its shape. */
  opts?: { short?: boolean; comeback?: boolean };
}

export interface TrainState {
  /** Null until the training setup has been done. */
  setup: TrainSetup | null;
  log: WorkoutLog[];
  /** Spoken cues and rest-timer beeps during workouts. */
  voice: boolean;
  sound: boolean;
  current: InProgress | null;
}

export const trainStore = createStore<TrainState>(
  'ethereal:train:v1',
  { setup: null, log: [], voice: false, sound: true, current: null },
  (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<TrainState>;
    return {
      setup: r.setup && typeof r.setup === 'object' ? r.setup : null,
      log: Array.isArray(r.log) ? r.log : [],
      voice: r.voice === true,
      sound: r.sound !== false,
      current: r.current && typeof r.current === 'object' ? r.current : null,
    };
  },
);
