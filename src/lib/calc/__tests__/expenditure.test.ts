import { describe, expect, it } from 'vitest';
import { estimateExpenditure } from '../expenditure';
import { buildInsights } from '../insights';
import type { FoodEntry } from '../nutrition';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);

describe('expenditure estimate', () => {
  it('returns null without enough data', () => {
    expect(estimateExpenditure([], [])).toBeNull();
    const w = Array.from({ length: 5 }, (_, i) => ({ date: day(i), weightKg: 90 - i * 0.05 }));
    expect(estimateExpenditure([{ date: day(0), kcal: 2000 }], w)).toBeNull();
  });
  it('recovers the true TDEE from intake and weight change', () => {
    // True TDEE 2500, eating 2000 → 500 kcal/day deficit → 0.0649 kg/day loss.
    const w = Array.from({ length: 21 }, (_, i) => ({
      date: day(i),
      weightKg: +(90 - (500 / 7700) * i).toFixed(3),
    }));
    const intake = Array.from({ length: 21 }, (_, i) => ({ date: day(i), kcal: 2000 }));
    const e = estimateExpenditure(intake, w, 2300)!;
    expect(e).not.toBeNull();
    // EMA trend lags, so the estimate lands a little under the true value but well above intake.
    expect(e.tdee).toBeGreaterThan(2300);
    expect(e.tdee).toBeLessThan(2550);
    expect(e.days).toBe(21);
    expect(e.confidence).toBe('high');
    expect(e.vsFormula).toBeGreaterThan(0);
    expect(e.note).toMatch(/more than the formula|agree/);
  });
  it('lower confidence with sparse logging', () => {
    const w = Array.from({ length: 21 }, (_, i) => ({ date: day(i), weightKg: 90 - 0.05 * i }));
    const intake = Array.from({ length: 21 }, (_, i) => ({
      date: day(i),
      kcal: i % 2 ? 2000 : 0,
    })).filter((d) => d.kcal > 0);
    const e = estimateExpenditure(intake, w);
    expect(e).not.toBeNull();
    expect(e!.confidence).not.toBe('high');
  });
});

describe('insights', () => {
  const targets = { kcal: 1800, protein: 140, carbs: 180, fat: 60, fibre: 28 };
  const mk = (
    date: string,
    meal: FoodEntry['meal'],
    kcal: number,
    protein: number,
    fibre = 0,
  ): FoodEntry => ({
    id: `${date}-${meal}-${kcal}`,
    date,
    meal,
    name: 'x',
    grams: 100,
    per100g: { kcal, protein, carbs: 0, fat: 0, fibre },
    source: 'quick',
  });
  it('says nothing with little data', () => {
    expect(buildInsights([mk(day(0), 'lunch', 500, 30)], [], targets, [day(0)])).toEqual([]);
  });
  it('detects weekend overshoot and low-protein breakfast', () => {
    const dates = Array.from({ length: 14 }, (_, i) => day(i)); // 2026-01-01 is a Thursday
    const food: FoodEntry[] = [];
    for (const d of dates) {
      const weekend = [0, 6].includes(new Date(`${d}T00:00:00`).getDay());
      food.push(mk(d, 'breakfast', 300, 5, 2));
      food.push(mk(d, 'lunch', 600, 45, 8));
      food.push(mk(d, 'dinner', weekend ? 1300 : 700, 50, 8));
    }
    const ins = buildInsights(food, [], targets, dates);
    expect(ins.find((i) => i.key === 'weekend')?.tone).toBe('warn');
    expect(ins.find((i) => i.key === 'protein-meal')?.title).toMatch(/Breakfast/);
    expect(ins.length).toBeLessThanOrEqual(4);
  });
});
