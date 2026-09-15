import { describe, expect, it } from 'vitest';
import { calculateProtein } from '../protein';

describe('protein', () => {
  it('fat loss with regular training lands in 1.6–2.2 g/kg', () => {
    const r = calculateProtein({ weightKg: 80, goal: 'lose', training: 'regular' });
    expect(r.low).toBe(128);
    expect(r.high).toBe(176);
    expect(r.target).toBe(152);
    expect(r.gPerKg.target).toBe(1.9);
    expect(r.perMeal).toBe(38);
    expect(r.mealsPerDay).toBe(4);
  });
  it('sedentary maintenance uses RDA-based range', () => {
    const r = calculateProtein({ weightKg: 70, goal: 'maintain', training: 'none' });
    expect(r.gPerKg).toEqual({ low: 0.8, target: 1, high: 1.2 });
  });
  it('raises the floor for adults 65+', () => {
    const r = calculateProtein({ weightKg: 70, goal: 'maintain', training: 'none', age: 70 });
    expect(r.gPerKg.low).toBe(1.2);
    expect(r.rationale).toMatch(/over 65/);
  });
  it('uses lean-adjusted mass above 30% body fat', () => {
    const r = calculateProtein({
      weightKg: 120,
      goal: 'lose',
      training: 'light',
      bodyFatPercent: 40,
    });
    expect(r.usedLeanAdjustment).toBe(true);
    expect(r.referenceKg).toBe(93.6);
    expect(r.target).toBe(159);
  });
  it('clamps meals per day between 2 and 6', () => {
    expect(
      calculateProtein({ weightKg: 80, goal: 'gain', training: 'heavy', mealsPerDay: 1 })
        .mealsPerDay,
    ).toBe(2);
    expect(
      calculateProtein({ weightKg: 80, goal: 'gain', training: 'heavy', mealsPerDay: 9 })
        .mealsPerDay,
    ).toBe(6);
  });
  it('rejects bad weight', () => {
    expect(() => calculateProtein({ weightKg: 0, goal: 'lose', training: 'none' })).toThrow();
  });
});
