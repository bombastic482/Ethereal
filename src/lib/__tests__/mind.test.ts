import { describe, expect, it } from 'vitest';
import {
  averages,
  daysAway,
  guardrails,
  isComeback,
  isGentleDay,
  type GuardrailInput,
} from '../mind';

const day = (n: number) => new Date(Date.UTC(2026, 10, 30) - n * 864e5).toISOString().slice(0, 10);
const today = day(0);
const base: GuardrailInput = {
  today,
  workouts: [],
  feels: [],
  intake: {},
  floorKcal: 1500,
  lossPerWeekKg: -0.5,
  weightKg: 90,
  checkins: [],
};

describe('mind and momentum', () => {
  it('spots a gentle day from mood, energy or a short night', () => {
    expect(isGentleDay({ date: today, mood: 2, energy: 4 })).toBe(true);
    expect(isGentleDay({ date: today, mood: 4, energy: 2 })).toBe(true);
    expect(isGentleDay({ date: today, mood: 4, energy: 4, sleepH: 4.5 })).toBe(true);
    expect(isGentleDay({ date: today, mood: 3, energy: 3, sleepH: 7 })).toBe(false);
    expect(isGentleDay(undefined)).toBe(false);
  });

  it('knows when you are coming back, but not when you are new', () => {
    expect(daysAway([], today)).toBeNull();
    expect(isComeback(daysAway([day(9), day(5)], today))).toBe(true);
    expect(isComeback(daysAway([day(9), day(1)], today))).toBe(false);
    expect(isComeback(null)).toBe(false);
  });

  it('stays quiet when things are fine', () => {
    expect(guardrails(base)).toEqual([]);
  });

  it('speaks up for overtraining, hard sessions, under-eating, fast loss and a low week', () => {
    const ids = guardrails({
      ...base,
      workouts: [0, 1, 2, 3, 4, 5, 6].map(day),
      feels: [2, 3, 3, 3],
      intake: { [day(1)]: 1100, [day(2)]: 1050, [day(3)]: 980 },
      lossPerWeekKg: -1.2,
      checkins: [0, 1, 2, 3].map((n) => ({ date: day(n), mood: 2, energy: 3 })),
    }).map((g) => g.id);
    expect(ids).toEqual(['rest', 'hard', 'under', 'fast', 'low']);
  });

  it('averages the week', () => {
    expect(
      averages(
        [
          { date: day(1), mood: 4, energy: 2 },
          { date: day(10), mood: 1, energy: 1 },
        ],
        today,
      ),
    ).toEqual({
      mood: 4,
      energy: 2,
      count: 1,
    });
  });
});
