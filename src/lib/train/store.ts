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
}

export interface TrainState {
  /** Null until the training setup has been done. */
  setup: TrainSetup | null;
  log: WorkoutLog[];
  /** Spoken cues and rest-timer beeps during workouts. */
  voice: boolean;
  sound: boolean;
}

export const trainStore = createStore<TrainState>(
  'ethereal:train:v1',
  { setup: null, log: [], voice: false, sound: true },
  (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<TrainState>;
    return {
      setup: r.setup && typeof r.setup === 'object' ? r.setup : null,
      log: Array.isArray(r.log) ? r.log : [],
      voice: r.voice === true,
      sound: r.sound !== false,
    };
  },
);
