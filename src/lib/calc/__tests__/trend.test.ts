import { describe, expect, it } from 'vitest';
import {
  assessProgress,
  daysBetween,
  slopeKgPerDay,
  toDay,
  trendSeries,
  weeklyAverages,
  type WeighIn,
} from '../trend';

const day = (i: number) => toDay(new Date(Date.UTC(2026, 0, 1 + i)));
/** Generates daily entries with a linear trend plus deterministic noise. */
const gen = (n: number, start: number, ratePerDay: number, noise = 0.4): WeighIn[] =>
  Array.from({ length: n }, (_, i) => ({
    date: day(i),
    weightKg: +(start + ratePerDay * i + noise * Math.sin(i * 1.7)).toFixed(2),
  }));

describe('dates', () => {
  it('computes whole-day differences', () => {
    expect(daysBetween('2026-01-01', '2026-01-15')).toBe(14);
    expect(daysBetween('2026-03-28', '2026-04-02')).toBe(5);
  });
});

describe('trend series', () => {
  it('smooths noise and sorts by date', () => {
    const entries = gen(30, 90, -0.07).reverse();
    const t = trendSeries(entries);
    expect(t[0]!.date).toBe(day(0));
    expect(t[0]!.trendKg).toBe(entries[entries.length - 1]!.weightKg);
    const last = t[t.length - 1]!;
    expect(Math.abs(last.trendKg - (90 - 0.07 * 29))).toBeLessThan(0.6);
  });
  it('slope reflects the underlying rate', () => {
    const t = trendSeries(gen(40, 90, -0.07, 0));
    const s = slopeKgPerDay(t, 14)!;
    expect(s).toBeLessThan(-0.06);
    expect(s).toBeGreaterThan(-0.08);
    expect(slopeKgPerDay(t.slice(0, 1))).toBeNull();
  });
});

describe('assessProgress', () => {
  const base = {
    plannedRateKgPerWeek: 0.5,
    targetCalories: 1800,
    goalWeightKg: 80,
    startWeightKg: 90,
    floorCalories: 1200,
  };
  it('needs 14 days of data', () => {
    const r = assessProgress({ ...base, entries: gen(5, 90, -0.07) }, day(5));
    expect(r.status).toBe('insufficient-data');
    expect(r.headline).toMatch(/more days/);
    expect(assessProgress({ ...base, entries: [] }).headline).toMatch(/first weigh-in/);
  });
  it('reports on-track when the measured rate matches the plan', () => {
    const r = assessProgress({ ...base, entries: gen(28, 90, -0.5 / 7, 0.3) }, day(28));
    expect(r.status).toBe('on-track');
    expect(r.recommendedCalories).toBeNull();
    expect(r.measuredRateKgPerWeek).toBeGreaterThan(0.3);
    expect(r.lostKg).toBeGreaterThan(1); // EMA trend lags the raw weight by ~1 week
    expect(r.progressPercent).toBeGreaterThan(10);
  });
  it('recommends eating less when too slow', () => {
    const r = assessProgress({ ...base, entries: gen(28, 90, -0.15 / 7, 0.2) }, day(28));
    expect(r.status).toBe('too-slow');
    expect(r.recommendedCalories).toBeLessThan(1800);
    expect(r.adjustmentKcal).toBeLessThanOrEqual(-100);
    expect(r.adjustmentKcal).toBeGreaterThanOrEqual(-250);
  });
  it('points the right way for gain and maintenance goals', () => {
    const gain = { ...base, goalWeightKg: 95, startWeightKg: 90, plannedRateKgPerWeek: 0.25 };
    const flat = assessProgress({ ...gain, entries: gen(28, 90, 0, 0.2) }, day(28));
    expect(flat.status).toBe('stalled');
    expect(flat.adjustmentKcal).toBeGreaterThanOrEqual(100); // eat more, not less
    expect(flat.detail).toMatch(/Raise intake/);
    const fast = assessProgress({ ...gain, entries: gen(28, 90, 0.45 / 7, 0.2) }, day(28));
    expect(fast.status).toBe('too-fast');
    expect(fast.adjustmentKcal).toBeLessThanOrEqual(-100);
    expect(fast.detail).toMatch(/gaining/);
    const slow = assessProgress({ ...gain, entries: gen(28, 90, 0.05 / 7, 0.2) }, day(28));
    expect(['too-slow', 'stalled']).toContain(slow.status);
    expect(slow.adjustmentKcal).toBeGreaterThan(0);
    const losingWhileGaining = assessProgress(
      { ...gain, entries: gen(28, 90, -0.3 / 7, 0.2) },
      day(28),
    );
    expect(losingWhileGaining.status).toBe('gaining'); // moving away from the goal
    expect(losingWhileGaining.headline).toMatch(/falling/);
    expect(losingWhileGaining.adjustmentKcal).toBeGreaterThan(0);

    const keep = { ...base, goalWeightKg: 90, startWeightKg: 90, plannedRateKgPerWeek: 0 };
    const up = assessProgress({ ...keep, entries: gen(28, 90, 0.3 / 7, 0.2) }, day(28));
    expect(up.status).toBe('too-fast');
    expect(up.headline).toMatch(/Gaining while maintaining/);
    expect(up.adjustmentKcal).toBeLessThan(0);
    const down = assessProgress({ ...keep, entries: gen(28, 90, -0.3 / 7, 0.2) }, day(28));
    expect(down.headline).toMatch(/Losing while maintaining/);
    expect(down.adjustmentKcal).toBeGreaterThan(0);
    const steady = assessProgress({ ...keep, entries: gen(28, 90, 0, 0.2) }, day(28));
    expect(steady.status).toBe('on-track');
  });
  it('flags stalls and respects the floor', () => {
    const r = assessProgress(
      { ...base, targetCalories: 1250, entries: gen(28, 90, 0, 0.3) },
      day(28),
    );
    expect(r.status).toBe('stalled');
    expect(r.recommendedCalories).toBe(1200);
    const atFloor = assessProgress(
      { ...base, targetCalories: 1200, entries: gen(28, 90, 0, 0.3) },
      day(28),
    );
    expect(atFloor.recommendedCalories).toBeNull();
    expect(atFloor.detail).toMatch(/floor/);
  });
  it('recommends eating more when too fast', () => {
    const r = assessProgress({ ...base, entries: gen(28, 90, -1.2 / 7, 0.2) }, day(28));
    expect(r.status).toBe('too-fast');
    expect(r.recommendedCalories).toBeGreaterThan(1800);
  });
  it('detects a rising trend', () => {
    const r = assessProgress({ ...base, entries: gen(28, 90, +0.3 / 7, 0.2) }, day(28));
    expect(r.status).toBe('gaining');
  });
  it('supports gaining goals', () => {
    const r = assessProgress(
      {
        ...base,
        goalWeightKg: 95,
        startWeightKg: 90,
        plannedRateKgPerWeek: 0.25,
        entries: gen(28, 90, 0.25 / 7, 0.2),
      },
      day(28),
    );
    expect(r.status).toBe('on-track');
    expect(r.lostKg).toBeGreaterThan(0);
  });
});

describe('weeklyAverages', () => {
  it('buckets into 7-day weeks newest first with change', () => {
    const rows = weeklyAverages(gen(21, 90, -0.1, 0));
    expect(rows).toHaveLength(3);
    expect(rows[0]!.weekStart).toBe(day(14));
    expect(rows[0]!.count).toBe(7);
    expect(rows[0]!.changeKg).toBeCloseTo(-0.7, 1);
    expect(rows[2]!.changeKg).toBeNull();
    expect(weeklyAverages([])).toEqual([]);
  });
});
