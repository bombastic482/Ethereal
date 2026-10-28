import { beforeAll, describe, expect, it } from 'vitest';
import { diaryStore } from '../food-store';
import {
  allRecipes,
  filterRecipes,
  loadRecipes,
  logRecipe,
  resolveRecipe,
  saveRecipeAsMeal,
  suitsDiet,
} from '../recipes';

beforeAll(() => loadRecipes());

describe('starter recipes', () => {
  it('every recipe resolves against the database with sensible totals', () => {
    expect(allRecipes().length).toBeGreaterThanOrEqual(60);
    for (const r of allRecipes()) {
      const res = resolveRecipe(r);
      expect(res, r.id).not.toBeNull();
      expect(res!.totals.kcal).toBeGreaterThan(80);
      expect(res!.totals.protein).toBeGreaterThanOrEqual(r.meal === 'snack' ? 10 : 25);
    }
  });

  it('respects diet preference strictly', () => {
    expect(suitsDiet('vegan', 'vegan')).toBe(true);
    expect(suitsDiet('vegetarian', 'vegan')).toBe(false);
    expect(suitsDiet('pescatarian', 'vegetarian')).toBe(false);
    expect(suitsDiet('omnivore', 'omnivore')).toBe(true);
    const vegan = filterRecipes(allRecipes(), { diet: 'vegan' });
    expect(vegan.length).toBeGreaterThan(8);
    expect(vegan.every((r) => r.diet === 'vegan')).toBe(true);
  });

  it('filters by meal, time and text, and sorts what fits first', () => {
    const quick = filterRecipes(allRecipes(), { meal: 'breakfast', maxMinutes: 10 });
    expect(quick.length).toBeGreaterThan(3);
    expect(quick.every((r) => r.meal === 'breakfast' && r.minutes <= 10)).toBe(true);
    expect(filterRecipes(allRecipes(), { q: 'salmon' }).length).toBeGreaterThan(0);
    const fit = filterRecipes(allRecipes(), { remainingKcal: 200 });
    const first = fit[0]!.totals.kcal;
    const last = fit[fit.length - 1]!.totals.kcal;
    expect(first).toBeLessThanOrEqual(200);
    expect(last).toBeGreaterThan(200);
  });

  it('logs ingredients as separate entries and saves a copy as a meal once', () => {
    const r = resolveRecipe(allRecipes()[0]!)!;
    const before = diaryStore.get().food.length;
    expect(logRecipe(r, '2026-10-01', 'breakfast', 0.5, 480)).toBe(r.foods.length);
    const d = diaryStore.get();
    expect(d.food.length).toBe(before + r.foods.length);
    const added = d.food.slice(-r.foods.length);
    expect(added.every((e) => e.meal === 'breakfast' && e.source === 'local')).toBe(true);
    expect(added[0]!.grams).toBe(Math.round(r.foods[0]!.grams * 0.5));
    expect(d.recent[0]).toBe(r.foods[0]!.food.id);

    const m1 = saveRecipeAsMeal(r);
    const m2 = saveRecipeAsMeal(r);
    expect(m1.id).toBe(m2.id);
    expect(diaryStore.get().meals?.filter((m) => m.id === m1.id)).toHaveLength(1);
  });
});

describe('recipe idea for the next meal', () => {
  it('fits the remaining calories and prefers protein', async () => {
    const { suggestRecipe, allRecipes } = await import('../recipes');
    const r = suggestRecipe(allRecipes(), {
      slot: 'dinner',
      diet: 'omnivore',
      remainingKcal: 700,
      remainingProtein: 60,
    });
    expect(r).not.toBeNull();
    expect(r!.meal).toBe('dinner');
    expect(r!.totals.kcal).toBeLessThanOrEqual(700);
    expect(r!.totals.protein).toBeGreaterThan(45);
  });
  it('falls back to a snack when the slot does not fit, respects diet and exclusions', async () => {
    const { suggestRecipe, allRecipes } = await import('../recipes');
    const small = suggestRecipe(allRecipes(), {
      slot: 'dinner',
      diet: 'vegan',
      remainingKcal: 220,
      remainingProtein: 20,
    });
    expect(small).not.toBeNull();
    expect(small!.meal).toBe('snack');
    expect(small!.diet).toBe('vegan');
    const again = suggestRecipe(allRecipes(), {
      slot: 'dinner',
      diet: 'vegan',
      remainingKcal: 220,
      remainingProtein: 20,
      exclude: [small!.id],
    });
    expect(again?.id).not.toBe(small!.id);
    expect(
      suggestRecipe(allRecipes(), {
        slot: 'lunch',
        diet: 'omnivore',
        remainingKcal: 80,
        remainingProtein: 10,
      }),
    ).toBeNull();
  });
});
