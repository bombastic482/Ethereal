/** Food and exercise diary plus diary preferences, all stored locally. */
import type { ExerciseEntry, FoodEntry, Nutrients, Diet } from './calc/nutrition';
import { isHalalFriendly } from './calc/halal';
import { createStore } from './store';

export interface CustomFood {
  id: string;
  name: string;
  brand?: string;
  per100g: Nutrients;
  servingGrams: number;
  servingLabel: string;
}

export interface SavedMealItem {
  name: string;
  brand?: string;
  grams: number;
  per100g: Nutrients;
  foodId?: string;
  barcode?: string;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
}

/** What we remember about a scanned product so favourites and recents outlive diary entries. */
export interface ProductSnapshot {
  name: string;
  brand?: string;
  per100g: Nutrients;
  grams: number;
}

export interface Diary {
  food: FoodEntry[];
  /** Scanned products by barcode. */
  products?: Record<string, ProductSnapshot>;
  /** Saved meals and recipes, logged as a group. */
  meals?: SavedMeal[];
  exercise: ExerciseEntry[];
  /** Glasses of water per day: { 'YYYY-MM-DD': n }. */
  water: Record<string, number>;
  /** Steps per day: { 'YYYY-MM-DD': n }. */
  steps?: Record<string, number>;
  customFoods: CustomFood[];
  /** Food ids (local or barcode) used recently, newest first. */
  recent: string[];
  favourites: string[];
}

export interface DiaryPrefs {
  diet: Diet;
  /** Hide pork and pork products, gelatin sweets and alcohol everywhere. */
  halal: boolean;
  /** Add exercise calories to the day's target. Off by default; trackers overestimate burn. */
  eatBack: boolean;
  waterGoalGlasses: number;
}

export const diaryStore = createStore<Diary>(
  'ethereal:diary:v1',
  { food: [], exercise: [], water: {}, customFoods: [], recent: [], favourites: [] },
  (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<Diary>;
    return {
      food: Array.isArray(r.food) ? r.food : [],
      exercise: Array.isArray(r.exercise) ? r.exercise : [],
      water: r.water && typeof r.water === 'object' ? r.water : {},
      customFoods: Array.isArray(r.customFoods) ? r.customFoods : [],
      recent: Array.isArray(r.recent) ? r.recent : [],
      favourites: Array.isArray(r.favourites) ? r.favourites : [],
      meals: Array.isArray(r.meals) ? r.meals : [],
      steps: r.steps && typeof r.steps === 'object' ? r.steps : {},
      products: r.products && typeof r.products === 'object' ? r.products : {},
    };
  },
);

export const prefsStore = createStore<DiaryPrefs>('ethereal:prefs:v1', {
  diet: 'omnivore',
  halal: false,
  eatBack: false,
  waterGoalGlasses: 8,
});

/** Whether the current preferences allow a food with this name (halal filter). */
export function allowsFood(name: string): boolean {
  return !prefsStore.get().halal || isHalalFriendly(name);
}

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function addFood(entry: Omit<FoodEntry, 'id'>): FoodEntry {
  const d = diaryStore.get();
  const e: FoodEntry = { ...entry, id: uid() };
  const key = entry.barcode ?? entry.foodId;
  const recent = key ? [key, ...d.recent.filter((k) => k !== key)].slice(0, 30) : d.recent;
  const products = entry.barcode
    ? {
        ...(d.products ?? {}),
        [entry.barcode]: {
          name: entry.name,
          ...(entry.brand ? { brand: entry.brand } : {}),
          per100g: entry.per100g,
          grams: entry.grams,
        },
      }
    : d.products;
  diaryStore.set({ ...d, food: [...d.food, e], recent, ...(products ? { products } : {}) });
  return e;
}

export function updateFood(id: string, patch: Partial<FoodEntry>): void {
  const d = diaryStore.get();
  diaryStore.set({ ...d, food: d.food.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
}

export function removeFood(id: string): void {
  const d = diaryStore.get();
  diaryStore.set({ ...d, food: d.food.filter((e) => e.id !== id) });
}

export function addExercise(entry: Omit<ExerciseEntry, 'id'>): ExerciseEntry {
  const d = diaryStore.get();
  const e: ExerciseEntry = { ...entry, id: uid() };
  diaryStore.set({ ...d, exercise: [...d.exercise, e] });
  return e;
}

export function removeExercise(id: string): void {
  const d = diaryStore.get();
  diaryStore.set({ ...d, exercise: d.exercise.filter((e) => e.id !== id) });
}

export function setWater(date: string, glasses: number): void {
  const d = diaryStore.get();
  diaryStore.set({ ...d, water: { ...d.water, [date]: Math.max(0, glasses) } });
}

export function toggleFavourite(key: string): void {
  const d = diaryStore.get();
  const favourites = d.favourites.includes(key)
    ? d.favourites.filter((k) => k !== key)
    : [key, ...d.favourites].slice(0, 50);
  diaryStore.set({ ...d, favourites });
}

export function saveCustomFood(food: Omit<CustomFood, 'id'> & { id?: string }): CustomFood {
  const d = diaryStore.get();
  const id = food.id ?? `custom-${uid()}`;
  const next: CustomFood = { ...food, id };
  diaryStore.set({ ...d, customFoods: [next, ...d.customFoods.filter((c) => c.id !== id)] });
  return next;
}

/** Copies yesterday's entries for a meal to today. The single most used shortcut in diet apps. */
export function copyMeal(fromDate: string, toDate: string, meal: FoodEntry['meal']): number {
  const d = diaryStore.get();
  const items = d.food.filter((e) => e.date === fromDate && e.meal === meal);
  if (items.length === 0) return 0;
  const copies = items.map((e) => ({ ...e, id: uid(), date: toDate }));
  diaryStore.set({ ...d, food: [...d.food, ...copies] });
  return copies.length;
}

export function foodCsv(food: FoodEntry[]): string {
  const rows = [
    ['date', 'meal', 'name', 'brand', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'],
  ];
  for (const e of [...food].sort((a, b) => a.date.localeCompare(b.date))) {
    const f = e.grams / 100;
    rows.push([
      e.date,
      e.meal,
      e.name,
      e.brand ?? '',
      String(e.grams),
      String(Math.round(e.per100g.kcal * f)),
      (e.per100g.protein * f).toFixed(1),
      (e.per100g.carbs * f).toFixed(1),
      (e.per100g.fat * f).toFixed(1),
      ((e.per100g.fibre ?? 0) * f).toFixed(1),
    ]);
  }
  return rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');
}

/** Saves the entries of one meal on one day as a reusable meal. */
export function saveMealFromEntries(name: string, entries: FoodEntry[]): SavedMeal | null {
  if (entries.length === 0 || !name.trim()) return null;
  const d = diaryStore.get();
  const meal: SavedMeal = {
    id: `meal-${uid()}`,
    name: name.trim(),
    items: entries.map((e) => ({
      name: e.name,
      ...(e.brand ? { brand: e.brand } : {}),
      grams: e.grams,
      per100g: e.per100g,
      ...(e.foodId ? { foodId: e.foodId } : {}),
      ...(e.barcode ? { barcode: e.barcode } : {}),
    })),
  };
  diaryStore.set({ ...d, meals: [meal, ...(d.meals ?? [])] });
  return meal;
}

/** Logs every item of a saved meal, scaled by `portion` (1 = as saved, 0.5 = half). */
export function logSavedMeal(
  meal: SavedMeal,
  date: string,
  slot: FoodEntry['meal'],
  portion = 1,
  time?: number,
): number {
  const d = diaryStore.get();
  const entries: FoodEntry[] = meal.items.map((it) => ({
    id: uid(),
    date,
    meal: slot,
    name: it.name,
    ...(it.brand ? { brand: it.brand } : {}),
    grams: Math.round(it.grams * portion),
    per100g: it.per100g,
    source: it.barcode ? 'off' : it.foodId ? 'local' : 'custom',
    ...(it.foodId ? { foodId: it.foodId } : {}),
    ...(it.barcode ? { barcode: it.barcode } : {}),
    ...(time !== undefined ? { time } : {}),
  }));
  diaryStore.set({ ...d, food: [...d.food, ...entries] });
  return entries.length;
}

export function deleteSavedMeal(id: string): void {
  const d = diaryStore.get();
  diaryStore.set({ ...d, meals: (d.meals ?? []).filter((m) => m.id !== id) });
}

export function setSteps(date: string, steps: number): void {
  const d = diaryStore.get();
  diaryStore.set({ ...d, steps: { ...(d.steps ?? {}), [date]: Math.max(0, Math.round(steps)) } });
}
