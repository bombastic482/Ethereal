import { describe, expect, it } from 'vitest';
import { chains } from '../../chains-build';
import { builtRecipes } from '../../recipes-build';
import { isHalalFriendly, recipeIsHalalFriendly } from '../halal';

describe('halal filter', () => {
  it('blocks pork, pork products, gelatin sweets and alcohol', () => {
    for (const n of [
      'Pork belly, roasted',
      'Bacon, back, grilled',
      'Ham, sliced, cooked (deli, lean)',
      'Sausage, pork, grilled',
      "Sausage McMuffin with Egg (McDonald's)",
      'Chicken & Bacon Ranch 6-inch sub (Subway)',
      'Hot dog (frankfurter), beef and pork',
      "Pepperoni pizza, large hand tossed, 1 slice (Domino's)",
      'Carnitas (Chipotle)',
      'Wine, red (13%)',
      'Beer, lager (4.5%)',
      'Gin & tonic (regular tonic)',
      'Goldbears gummy bears (Haribo)',
      'Marshmallows',
      'Lard',
      'Mapo tofu (with minced pork)',
    ])
      expect(isHalalFriendly(n), n).toBe(false);
  });
  it('lets poultry, beef and plant versions through, and non-food matches', () => {
    for (const n of [
      'Turkey bacon, cooked',
      'Sausage, chicken, cooked',
      'Sausage, plant-based',
      'Vegan Sausage Roll (Greggs)',
      'Tempeh bacon, cooked',
      'Pastrami, beef',
      'Lamb loin chop, grilled',
      'Beef short ribs, braised, meat only',
      'Fruit cocktail, canned in juice',
      'Prawn cocktail, prawns in Marie Rose sauce',
      'Ginger ale, regular',
      'Cider vinegar',
      'Beer, alcohol-free',
      'Hamburger, plain, fast food',
      'Chicken breast, cooked, skinless',
    ])
      expect(isHalalFriendly(n), n).toBe(true);
  });
  it('flags recipes by name and ingredients, and marks the two pork recipes', () => {
    expect(
      recipeIsHalalFriendly('Breakfast wrap', ['Bacon medallions, grilled (fat trimmed)']),
    ).toBe(false);
    expect(recipeIsHalalFriendly('Shakshuka', ['Eggs', 'Tomatoes, canned'])).toBe(true);
    const blocked = builtRecipes.filter((r) => !r.halal).map((r) => r.id);
    expect(blocked.length).toBeGreaterThanOrEqual(2);
    expect(blocked.length).toBeLessThanOrEqual(4);
  });
  it('marks chain items so the eating-out page can hide them', () => {
    const mcd = chains.find((c) => c.name === "McDonald's")!;
    expect(mcd.items.find((i) => /Sausage McMuffin/.test(i.name))?.halal).toBe(false);
    expect(mcd.items.find((i) => /Big Mac/.test(i.name))?.halal).toBe(true);
  });
});
