import { describe, expect, it } from 'vitest';
import { bodyFatCategory, calculateBodyFatNavy } from '../body-fat';

describe('body fat (US Navy)', () => {
  it('computes a plausible male value', () => {
    const r = calculateBodyFatNavy({
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      neckCm: 38,
      waistCm: 85,
    });
    expect(r.percent).toBeCloseTo(16.1, 1);
    expect(r.category).toBe('fitness');
    expect(r.fatMassKg + r.leanMassKg).toBeCloseTo(80, 0);
  });
  it('computes a plausible female value', () => {
    const r = calculateBodyFatNavy({
      sex: 'female',
      heightCm: 165,
      weightKg: 60,
      neckCm: 32,
      waistCm: 72,
      hipCm: 95,
    });
    expect(r.percent).toBeGreaterThan(20);
    expect(r.percent).toBeLessThan(30);
    expect(r.category).toBe('average');
  });
  it('categorises by sex-specific bands', () => {
    expect(bodyFatCategory(10, 'male').category).toBe('athletes');
    expect(bodyFatCategory(10, 'female').category).toBe('essential');
    expect(bodyFatCategory(33, 'female').category).toBe('obese');
  });
  it('rejects invalid geometry', () => {
    expect(() =>
      calculateBodyFatNavy({ sex: 'male', heightCm: 180, weightKg: 80, neckCm: 40, waistCm: 40 }),
    ).toThrow(/Waist/);
    expect(() =>
      calculateBodyFatNavy({ sex: 'female', heightCm: 165, weightKg: 60, neckCm: 32, waistCm: 72 }),
    ).toThrow(/Hip/);
    expect(() =>
      calculateBodyFatNavy({ sex: 'male', heightCm: 180, weightKg: 80, neckCm: 38, waistCm: 38.5 }),
    ).toThrow(/implausible/);
  });
});
