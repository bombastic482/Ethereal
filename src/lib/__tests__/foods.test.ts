import { beforeAll, describe, expect, it } from 'vitest';
import { allFoods, foodById, loadFoods, searchFoods } from '../foods';

beforeAll(() => loadFoods());

describe('food database search', () => {
  it('indexes every chunk the validator counts', async () => {
    const chunks = await Promise.all(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((c) => import(`../../data/foods-${c}.json`)),
    );
    const total = chunks.reduce((n, c) => n + (c.default as unknown[]).length, 0);
    expect(allFoods().length).toBe(total);
    expect(allFoods().length).toBeGreaterThan(1200);
  });
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
  it('puts everyday staples before dishes, raw variants and brands', () => {
    expect(searchFoods('chicken')[0]!.id).toBe('chicken-breast-cooked');
    expect(searchFoods('egg')[0]!.id).toMatch(/^egg-(whole-raw|boiled)$/);
    expect(searchFoods('yogurt')[0]!.id).toMatch(/^yogurt-greek-0|^yogurt-natural/);
    expect(searchFoods('rice')[0]!.id).toBe('rice-white-cooked');
    expect(searchFoods('oats')[0]!.id).toBe('oats-rolled');
    const brandedFirst = searchFoods('coffee')
      .slice(0, 3)
      .some((f) => /\([A-Z][^)]*\)\s*$/.test(f.name));
    expect(brandedFirst).toBe(false);
  });
  it('understands aliases people type', () => {
    expect(searchFoods('coke')[0]!.id).toBe('coca-cola-classic');
    expect(searchFoods('yoghurt').length).toBeGreaterThan(5);
    expect(searchFoods('prawn').length).toBeGreaterThan(0);
    expect(searchFoods('courgette').some((f) => /courgette|zucchini/i.test(f.name))).toBe(true);
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
