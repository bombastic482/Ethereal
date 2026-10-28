import { describe, expect, it } from 'vitest';
import { chains } from '../chains-build';

describe('chains for the eating-out page', () => {
  it('groups brand items into chains with at least four items each', () => {
    expect(chains.length).toBeGreaterThanOrEqual(18);
    for (const c of chains) {
      expect(c.items.length).toBeGreaterThanOrEqual(4);
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      for (const it of c.items) {
        expect(it.name).not.toMatch(/\(/);
        expect(it.kcal).toBeGreaterThan(0);
        expect(it.grams).toBeGreaterThan(0);
      }
    }
    expect(new Set(chains.map((c) => c.slug)).size).toBe(chains.length);
  });

  it('ranks food by protein per 100 kcal and coffee drinks by calories, lowest first', () => {
    const food = chains.find((c) => c.name === 'Chipotle');
    const coffee = chains.find((c) => c.name === 'Starbucks');
    expect(food?.kind).toBe('food');
    expect(coffee?.kind).toBe('drinks');
    const p = food!.items.map((i) => i.proteinPer100);
    expect(p).toEqual([...p].sort((a, b) => b - a));
    const k = coffee!.items.map((i) => i.kcal);
    expect(k).toEqual([...k].sort((a, b) => a - b));
    expect(coffee!.items[0]!.name).toMatch(/Americano/);
  });

  it('leaves supermarket brands out', () => {
    expect(chains.some((c) => /Coca-Cola|Red Bull|Kellogg|Weetabix/.test(c.name))).toBe(false);
  });
});
