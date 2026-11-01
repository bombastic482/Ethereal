import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Minimal localStorage so the store reads and writes like a browser. */
function installWindow() {
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
  return ls;
}

describe('diary persistence', () => {
  beforeEach(() => {
    installWindow();
    vi.resetModules();
  });

  it('keeps saved meals and steps across a reload', async () => {
    const ls = installWindow();
    ls.setItem(
      'ethereal:diary:v1',
      JSON.stringify({
        food: [],
        exercise: [],
        water: { '2026-10-01': 3 },
        customFoods: [],
        recent: [],
        favourites: [],
        meals: [{ id: 'm1', name: 'Breakfast', items: [] }],
        steps: { '2026-10-01': 8200 },
      }),
    );
    // Fresh module so the in-memory cache is empty, as after a page load.
    const mod = await import('../food-store');
    const d = mod.diaryStore.get();
    expect(d.meals).toHaveLength(1);
    expect(d.meals?.[0]?.name).toBe('Breakfast');
    expect(d.steps?.['2026-10-01']).toBe(8200);
    expect(d.water['2026-10-01']).toBe(3);
  });

  it('tolerates a corrupt or partial record', async () => {
    const ls = installWindow();
    ls.setItem('ethereal:diary:v1', JSON.stringify({ food: 'nope', meals: 5 }));
    const mod = await import('../food-store');
    const d = mod.diaryStore.get();
    expect(d.food).toEqual([]);
    expect(d.meals).toEqual([]);
    expect(d.steps).toEqual({});
  });
});

describe('scanned products', () => {
  it('remembers a barcode product after its diary entry is deleted', async () => {
    installWindow();
    vi.resetModules();
    const fs = await import('../food-store');
    const e = fs.addFood({
      date: '2026-10-01',
      meal: 'snack',
      name: 'Protein bar',
      brand: 'Acme',
      grams: 60,
      per100g: { kcal: 350, protein: 30, carbs: 30, fat: 12, fibre: 8 },
      source: 'off',
      barcode: '5000000000001',
    });
    fs.toggleFavourite('5000000000001');
    fs.removeFood(e.id);
    const d = fs.diaryStore.get();
    expect(d.food).toHaveLength(0);
    expect(d.favourites).toContain('5000000000001');
    expect(d.products?.['5000000000001']).toMatchObject({
      name: 'Protein bar',
      brand: 'Acme',
      grams: 60,
    });
  });
});

describe('undo', () => {
  const per100g = { kcal: 100, protein: 10, carbs: 10, fat: 2, fibre: 1 };
  it('puts a removed food back where it was, once', async () => {
    installWindow();
    vi.resetModules();
    const fs = await import('../food-store');
    const add = (name: string) =>
      fs.addFood({ date: '2026-10-01', meal: 'lunch', name, grams: 100, per100g, source: 'local' });
    add('Rice');
    const mid = add('Chicken');
    add('Salad');
    const undo = fs.removeFood(mid.id);
    expect(fs.diaryStore.get().food.map((e) => e.name)).toEqual(['Rice', 'Salad']);
    undo();
    undo(); // a second press does not duplicate it
    expect(fs.diaryStore.get().food.map((e) => e.name)).toEqual(['Rice', 'Chicken', 'Salad']);
    expect(fs.removeFood('missing')).toBeTypeOf('function');
  });
  it('takes a copied meal back out again', async () => {
    installWindow();
    vi.resetModules();
    const fs = await import('../food-store');
    fs.addFood({
      date: '2026-10-01',
      meal: 'dinner',
      name: 'Soup',
      grams: 300,
      per100g,
      source: 'local',
    });
    const { count, undo } = fs.copyMealUndoable('2026-10-01', '2026-10-02', 'dinner');
    expect(count).toBe(1);
    expect(fs.diaryStore.get().food).toHaveLength(2);
    undo();
    expect(fs.diaryStore.get().food.map((e) => e.date)).toEqual(['2026-10-01']);
  });
});
