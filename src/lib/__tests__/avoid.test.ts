import { describe, expect, it } from 'vitest';
import { avoidHits } from '../avoid';

describe('foods to avoid', () => {
  it('catches what people mean by each choice', () => {
    expect(avoidHits('Tuna, canned in brine', ['Tuna'])).toEqual(['Tuna']);
    expect(avoidHits('King prawns, cooked', ['Shellfish'])).toEqual(['Shellfish']);
    expect(avoidHits('Laban, drinking yogurt', ['Dairy'])).toEqual(['Dairy']);
    expect(avoidHits('Khubz, Arabic flatbread', ['Gluten'])).toEqual(['Gluten']);
    expect(
      avoidHits('Luqaimat, fried dumplings with date syrup', ['Fried food', 'Added sugar']),
    ).toEqual(['Fried food', 'Added sugar']);
  });

  it('does not over-match', () => {
    expect(avoidHits('Chicken breast, grilled', ['Tuna', 'Dairy', 'Gluten'])).toEqual([]);
    expect(avoidHits('Peanut butter, smooth', ['Dairy'])).toEqual([]);
    expect(avoidHits('Peanut butter, smooth', ['Peanuts'])).toEqual(['Peanuts']);
    expect(avoidHits('Almond milk, unsweetened', ['Dairy'])).toEqual([]);
    expect(avoidHits('Butternut squash, roasted', ['Dairy'])).toEqual([]);
  });

  it('applies "caffeine late" only from the afternoon, and matches your own words', () => {
    expect(avoidHits('Karak tea, with evaporated milk and sugar', ['Caffeine late'], 9)).toEqual(
      [],
    );
    expect(avoidHits('Karak tea, with evaporated milk and sugar', ['Caffeine late'], 16)).toEqual([
      'Caffeine late',
    ]);
    expect(avoidHits('Aubergine, grilled', ['aubergine'])).toEqual(['aubergine']);
    expect(avoidHits('Mushrooms, fried', ['Mushroom'])).toEqual(['Mushroom']);
  });
});
