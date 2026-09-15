import { describe, expect, it } from 'vitest';
import {
  cmToFeetInches,
  feetInchesToCm,
  formatHeight,
  formatWeight,
  kgToLb,
  lbToKg,
  round,
} from '../units';

describe('units', () => {
  it('converts lb <-> kg symmetrically', () => {
    expect(lbToKg(100)).toBeCloseTo(45.359, 3);
    expect(kgToLb(lbToKg(123.4))).toBeCloseTo(123.4, 6);
  });
  it('converts feet/inches to cm', () => {
    expect(feetInchesToCm(5, 10)).toBeCloseTo(177.8, 6);
    expect(feetInchesToCm(6, 0)).toBeCloseTo(182.88, 6);
  });
  it('splits cm into feet and inches and carries 12 inches', () => {
    expect(cmToFeetInches(177.8)).toEqual({ feet: 5, inches: 10 });
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
    expect(cmToFeetInches(182.4)).toEqual({ feet: 6, inches: 0 }); // 71.8in rounds to 72
  });
  it('rounds without floating-point surprises', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.5)).toBe(3);
    expect(round(1234, -2)).toBe(1200);
  });
  it('formats weight and height in both systems', () => {
    expect(formatWeight(72.46, 'metric')).toBe('72.5 kg');
    expect(formatWeight(72.46, 'imperial')).toBe('159.7 lb');
    expect(formatHeight(177.8, 'metric')).toBe('178 cm');
    expect(formatHeight(177.8, 'imperial')).toBe('5 ft 10 in');
  });
});
