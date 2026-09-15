import { describe, expect, it } from 'vitest';
import { humaniseWeeks, projectTimeline } from '../timeline';
import type { BodyProfile } from '../energy';

const male: BodyProfile = { sex: 'male', age: 30, heightCm: 180, weightKg: 90 };
const start = new Date('2026-01-05T00:00:00Z');

describe('timeline projection', () => {
  it('reaches the goal and slows as weight drops', () => {
    const r = projectTimeline({
      profile: male,
      activity: 'moderate',
      goalWeightKg: 80,
      dailyIntake: 2200,
      startDate: start,
    });
    expect(r.reached).toBe(true);
    expect(r.weeksToGoal).toBeGreaterThan(10);
    expect(r.endTdee).toBeLessThan(r.startTdee);
    expect(r.points[0]!.weightKg).toBe(90);
    expect(r.points[r.points.length - 1]!.weightKg).toBe(80);
    // adaptive projection always takes longer than the naive constant-deficit estimate
    expect(r.weeksToGoal!).toBeGreaterThanOrEqual(r.naiveWeeks!);
    expect(r.goalDate!.getTime()).toBe(start.getTime() + r.weeksToGoal! * 7 * 86_400_000);
    // weights strictly decrease
    for (let i = 1; i < r.points.length; i++)
      expect(r.points[i]!.weightKg).toBeLessThan(r.points[i - 1]!.weightKg);
  });
  it('stops when intake is at or above maintenance', () => {
    const r = projectTimeline({
      profile: male,
      activity: 'sedentary',
      goalWeightKg: 80,
      dailyIntake: 3000,
      startDate: start,
    });
    expect(r.reached).toBe(false);
    expect(r.points).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/at or above maintenance/);
  });
  it('flags intakes under the safety floor', () => {
    const r = projectTimeline({
      profile: male,
      activity: 'sedentary',
      goalWeightKg: 85,
      dailyIntake: 1200,
      startDate: start,
    });
    expect(r.warnings.some((w) => w.includes('1500'))).toBe(true);
  });
  it('handles gaining', () => {
    const r = projectTimeline({
      profile: { ...male, weightKg: 70 },
      activity: 'moderate',
      goalWeightKg: 74,
      dailyIntake: 3200,
      startDate: start,
    });
    expect(r.reached).toBe(true);
    expect(r.totalChangeKg).toBeLessThan(0);
  });
  it('respects maxWeeks', () => {
    const r = projectTimeline({
      profile: male,
      activity: 'sedentary',
      goalWeightKg: 60,
      dailyIntake: 2100,
      startDate: start,
      maxWeeks: 10,
    });
    expect(r.reached).toBe(false);
    expect(r.points).toHaveLength(11);
    expect(r.warnings.some((w) => w.includes('not reached'))).toBe(true);
  });
  it('is a no-op when already at goal', () => {
    const r = projectTimeline({
      profile: male,
      activity: 'sedentary',
      goalWeightKg: 90,
      dailyIntake: 2000,
      startDate: start,
    });
    expect(r.reached).toBe(true);
    expect(r.weeksToGoal).toBe(0);
  });
  it('validates inputs', () => {
    expect(() =>
      projectTimeline({
        profile: male,
        activity: 'sedentary',
        goalWeightKg: 10,
        dailyIntake: 2000,
      }),
    ).toThrow();
    expect(() =>
      projectTimeline({ profile: male, activity: 'sedentary', goalWeightKg: 80, dailyIntake: 100 }),
    ).toThrow();
  });
});

describe('humaniseWeeks', () => {
  it('formats durations', () => {
    expect(humaniseWeeks(0)).toBe('less than a week');
    expect(humaniseWeeks(1)).toBe('1 week');
    expect(humaniseWeeks(6)).toBe('6 weeks');
    expect(humaniseWeeks(13)).toBe('3 months');
    expect(humaniseWeeks(15)).toBe('3 months, 2 weeks');
    expect(humaniseWeeks(60)).toBe('1 year, 2 months');
    expect(humaniseWeeks(56)).toBe('1 year, 1 month');
    expect(humaniseWeeks(52)).toBe('1 year');
  });
});
