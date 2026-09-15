import { describe, expect, it } from 'vitest';
import { MACRO_PRESETS, macrosFromSplit, macrosProteinFirst, normaliseSplit } from '../macros';

describe('macros', () => {
  it('all presets sum to 100', () => {
    for (const p of MACRO_PRESETS) {
      expect(p.split.protein + p.split.carbs + p.split.fat).toBe(100);
    }
  });
  it('normalises arbitrary splits', () => {
    expect(normaliseSplit({ protein: 2, carbs: 2, fat: 1 })).toEqual({
      protein: 40,
      carbs: 40,
      fat: 20,
    });
    expect(normaliseSplit({ protein: 0, carbs: 0, fat: 0 })).toEqual({
      protein: 30,
      carbs: 40,
      fat: 30,
    });
  });
  it('splits calories into grams using 4/4/9', () => {
    const r = macrosFromSplit(2000, { protein: 30, carbs: 40, fat: 30 }, 80);
    expect(r.grams).toEqual({ protein: 150, carbs: 200, fat: 67, fibre: 28 });
    expect(r.kcal).toEqual({ protein: 600, carbs: 800, fat: 600 });
    expect(r.gramsPerKg.protein).toBe(1.88);
  });
  it('protein-first fills carbs with the remainder', () => {
    const r = macrosProteinFirst(2000, 80, 2, 30);
    expect(r.grams.protein).toBe(160); // 640 kcal
    expect(r.grams.fat).toBe(67); // 600 kcal
    expect(r.grams.carbs).toBe(190); // 760 kcal
    expect(r.split.protein + r.split.carbs + r.split.fat).toBeCloseTo(100, 0);
  });
  it('protein-first shrinks fat when calories are too low', () => {
    const r = macrosProteinFirst(800, 100, 2.4, 40); // protein alone = 960 kcal
    expect(r.grams.carbs).toBe(0);
    expect(r.grams.fat).toBe(0);
    expect(r.grams.protein).toBe(240);
  });
  it('rejects non-positive calories', () => {
    expect(() => macrosFromSplit(0, { protein: 30, carbs: 40, fat: 30 })).toThrow(RangeError);
  });
});
