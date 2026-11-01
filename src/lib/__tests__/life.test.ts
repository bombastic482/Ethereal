import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LIFE, fromMinutes, medTimes, toMinutes, type Med } from '../life';

describe('life profile', () => {
  beforeEach(() => {
    const bag = new Map<string, string>();
    const ls = {
      getItem: (k: string) => bag.get(k) ?? null,
      setItem: (k: string, v: string) => void bag.set(k, v),
      removeItem: (k: string) => void bag.delete(k),
    };
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: ls,
      addEventListener() {},
      removeEventListener() {},
    };
    vi.resetModules();
  });

  it('cleans untrusted data instead of trusting it', async () => {
    const { lifeStore } = await import('../life');
    expect(
      lifeStore.restore({
        name: 'Ali',
        goals: ['get-stronger', 'fly'],
        wake: '25:99',
        meals: { breakfast: '07:15' },
        meds: [{ name: 'Vitamin D', rule: 'nonsense', times: ['21:00', 'later'] }, 'junk'],
        prayer: { on: true, lat: 200, lon: 47.9, method: 'kuwait' },
        weighDay: 9,
      }),
    ).toBe(true);
    const life = lifeStore.get();
    expect(life.goals).toEqual(['get-stronger']);
    expect(life.wake).toBe(DEFAULT_LIFE.wake);
    expect(life.meals).toEqual({ ...DEFAULT_LIFE.meals, breakfast: '07:15' });
    expect(life.meds).toHaveLength(1);
    expect(life.meds[0]).toMatchObject({ name: 'Vitamin D', rule: 'any', times: ['21:00'] });
    expect(life.prayer.lat).toBeNull();
    expect(life.prayer.lon).toBe(47.9);
    expect(life.weighDay).toBe(5);
    expect(lifeStore.restore('nope')).toBe(false);
  });

  it('ties medicine times to your day', () => {
    const day = { wake: '06:30', sleep: '23:00', meals: DEFAULT_LIFE.meals };
    const med = (rule: Med['rule'], times: string[] = []): Med => ({
      id: 'x',
      name: 'x',
      dose: '',
      rule,
      times,
    });
    expect(medTimes(med('with-food'), day)).toEqual(['08:00']);
    expect(medTimes(med('empty-stomach'), day)).toEqual(['07:30']);
    expect(medTimes(med('bedtime'), day)).toEqual(['22:30']);
    expect(medTimes(med('any'), day)).toEqual(['07:00']);
    expect(medTimes(med('bedtime', ['21:45', '09:00']), day)).toEqual(['09:00', '21:45']);
  });

  it('converts clock times both ways and wraps midnight', () => {
    expect(toMinutes('13:45')).toBe(825);
    expect(fromMinutes(825)).toBe('13:45');
    expect(fromMinutes(-30)).toBe('23:30');
    expect(fromMinutes(1450)).toBe('00:10');
  });
});
