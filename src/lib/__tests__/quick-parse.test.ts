import { beforeAll, describe, expect, it } from 'vitest';
import { loadFoods, searchFoods } from '../foods';
import { parseQuickEntry, resolveQuickEntry } from '../quick-parse';

beforeAll(() => loadFoods());

describe('quick entry parsing', () => {
  it('splits items and extracts quantities and units', () => {
    const items = parseQuickEntry('2 eggs, a slice of toast and 150g greek yogurt');
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ quantity: 2, unit: 'serving', query: 'eggs' });
    expect(items[1]).toMatchObject({ quantity: 1, unit: 'slice', query: 'toast' });
    expect(items[2]).toMatchObject({ quantity: 150, unit: 'g', query: 'greek yogurt' });
  });
  it('handles fractions, word numbers and volumes', () => {
    const items = parseQuickEntry(
      'half an avocado; 1/2 cup rice; two tbsp peanut butter; 250ml milk',
    );
    expect(items[0]!.quantity).toBe(0.5);
    expect(items[1]).toMatchObject({ quantity: 0.5, unit: 'cup' });
    expect(items[2]).toMatchObject({ quantity: 2, unit: 'tbsp' });
    expect(items[3]).toMatchObject({ quantity: 250, unit: 'ml' });
  });
  it('resolves against the database with sensible grams', () => {
    const r = resolveQuickEntry('2 eggs, 150g greek yogurt, 1 banana', searchFoods);
    expect(r.every((x) => x.food)).toBe(true);
    expect(r[0]!.food!.name.toLowerCase()).toContain('egg');
    expect(r[0]!.grams).toBeGreaterThanOrEqual(90); // two eggs
    expect(r[1]!.grams).toBe(150);
    expect(r[2]!.food!.name.toLowerCase()).toContain('banana');
  });
  it('returns unmatched items as null foods', () => {
    const r = resolveQuickEntry('zzqxv widget', searchFoods);
    expect(r[0]!.food).toBeNull();
  });
});

describe('quick entry edge cases', () => {
  it('treats articles as filler so "half an avocado" is an avocado', () => {
    const r = resolveQuickEntry('half an avocado, a couple of eggs', searchFoods);
    expect(r[0]!.food!.id).toBe('avocado');
    expect(r[0]!.grams).toBeLessThan(120);
    expect(r[1]!.food!.name.toLowerCase()).toMatch(/^egg/);
    expect(r[1]!.grams).toBeGreaterThanOrEqual(90);
  });
  it("uses the food's own cup serving instead of water density", () => {
    const r = resolveQuickEntry('1 cup oats', searchFoods);
    expect(r[0]!.food!.id).toBe('oats-rolled');
    expect(r[0]!.grams).toBeLessThan(120);
    expect(r[0]!.grams).toBeGreaterThan(60);
  });
  it('keeps decimal commas together and understands 2x and plural units', () => {
    const items = parseQuickEntry('1,5 cups rice; 2x eggs; 2 teaspoons sugar; 2 lbs chicken');
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ quantity: 1.5, unit: 'cups' });
    expect(items[1]).toMatchObject({ quantity: 2, unit: 'x', query: 'eggs' });
    expect(items[2]).toMatchObject({ quantity: 2, unit: 'teaspoons' });
    expect(items[3]).toMatchObject({ quantity: 2, unit: 'lbs' });
    const r = resolveQuickEntry('2x eggs', searchFoods);
    expect(r[0]!.grams).toBeGreaterThanOrEqual(90);
  });
});
