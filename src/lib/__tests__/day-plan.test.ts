import { beforeAll, describe, expect, it } from 'vitest';
import { atPortion, planDay, portionLabel, shoppingList, shoppingListText } from '../day-plan';
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
  it('tunes portions to land a low, protein-heavy target instead of overshooting', () => {
    const p = planDay(allRecipes(), { kcal: 1262, protein: 151, diet: 'omnivore' })!;
    expect(p.kcalDelta).toBeLessThanOrEqual(80);
    expect(p.proteinMet).toBe(true);
    // Every slot reports its portion, and the slot's recipe is already scaled to it.
    for (const [slot, r] of Object.entries(p.slots)) {
      const portion = p.portions[slot as keyof typeof p.portions]!;
      expect([0.75, 1, 1.25, 1.5]).toContain(portion);
      expect(r!.foods[0]!.grams).toBeCloseTo(
        allRecipes().find((x) => x.id === r!.id)!.items[0]!.grams * portion,
      );
    }
    // An easy target needs no tuning at all.
    const easy = planDay(allRecipes(), { kcal: 1800, protein: 130, diet: 'omnivore' })!;
    expect(Object.values(easy.portions).every((x) => x === 1)).toBe(true);
  });
  it('scales a recipe and names its portion', () => {
    const r = planDay(allRecipes(), { kcal: 1800, protein: 130, diet: 'omnivore' })!.slots.lunch!;
    const big = atPortion(r, 1.5);
    expect(big.totals.kcal).toBeCloseTo(r.totals.kcal * 1.5);
    expect(big.foods.map((f) => f.grams)).toEqual(r.foods.map((f) => f.grams * 1.5));
    expect(atPortion(r, 1)).toBe(r);
    expect([0.75, 1, 1.25, 1.5].map(portionLabel)).toEqual(['¾', '1', '1¼', '1½']);
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

describe('week planner', () => {
  it('plans seven varied days near target, optionally repeating breakfast', async () => {
    const { planWeek, shoppingListForDays, weekShoppingText } = await import('../day-plan');
    const week = planWeek(allRecipes(), { kcal: 1800, protein: 130, diet: 'omnivore' });
    expect(week).toHaveLength(7);
    const dinners = week.map((d) => d.slots.dinner!.id);
    expect(new Set(dinners).size).toBe(7); // 21 dinners available: no repeats needed
    for (const d of week) expect(Math.abs(d.kcalDelta)).toBeLessThanOrEqual(120);
    const same = planWeek(allRecipes(), {
      kcal: 1800,
      protein: 130,
      diet: 'omnivore',
      repeatBreakfast: true,
    });
    expect(new Set(same.map((d) => d.slots.breakfast!.id)).size).toBe(1);
    const list = shoppingListForDays(week);
    expect(list.length).toBeGreaterThan(20);
    expect(weekShoppingText(week)).toMatch(/^Shopping list for 7 days\n- /);
  });
  it('falls back to repeats when the pool is thin', async () => {
    const { planWeek } = await import('../day-plan');
    const vegan = planWeek(allRecipes(), { kcal: 1700, protein: 110, diet: 'vegan', days: 7 });
    expect(vegan.length).toBe(7);
  });
});
