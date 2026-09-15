import { describe, expect, it } from 'vitest';
import { calculateHydration } from '../hydration';

describe('hydration', () => {
  it('uses 35 ml/kg baseline', () => {
    const r = calculateHydration({ weightKg: 80, exerciseMinutes: 0, climate: 'temperate' });
    expect(r.baselineMl).toBe(2800);
    expect(r.totalMl).toBe(2800);
    expect(r.glasses).toBe(11);
    expect(r.rangeMl).toEqual({ min: 2500, max: 3100 });
  });
  it('adds exercise, climate and pregnancy allowances', () => {
    const r = calculateHydration({
      weightKg: 60,
      exerciseMinutes: 60,
      climate: 'hot',
      pregnantOrBreastfeeding: true,
    });
    expect(r.exerciseMl).toBe(720);
    expect(r.climateMl).toBe(500);
    expect(r.extraMl).toBe(500);
    expect(r.totalMl).toBe(2100 + 720 + 500 + 500);
  });
  it('caps exercise minutes and warns on very high totals', () => {
    const r = calculateHydration({ weightKg: 120, exerciseMinutes: 600, climate: 'hot' });
    expect(r.exerciseMl).toBe(2880);
    expect(r.notes[0]).toMatch(/Very high/);
  });
  it('rejects bad input', () => {
    expect(() =>
      calculateHydration({ weightKg: 0, exerciseMinutes: 0, climate: 'temperate' }),
    ).toThrow();
    expect(() =>
      calculateHydration({ weightKg: 70, exerciseMinutes: -5, climate: 'temperate' }),
    ).toThrow();
  });
});
