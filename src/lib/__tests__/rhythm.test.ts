import { describe, expect, it } from 'vitest';
import { rhythm, showedUp, showedUpSince, type RhythmInput } from '../rhythm';

const empty: RhythmInput = {
  foodDates: [],
  exerciseDates: [],
  steps: {},
  checkinDates: [],
  weighDates: [],
  ticks: {},
};

describe('rhythm', () => {
  it('covers whole Monday-to-Sunday weeks ending with the current one', () => {
    // 2026-11-04 is a Wednesday.
    const days = rhythm(empty, '2026-11-04', 2);
    expect(days).toHaveLength(14);
    expect(days[0]!.date).toBe('2026-10-26');
    expect(days.at(-1)!.date).toBe('2026-11-08');
    expect(days.filter((d) => d.future).map((d) => d.date)).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('scores the four habits from the data', () => {
    const days = rhythm(
      {
        foodDates: ['2026-11-02', '2026-11-03'],
        exerciseDates: ['2026-11-02'],
        steps: { '2026-11-03': 6200, '2026-11-04': 1200 },
        checkinDates: ['2026-11-02'],
        weighDates: ['2026-11-04'],
        ticks: { '2026-11-02': ['a', 'b', 'c'], '2026-11-03': ['a'] },
      },
      '2026-11-04',
      1,
    );
    const by = Object.fromEntries(days.map((d) => [d.date, d]));
    expect(by['2026-11-02']!.score).toBe(4);
    expect(by['2026-11-03']!.habits).toEqual({
      ate: true,
      moved: true,
      checked: false,
      plan: false,
    });
    expect(by['2026-11-04']!.score).toBe(1);
  });

  it('never counts the future', () => {
    const days = rhythm({ ...empty, foodDates: ['2026-11-06'] }, '2026-11-04', 1);
    expect(days.find((d) => d.date === '2026-11-06')!.score).toBe(0);
  });

  it('counts days with at least two habits as showing up', () => {
    const days = rhythm(
      { ...empty, foodDates: ['2026-11-02', '2026-11-03'], weighDates: ['2026-11-02'] },
      '2026-11-04',
      1,
    );
    expect(showedUp(days, 7)).toEqual({ days: 1, of: 3 });
  });

  it('is fair to someone who only just started', () => {
    // First entry today, one habit so far: nothing is held against them yet.
    const first = rhythm({ ...empty, weighDates: ['2026-11-04'] }, '2026-11-04', 4);
    expect(showedUpSince(first, '2026-11-04')).toEqual({ days: 0, of: 0, since: true });
    // Three days in, two of them held, today still going.
    const three = rhythm(
      {
        ...empty,
        foodDates: ['2026-11-02', '2026-11-03', '2026-11-04'],
        weighDates: ['2026-11-02', '2026-11-03'],
      },
      '2026-11-04',
      4,
    );
    expect(showedUpSince(three, '2026-11-02')).toEqual({ days: 2, of: 2, since: true });
    // An old hand reads the plain last-28-days figure.
    expect(showedUpSince(three, '2025-01-01')).toEqual({ ...showedUp(three), since: false });
  });
});
