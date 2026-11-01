import { describe, expect, it } from 'vitest';
import { buildDay, missedItems, nowItem, workoutSlot, type DayContext } from '../day';
import { DEFAULT_LIFE, toMinutes, type Life } from '../life';
import { prayerTimes } from '../prayer';

// Kuwait is UTC+3 all year: fix the zone so tests do not depend on the machine.
const kuwait = (d: Date) => (d.getUTCHours() * 60 + d.getUTCMinutes() + 180) % 1440;

const ctx = (over: Partial<DayContext> = {}, life: Partial<Life> = {}): DayContext => ({
  date: '2026-11-06',
  weekday: 5,
  life: { ...DEFAULT_LIFE, ...life },
  prayers: null,
  trainingDay: true,
  trained: false,
  sessionMinutes: 30,
  walkMinutes: 20,
  logged: new Set(),
  weighed: false,
  photoDue: false,
  ticks: new Set(),
  minutesOf: kuwait,
  ...over,
});

describe('today plan', () => {
  it('lays out a day in time order from wake to sleep', () => {
    const day = buildDay(ctx());
    expect(day[0]!.kind).toBe('wake');
    expect(day[day.length - 1]!.kind).toBe('sleep');
    const times = day.map((i) => (toMinutes(i.time) - 390 + 1440) % 1440);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(day.map((i) => i.kind)).toEqual(
      expect.arrayContaining(['meal', 'workout', 'weigh', 'wind']),
    );
  });

  it('puts the workout before dinner, clear of meals and busy blocks', () => {
    const life = { ...DEFAULT_LIFE };
    const start = workoutSlot(life, 1, 30);
    expect(start + 30).toBeLessThanOrEqual(toMinutes(life.meals.dinner) - 30);
    const busy = {
      ...life,
      busy: [{ id: 'w', label: 'Work', start: '08:30', end: '19:30', days: [1] }],
      meals: { ...life.meals, dinner: '20:30' },
    };
    const late = workoutSlot(busy, 1, 30);
    expect(late).toBeGreaterThanOrEqual(toMinutes('19:30'));
    expect(late + 30).toBeLessThanOrEqual(toMinutes('20:00'));
  });

  it('marks meals and the weigh-in done from what was logged, and keeps hand ticks', () => {
    const day = buildDay(
      ctx({ logged: new Set(['breakfast']), weighed: true, ticks: new Set(['wake']) }),
    );
    const byId = Object.fromEntries(day.map((i) => [i.id, i]));
    expect(byId['meal-breakfast']).toMatchObject({ done: true, auto: true });
    expect(byId['meal-lunch']?.done).toBe(false);
    expect(byId['weigh']).toMatchObject({ done: true, auto: true });
    expect(byId['wake']).toMatchObject({ done: true, auto: false });
  });

  it('offers a walk on rest days and no weigh-in off the weigh day', () => {
    const day = buildDay(ctx({ trainingDay: false, weekday: 2 }));
    expect(day.some((i) => i.kind === 'walk')).toBe(true);
    expect(day.some((i) => i.kind === 'workout' || i.kind === 'weigh')).toBe(false);
  });

  it('adds prayers and medicine doses at their times', () => {
    const prayers = prayerTimes('2026-11-06', 29.3759, 47.9774, { method: 'kuwait' });
    const day = buildDay(
      ctx(
        { prayers },
        { meds: [{ id: 'd', name: 'Vitamin D', dose: '1000 IU', rule: 'with-food', times: [] }] },
      ),
    );
    expect(day.filter((i) => i.kind === 'prayer').map((i) => i.title)).toEqual([
      'Fajr',
      'Dhuhr',
      'Asr',
      'Maghrib',
      'Isha',
    ]);
    const med = day.find((i) => i.kind === 'med');
    expect(med).toMatchObject({ time: '08:00', title: 'Vitamin D', detail: '1000 IU, with food' });
    // The workout is never on top of a prayer.
    const w = day.find((i) => i.kind === 'workout')!;
    for (const p of day.filter((i) => i.kind === 'prayer')) {
      const pm = toMinutes(p.time);
      expect(
        pm < toMinutes(w.time) - 5 || pm >= toMinutes(w.end!) + 15 || pm + 15 <= toMinutes(w.time),
      ).toBe(true);
    }
  });

  it('moves meals to suhoor and iftar, and training after iftar, when fasting', () => {
    const prayers = prayerTimes('2026-11-06', 29.3759, 47.9774, { method: 'kuwait' });
    const day = buildDay(ctx({ prayers }, { fasting: true }));
    const iftar = day.find((i) => i.title === 'Iftar')!;
    const maghrib = day.find((i) => i.title === 'Maghrib')!;
    expect(iftar.time).toBe(maghrib.time);
    expect(day.find((i) => i.title === 'Suhoor')).toBeTruthy();
    const w = day.find((i) => i.kind === 'workout')!;
    expect(toMinutes(w.time)).toBe(toMinutes(maghrib.time) + 90);
  });

  it('picks Now from the next open item and lists what slipped past', () => {
    const day = buildDay(ctx({ logged: new Set(['breakfast']) }));
    // 13:00: lunch at 13:30 is next.
    expect(nowItem(day, toMinutes('13:00'))?.id).toBe('meal-lunch');
    // 14:00: lunch is still within its 45-minute window.
    expect(nowItem(day, toMinutes('14:00'))?.id).toBe('meal-lunch');
    const missed = missedItems(day, toMinutes('15:00')).map((i) => i.id);
    expect(missed).toContain('meal-lunch');
    expect(missed).not.toContain('meal-breakfast');
    // After midnight but before wake, the day is still "today" and lights out is past.
    expect(nowItem(day, toMinutes('23:50'))).toBeNull();
  });
});
