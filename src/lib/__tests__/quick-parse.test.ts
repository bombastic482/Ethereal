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
