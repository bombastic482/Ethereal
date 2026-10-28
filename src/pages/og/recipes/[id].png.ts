/** Open Graph card for each recipe, rendered at build time (see src/lib/og.ts). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { ogPng } from '@/lib/og';
import { builtRecipes, type BuiltRecipe } from '@/lib/recipes-build';

export const getStaticPaths: GetStaticPaths = () =>
  builtRecipes.map((r) => ({ params: { id: r.id }, props: { recipe: r } }));

const MEAL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

export const GET: APIRoute = async ({ props }) => {
  const r = props.recipe as BuiltRecipe;
  const kcal = Math.round(r.totals.kcal);
  const p = Math.round(r.totals.protein);
  const share = (p * 4) / Math.max(1, kcal);
  return ogPng({
    kicker: `${MEAL[r.meal]} · ${r.minutes} min${r.diet === 'vegan' ? ' · Vegan' : r.diet === 'vegetarian' ? ' · Vegetarian' : ''}`,
    title: r.name,
    stats: [
      { label: 'kcal', value: String(kcal) },
      { label: 'protein', value: `${p} g` },
      { label: 'carbs', value: `${Math.round(r.totals.carbs)} g` },
      { label: 'fat', value: `${Math.round(r.totals.fat)} g` },
    ],
    ring: { fraction: share, big: `${Math.round(share * 100)}%`, label: 'from protein' },
  });
};
