import { describe, expect, it } from 'vitest';
import {
  activityMultiplier,
  bmrHarrisBenedict,
  bmrKatchMcArdle,
  bmrMifflin,
  calculateBmr,
  calculateCalorieTarget,
  calculateTdee,
  deficitForRate,
  validateProfile,
  type BodyProfile,
} from '../energy';

const male: BodyProfile = { sex: 'male', age: 30, heightCm: 180, weightKg: 80 };
const female: BodyProfile = { sex: 'female', age: 30, heightCm: 165, weightKg: 60 };

describe('bmr formulas', () => {
  it('Mifflin-St Jeor matches published values', () => {
    expect(bmrMifflin(male)).toBeCloseTo(1780, 0); // 800 + 1125 - 150 + 5
    expect(bmrMifflin(female)).toBeCloseTo(1320.25, 2); // 600 + 1031.25 - 150 - 161
  });
  it('Harris-Benedict (revised) matches published values', () => {
    expect(bmrHarrisBenedict(male)).toBeCloseTo(1853.6, 1);
    expect(bmrHarrisBenedict(female)).toBeCloseTo(1383.7, 1);
  });
  it('Katch-McArdle uses lean mass and requires body fat', () => {
    expect(bmrKatchMcArdle({ ...male, bodyFatPercent: 15 })).toBeCloseTo(370 + 21.6 * 68, 5);
    expect(() => bmrKatchMcArdle(male)).toThrow(RangeError);
  });
  it('calculateBmr dispatches and rounds', () => {
    expect(calculateBmr(male)).toBe(1780);
    expect(calculateBmr(male, 'harris')).toBe(1854);
    expect(calculateBmr({ ...male, bodyFatPercent: 15 }, 'katch')).toBe(1839);
  });
});

describe('tdee', () => {
  it('applies activity multipliers', () => {
    expect(activityMultiplier('sedentary')).toBe(1.2);
    expect(activityMultiplier('very-active')).toBe(1.9);
    expect(calculateTdee(male, 'moderate')).toBe(2759); // 1780 * 1.55
  });
});

describe('calorie target', () => {
  it('produces a standard 0.5 kg/week deficit', () => {
    const r = calculateCalorieTarget({
      profile: male,
      activity: 'moderate',
      goal: 'lose',
      rateKgPerWeek: 0.5,
    });
    expect(r.tdee).toBe(2759);
    expect(r.requestedDelta).toBe(550);
    expect(r.target).toBe(2209);
    expect(r.dailyDelta).toBe(550);
    expect(r.achievableRateKgPerWeek).toBe(0.5);
    expect(r.warnings).toHaveLength(0);
  });
  it('caps the deficit at 25% of TDEE', () => {
    const r = calculateCalorieTarget({
      profile: male,
      activity: 'sedentary',
      goal: 'lose',
      rateKgPerWeek: 1.5,
    });
    expect(r.tdee).toBe(2136);
    expect(r.dailyDelta).toBe(550); // 25% would be 534; the 550 kcal standard is always allowed
    expect(r.target).toBe(1586);
    expect(r.warnings[0]).toMatch(/capped/);
  });
  it('always allows the standard 550 kcal deficit even when 25% of TDEE is less', () => {
    const r = calculateCalorieTarget({
      profile: female,
      activity: 'sedentary',
      goal: 'lose',
      rateKgPerWeek: 0.5,
    });
    expect(r.tdee).toBe(1584);
    expect(r.dailyDelta).toBe(384); // floor of 1200 binds before the 500 cap
    expect(r.target).toBe(1200);
    const r2 = calculateCalorieTarget({
      profile: { ...female, weightKg: 78, heightCm: 168, age: 35 },
      activity: 'light',
      goal: 'lose',
      rateKgPerWeek: 0.5,
    });
    expect(r2.tdee).toBe(2054);
    expect(r2.dailyDelta).toBe(550);
    expect(r2.warnings).toHaveLength(0);
  });
  it('never goes below the sex-specific floor', () => {
    const small: BodyProfile = { sex: 'female', age: 55, heightCm: 155, weightKg: 50 };
    const r = calculateCalorieTarget({
      profile: small,
      activity: 'sedentary',
      goal: 'lose',
      rateKgPerWeek: 1,
    });
    expect(r.target).toBeGreaterThanOrEqual(1200);
    expect(r.warnings.some((w) => w.includes('1200'))).toBe(true);
  });
  it('maintains and gains', () => {
    const m = calculateCalorieTarget({
      profile: male,
      activity: 'light',
      goal: 'maintain',
      rateKgPerWeek: 0.5,
    });
    expect(m.target).toBe(m.tdee);
    expect(m.dailyDelta).toBe(0);
    const g = calculateCalorieTarget({
      profile: male,
      activity: 'light',
      goal: 'gain',
      rateKgPerWeek: 0.25,
    });
    expect(g.target).toBe(g.tdee + 275);
    const big = calculateCalorieTarget({
      profile: male,
      activity: 'light',
      goal: 'gain',
      rateKgPerWeek: 1,
    });
    expect(big.target).toBe(big.tdee + 500);
    expect(big.warnings[0]).toMatch(/capped/);
  });
  it('supports alternative formulas', () => {
    const r = calculateCalorieTarget({
      profile: { ...male, bodyFatPercent: 15 },
      activity: 'moderate',
      goal: 'maintain',
      rateKgPerWeek: 0,
      formula: 'katch',
    });
    expect(r.bmr).toBe(1839);
  });
});

describe('validation', () => {
  it('rejects implausible profiles', () => {
    expect(() => validateProfile({ ...male, age: 5 })).toThrow();
    expect(() => validateProfile({ ...male, heightCm: 90 })).toThrow();
    expect(() => validateProfile({ ...male, weightKg: 500 })).toThrow();
    expect(() => validateProfile({ ...male, bodyFatPercent: 1 })).toThrow();
    expect(() => validateProfile(male)).not.toThrow();
  });
  it('deficitForRate converts kg/week to kcal/day', () => {
    expect(deficitForRate(0.5)).toBe(550);
    expect(deficitForRate(1)).toBe(1100);
    expect(deficitForRate(5)).toBe(2200); // clamped at 2 kg/week
  });
});
