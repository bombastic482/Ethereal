import { describe, expect, it } from 'vitest';
import { bmiCategory, calculateBmi } from '../bmi';

describe('bmi', () => {
  it('computes BMI and category', () => {
    const r = calculateBmi(70, 175);
    expect(r.bmi).toBe(22.9);
    expect(r.category).toBe('healthy');
    expect(r.healthyRangeKg).toEqual({ min: 56.7, max: 76.3 });
    expect(r.deltaToHealthyKg).toBe(0);
    expect(r.ponderalIndex).toBe(13.1);
  });
  it('classifies boundaries exactly', () => {
    expect(bmiCategory(18.49).category).toBe('underweight');
    expect(bmiCategory(18.5).category).toBe('healthy');
    expect(bmiCategory(24.99).category).toBe('healthy');
    expect(bmiCategory(25).category).toBe('overweight');
    expect(bmiCategory(30).category).toBe('obese-1');
    expect(bmiCategory(35).category).toBe('obese-2');
    expect(bmiCategory(40).category).toBe('obese-3');
    expect(bmiCategory(80).category).toBe('obese-3');
  });
  it('reports kg to lose or gain to reach the healthy range', () => {
    expect(calculateBmi(95, 175).deltaToHealthyKg).toBeCloseTo(18.7, 1);
    expect(calculateBmi(50, 175).deltaToHealthyKg).toBeCloseTo(-6.7, 1);
  });
  it('clamps the gauge to 0–100', () => {
    expect(calculateBmi(30, 200).gaugePercent).toBe(0);
    expect(calculateBmi(200, 150).gaugePercent).toBe(100);
  });
  it('rejects non-positive inputs', () => {
    expect(() => calculateBmi(0, 175)).toThrow(RangeError);
    expect(() => calculateBmi(70, -1)).toThrow(RangeError);
  });
});
