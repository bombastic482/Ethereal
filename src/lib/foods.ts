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

/**
 * Everyday staples people log most. They win ties against dishes, brands and raw variants, so
 * "chicken" means chicken breast before chicken korma. Order within the list does not matter.
 */
const STAPLES = new Set([
  'chicken-breast-cooked',
  'chicken-breast-raw',
  'chicken-thigh-cooked-skinless',
  'egg-whole-raw',
  'egg-boiled',
  'egg-white-raw',
  'milk-semi-skimmed',
  'milk-whole',
  'milk-skimmed',
  'yogurt-greek-0',
  'yogurt-greek-2',
  'yogurt-natural-whole',
  'rice-white-cooked',
  'rice-brown-cooked',
  'bread-white',
  'bread-wholemeal',
  'oats-rolled',
  'banana',
  'apple',
  'orange',
  'potato-boiled',
  'potato-baked',
  'sweet-potato-baked',
  'pasta-white-cooked',
  'pasta-wholewheat-cooked',
  'beef-mince-5-cooked',
  'salmon-farmed-cooked',
  'tuna-canned-water',
  'cheddar',
  'cottage-cheese',
  'avocado',
  'olive-oil',
  'butter',
  'peanut-butter-smooth',
  'broccoli-boiled',
  'tofu-firm',
  'lentils-cooked',
  'chickpeas-cooked',
  'quinoa-cooked',
  'whey-protein-concentrate',
  'almonds',
  'coffee-black',
  'coca-cola-classic',
]);

/** Spellings people type that the names do not contain. */
const ALIASES: Record<string, string> = {
  coke: 'coca cola',
  cola: 'coca cola',
  yoghurt: 'yogurt',
  courgette: 'zucchini courgette',
  aubergine: 'eggplant aubergine',
  fries: 'fries chips',
  crisps: 'crisps chips',
  prawn: 'prawn shrimp',
  shrimp: 'shrimp prawn',
  mince: 'mince ground',
  ground: 'ground mince',
  rocket: 'rocket arugula',
  coriander: 'coriander cilantro',
  cilantro: 'cilantro coriander',
};

/**
 * Token-prefix search with light ranking: exact name hit > name-start > token prefix >
 * category/tag, staples before dishes and brands, shorter names before longer ones.
 */
export function searchFoods(query: string, limit = 25): Food[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  const scored: Array<{ f: Food; s: number }> = [];
  for (const { f, text, nameTokens } of INDEX) {
    let s = 0;
    for (const raw of tokens) {
      // An alias matches when any of its words is in the text ("coke" → coca | cola).
      const alts = ALIASES[raw]?.split(' ') ?? [raw];
      const t = alts.find((a) => text.includes(a));
      if (!t) {
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
    if (STAPLES.has(f.id)) s += 2.5;
    if (/\([A-Z][^)]*\)\s*$/.test(f.name)) s -= 1; // branded "(Brand)" items after generic ones
    if (/\b(raw|dry|uncooked)\b/i.test(f.name)) s -= 0.5; // cooked and ready-to-eat first
    scored.push({ f, s });
  }
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

export const categories = (): string[] => [...new Set(FOODS.map((f) => f.category))].sort();
