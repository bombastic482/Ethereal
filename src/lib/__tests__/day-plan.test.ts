import { beforeAll, describe, expect, it } from 'vitest';
import { planDay, shoppingList, shoppingListText } from '../day-plan';
import { allRecipes, loadRecipes } from '../recipes';

beforeAll(() => loadRecipes());

describe('day planner', () => {
  it('hits the calorie target closely with enough protein', () => {
    const p = planDay(allRecipes(), { kcal: 1800, protein: 130, diet: 'omnivore' })!;
    expect(p).not.toBeNull();
    expect(Object.keys(p.slots)).toHaveLength(4);
    expect(Math.abs(p.kcalDelta)).toBeLessThanOrEqual(60);
    expect(p.proteinMet).toBe(true);
    expect(p.totals.protein).toBeGreaterThanOrEqual(128);
  });
  it('respects diet, time, locks, exclusions and skipped slots', () => {
    const vegan = planDay(allRecipes(), {
      kcal: 1600,
      protein: 100,
      diet: 'vegan',
      maxMinutes: 20,
    })!;
    expect(vegan).not.toBeNull();
    for (const r of Object.values(vegan.slots)) {
      expect(r!.diet).toBe('vegan');
      expect(r!.minutes).toBeLessThanOrEqual(20);
    }
    const base = planDay(allRecipes(), { kcal: 2000, protein: 140, diet: 'omnivore' })!;
    const lunchId = base.slots.lunch!.id;
    const swapped = planDay(allRecipes(), {
      kcal: 2000,
      protein: 140,
      diet: 'omnivore',
      exclude: [lunchId],
    })!;
    expect(swapped.slots.lunch!.id).not.toBe(lunchId);
    const locked = planDay(allRecipes(), {
      kcal: 2000,
      protein: 140,
      diet: 'vegan',
      locked: { dinner: base.slots.dinner!.id }, // an omnivore dinner stays when locked
    })!;
    expect(locked.slots.dinner!.id).toBe(base.slots.dinner!.id);
    const noSnack = planDay(allRecipes(), {
      kcal: 1500,
      protein: 110,
      diet: 'omnivore',
      skip: ['snack'],
    })!;
    expect(noSnack.slots.snack).toBeUndefined();
    expect(Object.keys(noSnack.slots)).toHaveLength(3);
  });
  it('builds a merged shopping list', () => {
    const p = planDay(allRecipes(), { kcal: 1800, protein: 130, diet: 'omnivore' })!;
    const list = shoppingList(p, 3);
    const names = list.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
    expect(list[0]!.grams).toBeGreaterThanOrEqual(list[list.length - 1]!.grams);
    const oneDay = shoppingList(p, 1);
    expect(list[0]!.grams).toBe(
      Math.round(oneDay.find((l) => l.name === list[0]!.name)!.grams * 3),
    );
    expect(shoppingListText(p, 3)).toMatch(/^Shopping list for 3 days\n- /);
  });
});
