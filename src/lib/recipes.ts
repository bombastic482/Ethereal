/**
 * Starter recipes: 60+ simple, high-protein meals built from database foods, so every one
 * can be logged in a tap or saved as a reusable meal. Loaded lazily like the food database.
 */
import type { CoreNutrients, Diet, FoodEntry } from './calc/nutrition';
import { scale, sum } from './calc/nutrition';
import { diaryStore, uid, type SavedMeal } from './food-store';
import { foodById, loadFoods, type Food } from './foods';

export type RecipeMeal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type RecipeDiet = 'vegan' | 'vegetarian' | 'pescatarian' | 'omnivore';

export interface Recipe {
  id: string;
  name: string;
  meal: RecipeMeal;
  diet: RecipeDiet;
  minutes: number;
  tags: string[];
  items: Array<{ foodId: string; grams: number }>;
  method: string;
}

export interface ResolvedRecipe extends Recipe {
  foods: Array<{ food: Food; grams: number }>;
  totals: CoreNutrients;
}

let RECIPES: Recipe[] = [];
let loading: Promise<Recipe[]> | null = null;

export function loadRecipes(): Promise<Recipe[]> {
  if (RECIPES.length) return Promise.resolve(RECIPES);
  loading ??= Promise.all([import('@/data/recipes.json'), loadFoods()])
    .then(([r]) => {
      RECIPES = r.default as Recipe[];
      return RECIPES;
    })
    .catch((e: unknown) => {
      loading = null; // allow a retry after a failed chunk download
      throw e;
    });
  return loading;
}

export const allRecipes = (): Recipe[] => RECIPES;

/** Attaches database foods and per-serving totals; null if any ingredient is missing. */
export function resolveRecipe(r: Recipe): ResolvedRecipe | null {
  const foods: ResolvedRecipe['foods'] = [];
  for (const it of r.items) {
    const food = foodById(it.foodId);
    if (!food) return null;
    foods.push({ food, grams: it.grams });
  }
  return { ...r, foods, totals: sum(foods.map((f) => scale(f.food.per100g, f.grams))) };
}

/** A recipe suits a diet when it is at least as restrictive as the preference. */
export function suitsDiet(recipe: RecipeDiet, diet: Diet): boolean {
  if (diet === 'vegan') return recipe === 'vegan';
  if (diet === 'vegetarian') return recipe === 'vegan' || recipe === 'vegetarian';
  return true;
}

export interface RecipeFilter {
  meal?: RecipeMeal | 'all';
  diet?: Diet;
  maxMinutes?: number;
  /** Remaining kcal for the day: recipes that fit sort first, nothing is hidden. */
  remainingKcal?: number;
  q?: string;
}

export function filterRecipes(recipes: Recipe[], f: RecipeFilter = {}): ResolvedRecipe[] {
  const q = (f.q ?? '').trim().toLowerCase();
  const out: ResolvedRecipe[] = [];
  for (const r of recipes) {
    if (f.meal && f.meal !== 'all' && r.meal !== f.meal) continue;
    if (f.diet && !suitsDiet(r.diet, f.diet)) continue;
    if (f.maxMinutes !== undefined && r.minutes > f.maxMinutes) continue;
    if (q && !`${r.name} ${r.tags.join(' ')} ${r.meal}`.toLowerCase().includes(q)) continue;
    const res = resolveRecipe(r);
    if (res) out.push(res);
  }
  if (f.remainingKcal !== undefined) {
    const left = f.remainingKcal;
    out.sort((a, b) => {
      const fa = a.totals.kcal <= left ? 0 : 1;
      const fb = b.totals.kcal <= left ? 0 : 1;
      return fa - fb || Math.abs(left - a.totals.kcal) - Math.abs(left - b.totals.kcal);
    });
  }
  return out;
}

/** Logs every ingredient of a recipe to one meal slot, scaled by portion. Returns the entry count. */
export function logRecipe(
  r: ResolvedRecipe,
  date: string,
  slot: FoodEntry['meal'],
  portion = 1,
  time?: number,
): number {
  const d = diaryStore.get();
  const entries: FoodEntry[] = r.foods.map(({ food, grams }) => ({
    id: uid(),
    date,
    meal: slot,
    name: food.name,
    grams: Math.round(grams * portion),
    per100g: food.per100g,
    source: 'local',
    foodId: food.id,
    ...(time !== undefined ? { time } : {}),
  }));
  const recent = [
    ...r.foods.map((f) => f.food.id),
    ...d.recent.filter((k) => !r.foods.some((f) => f.food.id === k)),
  ].slice(0, 30);
  diaryStore.set({ ...d, food: [...d.food, ...entries], recent });
  return entries.length;
}

/** Copies a recipe into the user's saved meals so it can be edited and re-logged like their own. */
export function saveRecipeAsMeal(r: ResolvedRecipe): SavedMeal {
  const d = diaryStore.get();
  const existing = (d.meals ?? []).find((m) => m.id === `recipe-${r.id}`);
  if (existing) return existing;
  const meal: SavedMeal = {
    id: `recipe-${r.id}`,
    name: r.name,
    items: r.foods.map(({ food, grams }) => ({
      name: food.name,
      grams,
      per100g: food.per100g,
      foodId: food.id,
    })),
  };
  diaryStore.set({ ...d, meals: [meal, ...(d.meals ?? [])] });
  return meal;
}

export const RECIPE_MEALS: Array<{ value: RecipeMeal | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];

export interface IdeaInput {
  slot: FoodEntry['meal'];
  diet: Diet;
  remainingKcal: number;
  remainingProtein: number;
  /** Ids to skip (already shown or logged today). */
  exclude?: string[];
}

/**
 * One recipe for the coming meal that fits what is left today. Prefers covering the remaining
 * protein, then landing near (but under) the remaining calories. Falls back to a snack when
 * nothing in the slot fits; null when there is too little room for anything.
 */
export function suggestRecipe(recipes: Recipe[], input: IdeaInput): ResolvedRecipe | null {
  if (input.remainingKcal < 120) return null;
  const skip = new Set(input.exclude ?? []);
  const pick = (meal: RecipeMeal): ResolvedRecipe | null => {
    let best: ResolvedRecipe | null = null;
    let bestScore = -Infinity;
    for (const r of recipes) {
      if (r.meal !== meal || skip.has(r.id) || !suitsDiet(r.diet, input.diet)) continue;
      const res = resolveRecipe(r);
      if (!res || res.totals.kcal > input.remainingKcal) continue;
      const proteinCovered = Math.min(res.totals.protein, Math.max(input.remainingProtein, 0));
      const slack = input.remainingKcal - res.totals.kcal;
      // 1 g of protein covered is worth about 25 kcal of slack; leaving a little room is fine.
      const score = proteinCovered * 25 - Math.max(slack - 100, 0) * 0.6 - r.minutes;
      if (score > bestScore) {
        best = res;
        bestScore = score;
      }
    }
    return best;
  };
  return pick(input.slot) ?? (input.slot === 'snack' ? null : pick('snack'));
}
