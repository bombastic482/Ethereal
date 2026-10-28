import { describe, expect, it } from 'vitest';
import { lateShare, topFoods } from '../breakdown';
import type { FoodEntry } from '../nutrition';

const e = (date: string, name: string, kcal: number, time?: number): FoodEntry => ({
  id: `${date}-${name}`,
  date,
  meal: 'lunch',
  name,
  grams: 100,
  per100g: { kcal, protein: 10, carbs: 0, fat: 0, fibre: 0 },
  source: 'custom',
  ...(time !== undefined ? { time } : {}),
});

describe('calorie breakdown', () => {
  const food = [
    e('2026-10-01', 'Oats', 300, 8 * 60),
    e('2026-10-02', 'oats ', 300, 8 * 60),
    e('2026-10-02', 'Pizza', 800, 21 * 60 + 30),
    e('2026-10-03', 'Apple', 100),
    e('2026-09-01', 'Old thing', 5000),
  ];
  const days = ['2026-10-01', '2026-10-02', '2026-10-03'];
  it('groups by name ignoring case and whitespace, within the window', () => {
    const t = topFoods(food, days);
    expect(t[0]).toMatchObject({ name: 'Pizza', kcal: 800, count: 1 });
    expect(t[1]).toMatchObject({ name: 'Oats', kcal: 600, count: 2 });
    expect(t.map((x) => x.name)).not.toContain('Old thing');
    expect(Math.round(t.reduce((s, x) => s + x.share, 0) * 100)).toBe(100);
    expect(topFoods([], days)).toEqual([]);
  });
  it('computes the late share only from timed entries', () => {
    expect(lateShare(food, days)).toBeCloseTo(800 / 1400, 3);
    expect(lateShare([e('2026-10-01', 'x', 100)], days)).toBeNull();
  });
});
