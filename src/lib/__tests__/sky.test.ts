import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENTS, arcProgress, eventsFrom, moonPhase, nightness, skyColors } from '../sky';

const e = DEFAULT_EVENTS;

describe('sky', () => {
  const L = (c: string) => Number(/oklch\(([\d.]+)%/.exec(c)![1]);
  const H = (c: string) => Number(/oklch\([\d.]+% [\d.]+ ([\d.]+)\)/.exec(c)![1]);

  it('is deep indigo at midnight and an airy blue at noon, dark enough for white text', () => {
    const night = skyColors(0, e).top;
    const noon = skyColors(e.noon, e);
    expect(L(night)).toBeLessThan(30);
    expect(H(noon.top)).toBeGreaterThan(220);
    expect(H(noon.top)).toBeLessThan(260);
    for (let m = 0; m < 1440; m += 5) expect(L(skyColors(m, e).top)).toBeLessThanOrEqual(61);
    expect(L(noon.horizon)).toBeGreaterThan(90);
  });

  it('blends smoothly between stops and wraps the day', () => {
    expect(skyColors(1440 + e.noon, e)).toEqual(skyColors(e.noon, e));
    expect(skyColors(-60, e)).toEqual(skyColors(1380, e));
    const a = skyColors(e.sunset - 1, e).horizon;
    const b = skyColors(e.sunset, e).horizon;
    expect(Math.abs(L(a) - L(b))).toBeLessThan(1);
  });

  it('darkens through twilight', () => {
    expect(nightness(e.noon, e)).toBe(0);
    expect(nightness(e.dusk + 5, e)).toBe(1);
    const mid = nightness((e.sunset + e.dusk) / 2, e);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });

  it('puts the sun up by day and the moon up by night, never both', () => {
    for (let m = 0; m < 1440; m += 7) {
      const sun = arcProgress(m, e, 'sun');
      const moon = arcProgress(m, e, 'moon');
      expect((sun === null) !== (moon === null)).toBe(true);
      for (const p of [sun, moon]) if (p !== null) expect(p).toBeGreaterThanOrEqual(0);
      for (const p of [sun, moon]) if (p !== null) expect(p).toBeLessThanOrEqual(1);
    }
    expect(arcProgress(e.noon, e, 'sun')).toBeCloseTo(
      (e.noon - e.sunrise) / (e.sunset - e.sunrise),
    );
  });

  it('keeps events in order from awkward prayer times', () => {
    const ev = eventsFrom({ fajr: 200, sunrise: 180, dhuhr: 150, maghrib: 170, isha: 160 });
    expect(ev.dawn).toBeLessThan(ev.sunrise);
    expect(ev.noon).toBeGreaterThan(ev.sunrise);
    expect(ev.sunset).toBeGreaterThan(ev.noon);
    expect(ev.dusk).toBeGreaterThan(ev.sunset);
  });

  it('knows a full moon from a new one', () => {
    expect(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)))).toBeCloseTo(0, 3);
    // 21 Jan 2000 was a full moon (a total lunar eclipse).
    expect(moonPhase(new Date(Date.UTC(2000, 0, 21, 4, 40)))).toBeCloseTo(0.5, 1);
  });
});
