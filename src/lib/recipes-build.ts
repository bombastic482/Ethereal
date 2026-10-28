/**
 * Build-time view of the starter recipes for Astro pages: every ingredient resolved against the
 * database and per-serving totals computed, with no browser stores involved.
 */
import recipesRaw from '@/data/recipes.json';
import foodsA from '@/data/foods-a.json';
import foodsB from '@/data/foods-b.json';
import foodsC from '@/data/foods-c.json';
import foodsD from '@/data/foods-d.json';
import foodsE from '@/data/foods-e.json';
import foodsF from '@/data/foods-f.json';
import type { CoreNutrients, Nutrients } from './calc/nutrition';
import type { Food } from './foods';
import type { Recipe } from './recipes';

export interface BuiltRecipe extends Recipe {
  ingredients: Array<{ name: string; grams: number; per100g: Nutrients }>;
  totals: CoreNutrients;
}

const foods = new Map<string, Food>(
  ([...foodsA, ...foodsB, ...foodsC, ...foodsD, ...foodsE, ...foodsF] as Food[]).map((f) => [
    f.id,
    f,
  ]),
);

export const builtRecipes: BuiltRecipe[] = (recipesRaw as Recipe[]).map((r) => {
  const ingredients = r.items.map((it) => {
    const f = foods.get(it.foodId);
    if (!f) throw new Error(`recipe ${r.id} references unknown food ${it.foodId}`);
    return { name: f.name, grams: it.grams, per100g: f.per100g };
  });
  const t: CoreNutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
  for (const it of ingredients) {
    const k = it.grams / 100;
    t.kcal += it.per100g.kcal * k;
    t.protein += it.per100g.protein * k;
    t.carbs += it.per100g.carbs * k;
    t.fat += it.per100g.fat * k;
    t.fibre += (it.per100g.fibre ?? 0) * k;
  }
  return { ...r, ingredients, totals: t };
});

export const DIET_LABEL: Record<Recipe['diet'], string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  pescatarian: 'Pescatarian',
  omnivore: '',
};
