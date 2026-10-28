import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chains } from '../../chains-build';
import { builtRecipes } from '../../recipes-build';
import { isHalalFriendly, recipeIsHalalFriendly } from '../halal';

describe('halal word list', () => {
  it('recognises pork, pork products, gelatin sweets and alcohol', () => {
    for (const n of [
      'Pork belly, roasted',
      'Bacon, back, grilled',
      "Sausage McMuffin with Egg (McDonald's)",
      'Hot dog (frankfurter), beef and pork',
      'Wine, red (13%)',
      'Gin & tonic (regular tonic)',
      'Goldbears gummy bears (Haribo)',
      'Mapo tofu (with minced pork)',
    ])
      expect(isHalalFriendly(n), n).toBe(false);
  });
  it('lets poultry, beef and plant versions through, and non-food matches', () => {
    for (const n of [
      'Turkey bacon, cooked',
      'Sausage, chicken, cooked',
      'Vegan Sausage Roll (Greggs)',
      'Lamb loin chop, grilled',
      'Fruit cocktail, canned in juice',
      'Ginger ale, regular',
      'Cider vinegar',
      'Hamburger, plain, fast food',
    ])
      expect(isHalalFriendly(n), n).toBe(true);
  });
});

describe('the shipped data is halal-friendly', () => {
  it('has no pork, gelatin or alcohol in the food database', () => {
    const offenders: string[] = [];
    for (const k of 'abcdef') {
      const foods = JSON.parse(readFileSync(`src/data/foods-${k}.json`, 'utf8')) as Array<{
        name: string;
      }>;
      for (const f of foods)
        if (!isHalalFriendly(f.name) || /alcohol/i.test(f.name)) offenders.push(f.name);
    }
    expect(offenders).toEqual([]);
  });
  it('has no such ingredient in any recipe or chain item', () => {
    for (const r of builtRecipes)
      expect(
        recipeIsHalalFriendly(
          r.name,
          r.ingredients.map((i) => i.name),
        ),
        r.id,
      ).toBe(true);
    for (const c of chains)
      for (const it of c.items) expect(isHalalFriendly(it.name), it.name).toBe(true);
  });
});
