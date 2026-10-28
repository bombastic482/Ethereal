import { beforeAll, describe, expect, it } from 'vitest';
import { allFoods, foodById, loadFoods, searchFoods } from '../foods';

beforeAll(() => loadFoods());

describe('food database search', () => {
  it('has unique ids and a useful size', () => {
    expect(allFoods().length).toBeGreaterThan(200);
    expect(new Set(allFoods().map((f) => f.id)).size).toBe(allFoods().length);
  });
  it('ranks the obvious match first', () => {
    const r = searchFoods('chicken breast');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.name.toLowerCase()).toContain('chicken breast');
    expect(searchFoods('greek yogurt')[0]!.name.toLowerCase()).toMatch(/yogurt|yoghurt/);
  });
  it('is tolerant of case, accents and partial words', () => {
    expect(searchFoods('CHICK').length).toBeGreaterThan(0);
    expect(searchFoods('chèése').some((f) => /cheese/i.test(f.name))).toBe(true);
  });
  it('returns nothing for empty or nonsense queries', () => {
    expect(searchFoods('')).toEqual([]);
    expect(searchFoods('   ')).toEqual([]);
    expect(searchFoods('zzqxv')).toEqual([]);
  });
  it('looks up by id', () => {
    const first = allFoods()[0]!;
    expect(foodById(first.id)).toBe(first);
    expect(foodById('nope')).toBeUndefined();
  });
});
