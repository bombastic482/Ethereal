import type { FoodEntry } from './nutrition';
import { entryNutrients } from './nutrition';

/**
 * Chains with a counter (fast food, coffee shops) whose items appear in the database as
 * "Item (Chain)". Kept as a small list so the diary can spot takeaway without loading the food
 * database; a test checks it matches the chains the eating-out page is built from.
 */
export const CHAIN_NAMES: ReadonlySet<string> = new Set([
  'Burger King',
  'Chick-fil-A',
  'Chipotle',
  'Costa Coffee',
  "Domino's",
  "Dunkin'",
  'Five Guys',
  'Greggs',
  'KFC',
  "McDonald's",
  "Nando's",
  'Panera Bread',
  'Pizza Hut',
  'Pret A Manger',
  'Shake Shack',
  'Starbucks',
  'Subway',
  'Taco Bell',
  'Wagamama',
  "Wendy's",
]);

/** The chain an entry came from, read from the "(Chain)" suffix on its name, or null. */
export function chainOf(name: string): string | null {
  const m = /\(([^()]+)\)\s*$/.exec(name);
  return m && CHAIN_NAMES.has(m[1]!) ? m[1]! : null;
}

export interface ChainShare {
  /** Number of chain items logged in the window. */
  count: number;
  /** Calories from chain items. */
  kcal: number;
  /** Their share of all calories logged in the window, 0–1. */
  share: number;
  /** Distinct chains, most calories first. */
  chains: string[];
}

/** How much of the window's intake came from chains, over the given dates. */
export function chainShare(food: FoodEntry[], dates: string[]): ChainShare {
  const inWindow = new Set(dates);
  let total = 0;
  let kcal = 0;
  let count = 0;
  const byChain = new Map<string, number>();
  for (const e of food) {
    if (!inWindow.has(e.date)) continue;
    const k = entryNutrients(e).kcal;
    total += k;
    const c = chainOf(e.name);
    if (!c) continue;
    kcal += k;
    count += 1;
    byChain.set(c, (byChain.get(c) ?? 0) + k);
  }
  return {
    count,
    kcal: Math.round(kcal),
    share: total > 0 ? kcal / total : 0,
    chains: [...byChain.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c),
  };
}
