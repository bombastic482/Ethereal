/** Daily weigh-in log, stored locally. One entry per day; newest edits win. */
import type { WeighIn } from './calc/trend';
import { createStore } from './store';

export interface WeightLog {
  entries: WeighIn[];
}

export const logStore = createStore<WeightLog>('ethereal:log:v1', { entries: [] }, (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const entries = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return { entries: [] };
  const clean = entries.filter(
    (e): e is WeighIn =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as WeighIn).date === 'string' &&
      Number.isFinite((e as WeighIn).weightKg),
  );
  return { entries: clean };
});

export function upsertEntry(entry: WeighIn): WeightLog {
  const current = logStore.get();
  const others = current.entries.filter((e) => e.date !== entry.date);
  const next = { entries: [...others, entry].sort((a, b) => a.date.localeCompare(b.date)) };
  logStore.set(next);
  return next;
}

export function removeEntry(date: string): WeightLog {
  const next = { entries: logStore.get().entries.filter((e) => e.date !== date) };
  logStore.set(next);
  return next;
}
