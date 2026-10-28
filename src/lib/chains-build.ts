/**
 * Build-time view of chain and brand items in the database for the eating-out page: grouped by
 * the "(Brand)" suffix, with per-serving numbers and a protein-per-100-kcal score.
 */
import foodsE from '@/data/foods-e.json';
import type { Food } from './foods';

export interface ChainItem {
  id: string;
  /** Name without the brand suffix. */
  name: string;
  servingLabel: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Grams of protein per 100 kcal: the leanest choices score highest. */
  proteinPer100: number;
}

export interface Chain {
  name: string;
  slug: string;
  items: ChainItem[];
}

const CHAIN_CATEGORIES = new Set(['Fast food & takeaway']);

export const chains: Chain[] = (() => {
  const by = new Map<string, ChainItem[]>();
  for (const f of foodsE as Food[]) {
    if (!CHAIN_CATEGORIES.has(f.category)) continue;
    const m = /^(.*)\s\(([^)]+)\)\s*$/.exec(f.name);
    const s = f.servings[0];
    if (!m || !s) continue;
    const k = s.grams / 100;
    const kcal = Math.round(f.per100g.kcal * k);
    const item: ChainItem = {
      id: f.id,
      name: m[1]!,
      servingLabel: s.label,
      grams: s.grams,
      kcal,
      protein: Math.round(f.per100g.protein * k),
      carbs: Math.round(f.per100g.carbs * k),
      fat: Math.round(f.per100g.fat * k),
      proteinPer100: kcal > 0 ? Math.round(((f.per100g.protein * k) / kcal) * 1000) / 10 : 0,
    };
    const list = by.get(m[2]!) ?? [];
    list.push(item);
    by.set(m[2]!, list);
  }
  return [...by.entries()]
    .filter(([, items]) => items.length >= 4)
    .map(([name, items]) => ({
      name,
      slug: name
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      items: items.sort((a, b) => b.proteinPer100 - a.proteinPer100),
    }))
    .sort((a, b) => b.items.length - a.items.length);
})();
