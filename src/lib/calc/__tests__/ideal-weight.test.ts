import { describe, expect, it } from 'vitest';
import { calculateIdealWeight } from '../ideal-weight';

describe('ideal weight', () => {
  it('matches published formula values for a 5ft10 man', () => {
    const r = calculateIdealWeight(177.8, 'male');
    expect(r.devine).toBe(73);
    expect(r.robinson).toBe(71);
    expect(r.miller).toBe(70.3);
    expect(r.hamwi).toBe(75);
    expect(r.average).toBe(72.3);
    expect(r.bmiRange).toEqual({ min: 58.5, max: 78.7 });
  });
  it('matches published formula values for a 5ft4 woman', () => {
    const r = calculateIdealWeight(162.56, 'female');
    expect(r.devine).toBe(54.7);
    expect(r.robinson).toBe(55.8);
    expect(r.miller).toBe(58.5);
    expect(r.hamwi).toBe(54.3);
  });
  it('flags extrapolation under 5 ft', () => {
    const r = calculateIdealWeight(150, 'female');
    expect(r.notes[0]).toMatch(/extrapolated/);
    expect(r.devine).toBeGreaterThan(0);
  });
  it('rejects non-positive height', () => {
    expect(() => calculateIdealWeight(0, 'male')).toThrow(RangeError);
  });
});
