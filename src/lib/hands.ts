/**
 * Logging by hand when you can't weigh: a family dinner from a shared platter, food at a
 * friend's. Your hand scales with your body, which makes it a decent measuring cup. One palm of
 * protein, one fist of carbs or vegetables, one thumb of fat, each with typical cooked weights
 * (after Precision Nutrition's hand-portion method), and nutrients from the food database's
 * reference values.
 */
import type { Nutrients } from './calc/nutrition';

export type HandKind = 'palm' | 'fist-carb' | 'fist-veg' | 'thumb';

export interface HandFood {
  id: string;
  label: string;
  /** Grams in one hand portion. */
  grams: number;
  per100g: Nutrients;
}

const n = (kcal: number, protein: number, carbs: number, fat: number, fibre = 0): Nutrients => ({
  kcal,
  protein,
  carbs,
  fat,
  fibre,
});

export const HAND_FOODS: Record<HandKind, HandFood[]> = {
  palm: [
    { id: 'chicken', label: 'Chicken', grams: 100, per100g: n(190, 27, 0, 9) },
    { id: 'lamb', label: 'Lamb or beef', grams: 100, per100g: n(250, 25, 0, 16.5) },
    { id: 'fish', label: 'Fish', grams: 100, per100g: n(130, 24, 0, 3.7) },
    { id: 'eggs', label: 'Eggs (2 per palm)', grams: 100, per100g: n(143, 12.6, 0.7, 9.5) },
    { id: 'beans', label: 'Beans or lentils', grams: 150, per100g: n(120, 8, 18, 0.6, 6) },
  ],
  'fist-carb': [
    { id: 'rice', label: 'Rice', grams: 150, per100g: n(140, 2.8, 30, 1, 0.4) },
    { id: 'bread', label: 'Bread or khubz', grams: 60, per100g: n(275, 9, 55, 1.4, 2.2) },
    { id: 'potato', label: 'Potato', grams: 150, per100g: n(85, 2, 19, 0.1, 2) },
    { id: 'pasta', label: 'Pasta or noodles', grams: 150, per100g: n(157, 5.8, 31, 0.9, 1.8) },
    { id: 'fruit', label: 'Fruit', grams: 150, per100g: n(55, 0.6, 13, 0.2, 2) },
  ],
  'fist-veg': [
    { id: 'veg', label: 'Vegetables or salad', grams: 80, per100g: n(30, 1.8, 4, 0.3, 2.5) },
  ],
  thumb: [
    { id: 'oil', label: 'Oil, ghee or butter', grams: 12, per100g: n(884, 0, 0, 100) },
    { id: 'nuts', label: 'Nuts', grams: 15, per100g: n(600, 20, 20, 50, 8) },
    { id: 'cheese', label: 'Cheese', grams: 25, per100g: n(350, 22, 1, 28) },
    { id: 'sauce', label: 'Creamy sauce or dressing', grams: 20, per100g: n(450, 1, 5, 47) },
  ],
};

export const HAND_LABEL: Record<HandKind, { one: string; many: string; hint: string }> = {
  palm: { one: 'palm', many: 'palms', hint: 'Protein: the size and thickness of your palm' },
  'fist-carb': { one: 'fist', many: 'fists', hint: 'Carbs: the size of your clenched fist' },
  'fist-veg': { one: 'fist', many: 'fists', hint: 'Vegetables: a fist, or two' },
  thumb: { one: 'thumb', many: 'thumbs', hint: 'Fats: the size of your whole thumb' },
};

export interface HandPick {
  kind: HandKind;
  foodId: string;
  count: number;
}

/** The food and grams each pick stands for; zero counts are dropped. */
export function resolveHands(
  picks: readonly HandPick[],
): Array<{ pick: HandPick; food: HandFood; grams: number }> {
  return picks
    .filter((p) => p.count > 0)
    .map((pick) => {
      const food =
        HAND_FOODS[pick.kind].find((f) => f.id === pick.foodId) ?? HAND_FOODS[pick.kind][0]!;
      return { pick, food, grams: Math.round(food.grams * pick.count) };
    });
}

/** "1½ palms" for display. */
export function handCount(count: number, kind: HandKind): string {
  const whole = Math.floor(count);
  const half = count - whole >= 0.5 ? '½' : '';
  const shown = whole === 0 && half ? '½' : `${whole}${half}`;
  return `${shown} ${count > 1 ? HAND_LABEL[kind].many : HAND_LABEL[kind].one}`;
}
