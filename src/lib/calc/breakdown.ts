/** Where the calories went: foods grouped by name over a set of days, largest first. */
import type { FoodEntry } from './nutrition';

export interface FoodShare {
  name: string;
  kcal: number;
  protein: number;
  /** Times logged across the period. */
  count: number;
  /** Share of all logged calories, 0–1. */
  share: number;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function topFoods(food: FoodEntry[], dates: string[], limit = 6): FoodShare[] {
  const set = new Set(dates);
  const by = new Map<string, FoodShare>();
  let total = 0;
  for (const e of food) {
    if (!set.has(e.date)) continue;
    const f = e.grams / 100;
    const kcal = e.per100g.kcal * f;
    total += kcal;
    const key = norm(e.name);
    const cur = by.get(key) ?? { name: e.name, kcal: 0, protein: 0, count: 0, share: 0 };
    cur.kcal += kcal;
    cur.protein += e.per100g.protein * f;
    cur.count += 1;
    by.set(key, cur);
  }
  if (total === 0) return [];
  return [...by.values()]
    .map((x) => ({
      ...x,
      kcal: Math.round(x.kcal),
      protein: Math.round(x.protein),
      share: x.kcal / total,
    }))
    .sort((a, b) => b.kcal - a.kcal)
    .slice(0, limit);
}

/** Share of calories eaten at or after `fromMinutes` (default 21:00) among entries with a time. */
export function lateShare(
  food: FoodEntry[],
  dates: string[],
  fromMinutes = 21 * 60,
): number | null {
  const set = new Set(dates);
  let timed = 0;
  let late = 0;
  for (const e of food) {
    if (!set.has(e.date) || e.time === undefined) continue;
    const kcal = (e.per100g.kcal * e.grams) / 100;
    timed += kcal;
    if (e.time >= fromMinutes) late += kcal;
  }
  return timed > 0 ? late / timed : null;
}
