import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doctorPrompts, labFlag, symptomStrip, type SymptomEntry } from '../health';

const day = (n: number) => new Date(Date.UTC(2026, 10, 30) - n * 864e5).toISOString().slice(0, 10);
const today = day(0);
const log = (name: string, days: number[], severity = 4): SymptomEntry[] =>
  days.map((d) => ({ date: day(d), symptom: name, severity }));

describe('health diary', () => {
  beforeEach(() => {
    const bag = new Map<string, string>();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => bag.get(k) ?? null,
        setItem: (k: string, v: string) => void bag.set(k, v),
        removeItem: (k: string) => void bag.delete(k),
      },
      addEventListener() {},
      removeEventListener() {},
    };
    vi.resetModules();
  });

  it('suggests a doctor for a symptom on most days, or severe several times', () => {
    const prompts = doctorPrompts(
      [
        ...log('Leg pain', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        ...log('Headache', [0, 2, 4], 8),
        ...log('Bloating', [1, 4]),
      ],
      today,
    );
    expect(prompts.map((p) => [p.symptom, p.level])).toEqual([
      ['Leg pain', 'see-doctor'],
      ['Headache', 'see-doctor'],
    ]);
  });

  it('flags something lingering for weeks as worth watching', () => {
    const prompts = doctorPrompts(log('Knee pain', [0, 3, 6, 9, 12, 20]), today);
    expect(prompts).toEqual([
      expect.objectContaining({ symptom: 'Knee pain', level: 'keep-an-eye' }),
    ]);
  });

  it('keeps one rating per symptom per day, and clears on zero', async () => {
    const { healthStore, rateSymptom } = await import('../health');
    rateSymptom(today, 'Leg pain', 5);
    rateSymptom(today, 'Leg pain', 7);
    rateSymptom(today, 'Headache', 3);
    expect(healthStore.get().symptoms).toHaveLength(2);
    expect(healthStore.get().symptoms.find((s) => s.symptom === 'Leg pain')?.severity).toBe(7);
    rateSymptom(today, 'Headache', 0);
    expect(healthStore.get().symptoms.map((s) => s.symptom)).toEqual(['Leg pain']);
  });

  it('draws a strip of the last weeks and flags lab results outside range', () => {
    const strip = symptomStrip(log('Leg pain', [0, 2], 6), 'Leg pain', today, 7);
    expect(strip).toEqual([0, 0, 0, 0, 6, 0, 6]);
    expect(labFlag('HbA1c', 6.1)).toBe('high');
    expect(labFlag('Vitamin D', 30)).toBe('low');
    expect(labFlag('HDL cholesterol', 1.4)).toBeNull();
  });
});
