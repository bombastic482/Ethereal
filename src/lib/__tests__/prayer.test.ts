import { describe, expect, it } from 'vitest';
import { METHODS, prayerTimes, suggestMethod, type PrayerMethod } from '../prayer';

const hhmm = (d: Date, offsetH: number) => {
  const m = Math.round((d.getTime() / 60000 + offsetH * 60) % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const mins = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60000;

describe('prayer times', () => {
  it('puts solar noon at Greenwich where the equation of time says', () => {
    // Early November the sun runs about 16.4 minutes fast: noon near 11:43:35 UTC.
    const t = prayerTimes('2026-11-01', 51.4769, 0, { method: 'mwl' });
    const utc = t.dhuhr.getUTCHours() * 60 + t.dhuhr.getUTCMinutes() + t.dhuhr.getUTCSeconds() / 60;
    expect(Math.abs(utc - (11 * 60 + 43.6))).toBeLessThan(1);
  });

  it('agrees with a hand calculation for Kuwait City', () => {
    // 1 November, UTC+3: noon = 12:00 − (47.98° × 4 min − 180 min) − 16.4 min ≈ 11:31.7; with
    // declination −14.4° the sunrise hour angle is 82.7°, 5 h 31 min before noon ≈ 06:01.
    const t = prayerTimes('2026-11-01', 29.3759, 47.9774, { method: 'kuwait' });
    const sunrise = hhmm(t.sunrise, 3);
    const dhuhr = hhmm(t.dhuhr, 3);
    expect(dhuhr).toMatch(/^11:3[1-3]$/);
    expect(sunrise).toMatch(/^(05:59|06:0[0-2])$/);
  });

  it('keeps the order of the day and midday between sunrise and sunset', () => {
    for (const method of Object.keys(METHODS) as PrayerMethod[]) {
      const t = prayerTimes('2026-03-20', 21.3891, 39.8579, { method });
      const order = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha].map((d) => d.getTime());
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      const mid = (t.sunrise.getTime() + t.maghrib.getTime()) / 2;
      expect(Math.abs(mid - t.dhuhr.getTime()) / 60000).toBeLessThan(3);
    }
  });

  it('sets Isha by minutes for Umm al-Qura, with 30 more in Ramadan', () => {
    const t = prayerTimes('2026-11-01', 21.3891, 39.8579, { method: 'makkah' });
    expect(Math.round(mins(t.maghrib, t.isha))).toBe(90);
    const r = prayerTimes('2026-11-01', 21.3891, 39.8579, { method: 'makkah', ramadan: true });
    expect(Math.round(mins(r.maghrib, r.isha))).toBe(120);
  });

  it('makes Hanafi Asr later than standard', () => {
    const s = prayerTimes('2026-11-01', 24.86, 67.0, { method: 'karachi' });
    const h = prayerTimes('2026-11-01', 24.86, 67.0, { method: 'karachi', asr: 'hanafi' });
    expect(mins(s.asr, h.asr)).toBeGreaterThan(30);
  });

  it('still gives Fajr and Isha in a northern midsummer', () => {
    const t = prayerTimes('2026-06-21', 59.3293, 18.0686, { method: 'mwl' });
    for (const d of Object.values(t)) expect(Number.isFinite(d.getTime())).toBe(true);
    expect(t.fajr.getTime()).toBeLessThan(t.sunrise.getTime());
    expect(t.isha.getTime()).toBeGreaterThan(t.maghrib.getTime());
  });

  it('suggests local methods', () => {
    expect(suggestMethod(29.37, 47.97)).toBe('kuwait');
    expect(suggestMethod(21.39, 39.86)).toBe('makkah');
    expect(suggestMethod(25.2, 55.27)).toBe('dubai');
    expect(suggestMethod(51.5, -0.12)).toBe('mwl');
    expect(suggestMethod(40.7, -74)).toBe('isna');
  });
});
