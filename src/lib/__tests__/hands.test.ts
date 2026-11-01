import { describe, expect, it } from 'vitest';
import { scale } from '../calc/nutrition';
import { handCount, resolveHands } from '../hands';

describe('hand portions', () => {
  it('turns a family plate into grams and sensible nutrients', () => {
    // Two palms of chicken, two fists of rice, a fist of salad, a thumb of ghee.
    const items = resolveHands([
      { kind: 'palm', foodId: 'chicken', count: 2 },
      { kind: 'fist-carb', foodId: 'rice', count: 2 },
      { kind: 'fist-veg', foodId: 'veg', count: 1 },
      { kind: 'thumb', foodId: 'oil', count: 1 },
      { kind: 'thumb', foodId: 'nuts', count: 0 },
    ]);
    expect(items.map((i) => i.grams)).toEqual([200, 300, 80, 12]);
    const kcal = items.reduce((s, i) => s + scale(i.food.per100g, i.grams).kcal, 0);
    const protein = items.reduce((s, i) => s + scale(i.food.per100g, i.grams).protein, 0);
    // A hearty machboos-style plate: roughly 950 kcal and 60 g protein.
    expect(kcal).toBeGreaterThan(850);
    expect(kcal).toBeLessThan(1050);
    expect(protein).toBeGreaterThan(55);
  });

  it('writes counts the way people say them', () => {
    expect(handCount(1, 'palm')).toBe('1 palm');
    expect(handCount(1.5, 'palm')).toBe('1½ palms');
    expect(handCount(0.5, 'thumb')).toBe('½ thumb');
    expect(handCount(2, 'fist-carb')).toBe('2 fists');
  });
});
