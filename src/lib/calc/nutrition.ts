import { round } from './units';

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
  /** Optional label extras, mostly from packaged products. */
  sugar?: number;
  satFat?: number;
  /** Salt in grams (sodium × 2.5). */
  salt?: number;
}

/** The five values every summary carries; label extras stay optional. */
export type CoreNutrients = Required<
  Pick<Nutrients, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fibre'>
>;

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: ReadonlyArray<{
  key: Meal;
  label: string;
  /** Share of daily calories typically eaten, for suggestions. */ share: number;
}> = [
  { key: 'breakfast', label: 'Breakfast', share: 0.25 },
  { key: 'lunch', label: 'Lunch', share: 0.3 },
  { key: 'dinner', label: 'Dinner', share: 0.35 },
  { key: 'snack', label: 'Snacks', share: 0.1 },
];

export interface FoodEntry {
  id: string;
  /** YYYY-MM-DD local day. */
  date: string;
  meal: Meal;
  name: string;
  brand?: string;
  /** Portion in grams (or ml). */
  grams: number;
  /** Nutrients per 100 g so the portion can be edited later. */
  per100g: Nutrients;
  source: 'local' | 'off' | 'custom' | 'quick';
  foodId?: string;
  barcode?: string;
  /** Minutes since midnight, for ordering. */
  time?: number;
}

export interface ExerciseEntry {
  id: string;
  date: string;
  activity: string;
  minutes: number;
  kcal: number;
}

export const EMPTY: CoreNutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

export function scale(per100g: Nutrients, grams: number): CoreNutrients {
  const f = grams / 100;
  return {
    kcal: round(per100g.kcal * f),
    protein: round(per100g.protein * f, 1),
    carbs: round(per100g.carbs * f, 1),
    fat: round(per100g.fat * f, 1),
    fibre: round((per100g.fibre ?? 0) * f, 1),
  };
}

export function sum(items: Nutrients[]): CoreNutrients {
  const t = { ...EMPTY };
  for (const n of items) {
    t.kcal += n.kcal;
    t.protein += n.protein;
    t.carbs += n.carbs;
    t.fat += n.fat;
    t.fibre += n.fibre ?? 0;
  }
  return {
    kcal: round(t.kcal),
    protein: round(t.protein, 1),
    carbs: round(t.carbs, 1),
    fat: round(t.fat, 1),
    fibre: round(t.fibre, 1),
  };
}

export function entryNutrients(e: FoodEntry): CoreNutrients {
  return scale(e.per100g, e.grams);
}

export interface DayTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface DaySummary {
  eaten: CoreNutrients;
  burned: number;
  /** Target adjusted for exercise if `eatBack` is on. */
  target: DayTargets;
  remaining: CoreNutrients;
  /** 0–1 of the calorie target consumed (can exceed 1). */
  progress: number;
  byMeal: Record<Meal, CoreNutrients>;
  status: 'under' | 'on-target' | 'over';
}

export function summariseDay(
  food: FoodEntry[],
  exercise: ExerciseEntry[],
  base: DayTargets,
  eatBack = false,
): DaySummary {
  const eaten = sum(food.map(entryNutrients));
  const burned = round(exercise.reduce((a, e) => a + e.kcal, 0));
  const target: DayTargets = eatBack ? { ...base, kcal: base.kcal + burned } : base;
  const remaining = {
    kcal: round(target.kcal - eaten.kcal),
    protein: round(target.protein - eaten.protein, 1),
    carbs: round(target.carbs - eaten.carbs, 1),
    fat: round(target.fat - eaten.fat, 1),
    fibre: round(target.fibre - eaten.fibre, 1),
  };
  const byMeal = Object.fromEntries(
    MEALS.map((m) => [m.key, sum(food.filter((e) => e.meal === m.key).map(entryNutrients))]),
  ) as Record<Meal, CoreNutrients>;
  const progress = target.kcal > 0 ? eaten.kcal / target.kcal : 0;
  const status: DaySummary['status'] =
    progress > 1.1 ? 'over' : progress >= 0.9 ? 'on-target' : 'under';
  return { eaten, burned, target, remaining, progress, byMeal, status };
}

/** Which meal is it, based on local time? Used as the default when adding food. */
export function mealForTime(hour: number): Meal {
  if (hour < 10.5) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

/** Days within ±10% of target count as adherent; returns 0–100. */
export function adherencePercent(
  days: Array<{ eatenKcal: number; targetKcal: number }>,
): number | null {
  const logged = days.filter((d) => d.eatenKcal > 0);
  if (logged.length === 0) return null;
  const ok = logged.filter(
    (d) => Math.abs(d.eatenKcal - d.targetKcal) / d.targetKcal <= 0.1,
  ).length;
  return round((ok / logged.length) * 100);
}

export interface SuggestFood {
  id: string;
  name: string;
  category?: string;
  per100g: Nutrients;
  servings: Array<{ label: string; grams: number }>;
  veg: 'vegan' | 'vegetarian' | 'no';
  tags?: string[];
}

export type Diet = 'omnivore' | 'vegetarian' | 'vegan';

/**
 * "What to eat next": ranks foods by how well one serving fills the remaining protein without
 * blowing the remaining calories. Only runs when there is meaningful room left.
 */
export function suggestFoods(
  remaining: CoreNutrients,
  foods: SuggestFood[],
  diet: Diet = 'omnivore',
  limit = 4,
): Array<{ food: SuggestFood; grams: number; n: CoreNutrients; reason: string }> {
  if (remaining.kcal < 120) return [];
  const dietOk = (f: SuggestFood) =>
    diet === 'vegan' ? f.veg === 'vegan' : diet === 'vegetarian' ? f.veg !== 'no' : true;
  // Whole foods people actually snack on: skip raw/uncooked items, dry goods and supplements.
  const edible = (f: SuggestFood) =>
    !/\b(raw|uncooked|dry|powder|flour|oil)\b/i.test(f.name) &&
    !/supplement|fast food|takeaway|ready meal|sweets|drinks/i.test(f.category ?? '') &&
    !/\([^)]*\)\s*$/.test(f.name); // "(Brand)" suffix: chain and branded items
  let allowed = foods.filter((f) => dietOk(f) && edible(f));
  if (allowed.length < 5) allowed = foods.filter(dietOk);
  const proteinShort = remaining.protein > 15;
  const scored = allowed
    .map((f) => {
      const grams = f.servings[0]?.grams ?? 100;
      const n = scale(f.per100g, grams);
      if (n.kcal > remaining.kcal || n.kcal < 40) return null;
      const proteinDensity = n.protein / Math.max(1, n.kcal); // g per kcal
      const fitsProtein = proteinShort ? Math.min(1, n.protein / remaining.protein) : 0;
      const score = proteinShort
        ? fitsProtein * 0.7 + proteinDensity * 30
        : (n.fibre ?? 0) / 10 + (1 - n.kcal / remaining.kcal) * 0.3;
      return { food: f, grams, n, score };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const picked: typeof scored = [];
  for (const x of scored) {
    const cat = x.food.category ?? x.food.id;
    if (seen.has(cat)) continue;
    seen.add(cat);
    picked.push(x);
    if (picked.length >= limit) break;
  }
  const chosen = picked.length >= Math.min(limit, 2) ? picked : scored.slice(0, limit);
  return chosen.map(({ food, grams, n }) => ({
    food,
    grams,
    n,
    reason: proteinShort
      ? `${n.protein} g protein for ${n.kcal} kcal`
      : `${n.kcal} kcal, ${n.fibre} g fibre`,
  }));
}
