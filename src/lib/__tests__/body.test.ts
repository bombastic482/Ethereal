import { describe, expect, it } from 'vitest';
import { achievements, ordered } from '../achievements';
import { composition, navyFor, targetWeight, waistToHeight, weightOn, type Measure } from '../body';
import type { WeighIn } from '../calc/trend';
import type { WorkoutLog } from '../train/store';

const man = { sex: 'male' as const, heightCm: 178 };
const day = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 864e5).toISOString().slice(0, 10);

describe('body composition', () => {
  it('estimates body fat from the tape with the Navy method', () => {
    // A 92 kg man, waist 103 cm at the navel and neck 40 cm: about 29%.
    const bf = navyFor({ date: day(0), neckCm: 40, waistCm: 103 }, man, 92);
    expect(bf).toBeGreaterThan(26);
    expect(bf).toBeLessThan(32);
    // Missing a site: no estimate, not a wrong one.
    expect(navyFor({ date: day(0), waistCm: 103 }, man, 92)).toBeNull();
    expect(
      navyFor(
        { date: day(0), neckCm: 34, waistNarrowCm: 80 },
        { sex: 'female', heightCm: 165 },
        70,
      ),
    ).toBeNull();
  });

  it('weighs each session at that day’s trend weight and keeps sources apart', () => {
    const entries: WeighIn[] = [
      { date: day(0), weightKg: 92, bodyFatPct: 33 },
      { date: day(14), weightKg: 90.5 },
      { date: day(28), weightKg: 89.6, bodyFatPct: 31.5 },
    ];
    const measures: Measure[] = [
      { date: day(1), neckCm: 40, waistCm: 103 },
      { date: day(29), neckCm: 40, waistCm: 99 },
    ];
    expect(weightOn(entries, day(1))).toBe(92);
    const pts = composition(measures, entries, man);
    expect(pts.map((p) => p.source)).toEqual(['scale', 'tape', 'scale', 'tape']);
    const tape = pts.filter((p) => p.source === 'tape');
    expect(tape[1]!.bodyFat).toBeLessThan(tape[0]!.bodyFat);
    expect(tape[1]!.fatKg + tape[1]!.leanKg).toBeCloseTo(tape[1]!.weightKg, 1);
  });

  it('finds the weight for a target at today’s lean mass', () => {
    // 92 kg at 30% is 64.4 kg lean; 15% body fat at that lean mass is about 75.8 kg.
    expect(targetWeight(64.4, 15)).toBe(75.8);
    expect(waistToHeight(89, 178)).toBe(0.5);
  });
});

describe('achievements', () => {
  const workout = (n: number, ids: string[] = ['knee-push-up']): WorkoutLog => ({
    id: String(n),
    date: day(n),
    session: 'A',
    week: 1,
    minutes: 25,
    kcal: 120,
    sets: ids.map((exerciseId) => ({ exerciseId, value: 10 })),
  });

  it('dates training milestones and shows progress toward the rest', () => {
    const workouts = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23].map((n) => workout(n));
    const list = achievements({
      entries: [],
      workouts,
      foodDates: [],
      measures: [],
      composition: [],
      sex: 'male',
    });
    const by = Object.fromEntries(list.map((a) => [a.id, a]));
    expect(by['workout-1']!.on).toBe(day(0));
    expect(by['workout-10']!.on).toBe(day(21));
    expect(by['workout-30']!.progress).toBeCloseTo(11 / 30);
    expect(by['weeks-4']!.on).not.toBeNull();
    expect(by['push-up']!.on).toBeNull();
    expect(by['push-up']!.progress).toBeGreaterThan(0.5);
  });

  it('marks the first full push-up and scale milestones from the trend', () => {
    const entries: WeighIn[] = Array.from({ length: 60 }, (_, i) => ({
      date: day(i),
      weightKg: 92 - i * 0.1,
    }));
    const list = achievements({
      entries,
      workouts: [workout(3), workout(40, ['push-up'])],
      foodDates: entries.map((e) => e.date),
      measures: [],
      composition: [],
      sex: 'male',
    });
    const by = Object.fromEntries(list.map((a) => [a.id, a]));
    expect(by['push-up']!.on).toBe(day(40));
    expect(by['kg-2']!.on).not.toBeNull();
    expect(by['log-30']!.on).toBe(day(29));
    const sorted = ordered(list);
    expect(sorted[0]!.on).not.toBeNull();
    expect(sorted.findIndex((a) => !a.on)).toBeGreaterThan(sorted.findLastIndex((a) => !!a.on));
  });
});
