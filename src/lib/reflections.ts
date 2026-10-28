/** Weekly review reflections, stored locally and keyed by the week's end date. */
import { createStore } from './store';

export interface Reflections {
  /** Keyed by the week's end date (YYYY-MM-DD). */
  notes: Record<string, { wentWell: string; change: string; savedOn: string }>;
}

export const reflectionStore = createStore<Reflections>('ethereal:reflections:v1', { notes: {} });
