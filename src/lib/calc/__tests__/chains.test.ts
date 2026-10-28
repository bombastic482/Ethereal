import { describe, expect, it } from 'vitest';
import { chains } from '../../chains-build';
import { CHAIN_NAMES, chainOf, chainShare } from '../chains';
import { buildInsights } from '../insights';
import type { FoodEntry } from '../nutrition';

const e = (date: string, name: string, kcal: number, protein = 20): FoodEntry => ({
  id: `${date}-${name}`,
  date,
  meal: 'lunch',
  name,
  grams: 100,
  per100g: { kcal, protein, carbs: 0, fat: 0, fibre: 3 },
  source: 'local',
});

describe('chain detection', () => {
  it('matches the chains the eating-out page is built from', () => {
    expect(new Set(chains.map((c) => c.name))).toEqual(new Set(CHAIN_NAMES));
  });
  it('reads the chain from the name suffix only', () => {
    expect(chainOf("Big Mac (McDonald's)")).toBe("McDonald's");
    expect(chainOf("Bran Flakes (Kellogg's)")).toBeNull();
    expect(chainOf('Chicken (grilled) salad')).toBeNull();
  });
  it('sums calories and share within the window', () => {
    const food = [
      e('2026-10-01', "Big Mac (McDonald's)", 500),
      e('2026-10-01', 'Oats', 500),
      e('2026-10-02', 'Caffè Latte, 2% milk (Starbucks)', 200),
      e('2026-09-01', 'Whopper (Burger King)', 9000),
    ];
    const r = chainShare(food, ['2026-10-01', '2026-10-02']);
    expect(r).toMatchObject({ count: 2, kcal: 700 });
    expect(Math.round(r.share * 100)).toBe(58);
    expect(r.chains).toEqual(["McDonald's", 'Starbucks']);
  });
});

describe('takeaway insight', () => {
  const targets = { kcal: 2000, protein: 120, carbs: 200, fat: 70, fibre: 30 };
  const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
  it('fires with three or more chain items carrying 15%+ of calories', () => {
    const food = dates.flatMap((d, i) => [
      e(d, 'Chicken and rice', 1400, 90),
      ...(i < 3 ? [e(d, "Quarter Pounder with Cheese (McDonald's)", 520, 30)] : []),
    ]);
    const hit = buildInsights(food, [], targets, dates).find((x) => x.key === 'takeaway');
    expect(hit?.title).toMatch(/Chains were 18% of your calories/);
    expect(hit?.detail).toMatch(/3 items from McDonald's/);
  });
  it('stays quiet for one takeaway', () => {
    const food = dates.flatMap((d, i) => [
      e(d, 'Chicken and rice', 1800, 90),
      ...(i === 0 ? [e(d, 'Whopper (Burger King)', 600)] : []),
    ]);
    expect(buildInsights(food, [], targets, dates).some((x) => x.key === 'takeaway')).toBe(false);
  });
});
