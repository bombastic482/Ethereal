import { describe, expect, it } from 'vitest';
import { normalise } from '../off';

describe('Open Food Facts normaliser', () => {
  const base = {
    code: '5000159484695',
    product_name: 'Snickers',
    brands: 'Mars, Snickers',
    nutriments: {
      'energy-kcal_100g': 488,
      proteins_100g: 8.6,
      carbohydrates_100g: 60.5,
      fat_100g: 22.5,
      fiber_100g: '1.3',
      sugars_100g: 51.8,
      'saturated-fat_100g': 8.4,
      sodium_100g: 0.12,
    },
    serving_size: '48 g',
    serving_quantity: 48,
    nutriscore_grade: 'e',
    nova_group: 4,
  };
  it('maps nutrients, serving, brand, salt from sodium, Nutri-Score and NOVA', () => {
    const p = normalise(base)!;
    expect(p.name).toBe('Snickers');
    expect(p.brand).toBe('Mars');
    expect(p.per100g).toMatchObject({
      kcal: 488,
      protein: 8.6,
      carbs: 60.5,
      fat: 22.5,
      fibre: 1.3,
    });
    expect(p.per100g.sugar).toBe(51.8);
    expect(p.per100g.salt).toBe(0.3);
    expect(p.servingGrams).toBe(48);
    expect(p.servingLabel).toBe('48 g');
    expect(p.nutriscore).toBe('e');
    expect(p.nova).toBe(4);
  });
  it('converts kJ when kcal is missing, ignores junk grades, rejects incomplete products', () => {
    const p = normalise({
      ...base,
      nutriments: {
        energy_100g: 2041,
        proteins_100g: 8.6,
        carbohydrates_100g: 60.5,
        fat_100g: 22.5,
      },
      nutriscore_grade: 'unknown',
      nova_group: 7,
    })!;
    expect(p.per100g.kcal).toBe(488);
    expect(p.nutriscore).toBeUndefined();
    expect(p.nova).toBeUndefined();
    expect(normalise({ ...base, nutriments: { proteins_100g: 1 } })).toBeNull();
    expect(normalise({ ...base, product_name: '' })).toBeNull();
  });
});
