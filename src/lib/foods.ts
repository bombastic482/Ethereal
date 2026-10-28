/** Built-in food database: 1,200+ generic and world foods in six lazy chunks, searchable offline. */
import type { Nutrients } from './calc/nutrition';

export interface Food {
  id: string;
  name: string;
  category: string;
  per100g: Nutrients;
  servings: Array<{ label: string; grams: number }>;
  veg: 'vegan' | 'vegetarian' | 'no';
  tags?: string[];
}

let FOODS: Food[] = [];
let BY_ID = new Map<string, Food>();
let INDEX: Array<{ f: Food; text: string; nameTokens: string[] }> = [];
let loading: Promise<Food[]> | null = null;

/** Loads the database on first use (six JSON chunks, cached by the service worker after that). */
export function loadFoods(): Promise<Food[]> {
  if (FOODS.length) return Promise.resolve(FOODS);
  loading ??= Promise.all([
    import('@/data/foods-a.json'),
    import('@/data/foods-b.json'),
    import('@/data/foods-c.json'),
    import('@/data/foods-d.json'),
    import('@/data/foods-e.json'),
    import('@/data/foods-f.json'),
  ]).then(([a, b, c, d, e, f]) => {
    FOODS = [
      ...(a.default as Food[]),
      ...(b.default as Food[]),
      ...(c.default as Food[]),
      ...(d.default as Food[]),
      ...(e.default as Food[]),
      ...(f.default as Food[]),
    ];
    BY_ID = new Map(FOODS.map((f) => [f.id, f]));
    INDEX = FOODS.map((f) => ({
      f,
      text: norm(`${f.name} ${f.category} ${(f.tags ?? []).join(' ')}`),
      nameTokens: norm(f.name).split(' '),
    }));
    return FOODS;
  });
  return loading;
}

/** Synchronous accessors; empty until loadFoods() has resolved. */
export const allFoods = (): Food[] => FOODS;
export const foodById = (id: string): Food | undefined => BY_ID.get(id);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();

/** Token-prefix search with light ranking: exact name hit > name-start > token prefix > category/tag. */
export function searchFoods(query: string, limit = 25): Food[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  const scored: Array<{ f: Food; s: number }> = [];
  for (const { f, text, nameTokens } of INDEX) {
    let s = 0;
    for (const t of tokens) {
      if (!text.includes(t)) {
        s = -1;
        break;
      }
      if (nameTokens[0] === t) s += 6;
      else if (nameTokens.some((n) => n === t)) s += 4;
      else if (nameTokens.some((n) => n.startsWith(t))) s += 3;
      else s += 1;
    }
    if (s < 0) continue;
    if (norm(f.name) === q) s += 20;
    if (norm(f.name).startsWith(q)) s += 8;
    s -= f.name.length / 60; // prefer shorter, more generic names
    scored.push({ f, s });
  }
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

export const categories = (): string[] => [...new Set(FOODS.map((f) => f.category))].sort();
