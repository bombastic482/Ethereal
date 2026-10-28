import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectColumns, mapMeal, parseCsv, parseDate, previewImport } from '../import-csv';

function installWindow() {
  const bag = new Map<string, string>();
  const ls = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => void bag.set(k, v),
    removeItem: (k: string) => void bag.delete(k),
  };
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: ls,
    addEventListener() {},
    removeEventListener() {},
  };
}

const MFP = `Date,Meal,Calories,Fat (g),Saturated Fat,Polyunsaturated Fat,Monounsaturated Fat,Trans Fat,Cholesterol,Sodium (mg),Potassium,Carbohydrates (g),Fiber,Sugar,Protein (g),Vitamin A,Vitamin C,Calcium,Iron,Note
2026-10-01,Breakfast,412,9,3,1,2,0,180,400,300,48,6,12,30,10,2,20,8,
2026-10-01,Lunch,586,18,5,,,,,,,55,8,9,42,,,,,
2026-10-01,Snacks,180,6,,,,,,,,20,2,8,12,,,,,
2026-10-02,Dinner,640,22,,,,,,,,60,7,6,45,,,,,"Late, after the gym"
`;
const LOSEIT = `Date,Name,Icon,Type,Quantity,Units,Calories,Fat (g),Protein (g),Carbohydrates (g),Saturated Fat (g),Sugars (g),Fiber (g),Cholesterol (mg),Sodium (mg)
10/03/2026,Greek Yogurt (Fage),Default,Breakfast,1,Container,100,0,18,6,0,6,0,10,60
10/03/2026,"Chicken, grilled",Default,Lunch,150,Grams,247,5,46,0,1,0,0,128,110
10/03/2026,Walk,Exercise,Exercise,30,Minutes,-120,0,0,0,0,0,0,0,0
`;
const CRONO = `Day,Group,Food Name,Amount,Energy (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g)
2026-10-04,Dinner,"Salmon, Atlantic, cooked",150 g,312,34,0,19,0
2026-10-04,Dinner,"Rice, brown, cooked",180 g,200,4.5,41,1.6,3.2
`;
const WEIGHTS = `Date,Weight
2026-10-01,195.4
2026-10-02,194.8
2026-10-03,195.0
`;

describe('csv parsing', () => {
  it('handles quotes, CRLF, BOM and semicolons', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
    expect(parseCsv('a;b\n1;2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('recognises columns across apps and parses dates', () => {
    const mfp = detectColumns(MFP.split('\n')[0]!.split(','));
    expect(mfp).toMatchObject({
      date: 0,
      meal: 1,
      kcal: 2,
      fat: 3,
      carbs: 11,
      fibre: 12,
      protein: 14,
    });
    expect(parseDate('10/03/2026')).toBe('2026-10-03');
    expect(parseDate('23/03/2026')).toBe('2026-03-23');
    expect(parseDate('October 3, 2026')).toBe('2026-10-03');
    expect(parseDate('2026-10-03T07:30:00Z')).toBe('2026-10-03');
    expect(parseDate('nonsense')).toBeNull();
    expect(mapMeal('Snacks')).toBe('snack');
    expect(mapMeal('', '07:45')).toBe('breakfast');
  });
});

describe('import preview', () => {
  beforeEach(() => {
    installWindow();
    vi.resetModules();
  });
  it('maps MyFitnessPal per-meal totals into entries', () => {
    const p = previewImport(MFP)!;
    expect(p.source).toBe('MyFitnessPal');
    expect(p.food).toHaveLength(4);
    expect(p.days).toBe(2);
    expect(p.food[0]).toMatchObject({ date: '2026-10-01', meal: 'breakfast', grams: 100 });
    expect(p.food[0]!.per100g).toMatchObject({
      kcal: 412,
      protein: 30,
      carbs: 48,
      fat: 9,
      fibre: 6,
    });
    expect(p.food[0]!.per100g.sugar).toBe(12);
    expect(p.food[3]!.name).toMatch(/dinner/i);
  });
  it('maps Lose It! rows, keeps names and skips exercise rows', () => {
    const p = previewImport(LOSEIT)!;
    expect(p.source).toBe('Lose It!');
    expect(p.food.map((e) => e.name)).toEqual(['Greek Yogurt (Fage)', 'Chicken, grilled']);
    expect(p.food[1]!.per100g.protein).toBe(46);
    expect(p.skipped).toBe(1);
  });
  it('maps Cronometer rows', () => {
    const p = previewImport(CRONO)!;
    expect(p.source).toBe('Cronometer');
    expect(p.food).toHaveLength(2);
    expect(p.food[0]!.per100g.kcal).toBe(312);
  });
  it('imports weights, guessing pounds from magnitude, and merges without duplicates', async () => {
    const p = previewImport(WEIGHTS)!;
    expect(p.weightUnit).toBe('lb');
    expect(p.weighIns).toHaveLength(3);
    expect(p.weighIns[0]!.weightKg).toBeCloseTo(88.6, 1);
    const { applyImport } = await import('../import-csv');
    const { logStore } = await import('../log');
    const { diaryStore } = await import('../food-store');
    expect(applyImport(p)).toEqual({ food: 0, weighIns: 3 });
    expect(applyImport(p)).toEqual({ food: 0, weighIns: 0 });
    expect(logStore.get().entries).toHaveLength(3);
    const m = previewImport(MFP)!;
    expect(applyImport(m).food).toBe(4);
    expect(applyImport(m).food).toBe(0);
    expect(diaryStore.get().food).toHaveLength(4);
  });
  it('rejects files without a date column or any usable rows', () => {
    expect(previewImport('a,b\n1,2\n')).toBeNull();
    expect(previewImport('Date,Calories\nnonsense,abc\n')).toBeNull();
  });
});
