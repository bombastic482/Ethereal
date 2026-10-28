import { describe, expect, it } from 'vitest';
import {
  adherencePercent,
  mealForTime,
  scale,
  suggestFoods,
  sum,
  summariseDay,
  type FoodEntry,
} from '../nutrition';
import { ACTIVITIES, activity, exerciseKcal, exerciseNetKcal, stepsKcal } from '../exercise';
import { currentStreak, longestStreak, shift, weightMilestones } from '../streaks';

const egg: FoodEntry = {
  id: '1',
  date: '2026-01-01',
  meal: 'breakfast',
  name: 'Egg',
  grams: 100,
  per100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fibre: 0 },
  source: 'local',
};
const rice: FoodEntry = {
  id: '2',
  date: '2026-01-01',
  meal: 'dinner',
  name: 'Rice',
  grams: 200,
  per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fibre: 0.4 },
  source: 'local',
};
const targets = { kcal: 1800, protein: 150, carbs: 170, fat: 60, fibre: 25 };

describe('nutrition', () => {
  it('scales and sums', () => {
    expect(scale(rice.per100g, 200)).toEqual({
      kcal: 260,
      protein: 5.4,
      carbs: 56,
      fat: 0.6,
      fibre: 0.8,
    });
    expect(sum([scale(egg.per100g, 100), scale(rice.per100g, 200)]).kcal).toBe(403);
  });
  it('summarises a day with remaining and meal split', () => {
    const d = summariseDay(
      [egg, rice],
      [{ id: 'x', date: '2026-01-01', activity: 'jog', minutes: 30, kcal: 300 }],
      targets,
    );
    expect(d.eaten.kcal).toBe(403);
    expect(d.burned).toBe(300);
    expect(d.target.kcal).toBe(1800);
    expect(d.remaining.kcal).toBe(1397);
    expect(d.byMeal.breakfast.kcal).toBe(143);
    expect(d.byMeal.dinner.kcal).toBe(260);
    expect(d.byMeal.lunch.kcal).toBe(0);
    expect(d.status).toBe('under');
    const eatBack = summariseDay(
      [egg, rice],
      [{ id: 'x', date: '2026-01-01', activity: 'jog', minutes: 30, kcal: 300 }],
      targets,
      true,
    );
    expect(eatBack.target.kcal).toBe(2100);
  });
  it('classifies on-target and over', () => {
    const big: FoodEntry = { ...rice, grams: 1400 };
    expect(summariseDay([big], [], targets).status).toBe('on-target'); // 1820
    expect(summariseDay([{ ...rice, grams: 1600 }], [], targets).status).toBe('over'); // 2080
  });
  it('defaults the meal from the hour', () => {
    expect(mealForTime(8)).toBe('breakfast');
    expect(mealForTime(13)).toBe('lunch');
    expect(mealForTime(19)).toBe('dinner');
    expect(mealForTime(22)).toBe('snack');
  });
  it('computes adherence within ±10%', () => {
    expect(adherencePercent([])).toBeNull();
    expect(
      adherencePercent([
        { eatenKcal: 1750, targetKcal: 1800 },
        { eatenKcal: 2300, targetKcal: 1800 },
        { eatenKcal: 0, targetKcal: 1800 },
      ]),
    ).toBe(50);
  });
  it('suggests protein-dense foods when protein is short', () => {
    const foods = [
      {
        id: 'chicken',
        name: 'Chicken',
        per100g: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
        servings: [{ label: '120 g', grams: 120 }],
        veg: 'no' as const,
      },
      {
        id: 'tofu',
        name: 'Tofu',
        per100g: { kcal: 144, protein: 17, carbs: 3, fat: 9 },
        servings: [{ label: '150 g', grams: 150 }],
        veg: 'vegan' as const,
      },
      {
        id: 'cake',
        name: 'Cake',
        per100g: { kcal: 380, protein: 4, carbs: 50, fat: 18 },
        servings: [{ label: 'slice', grams: 90 }],
        veg: 'vegetarian' as const,
      },
    ];
    const s = suggestFoods(
      { kcal: 600, protein: 40, carbs: 50, fat: 20, fibre: 10 },
      foods,
      'omnivore',
    );
    expect(s[0]!.food.id).toBe('chicken');
    expect(s[0]!.reason).toMatch(/protein/);
    const vegan = suggestFoods(
      { kcal: 600, protein: 40, carbs: 50, fat: 20, fibre: 10 },
      foods,
      'vegan',
    );
    expect(vegan.map((x) => x.food.id)).toEqual(['tofu']);
    expect(suggestFoods({ kcal: 50, protein: 40, carbs: 0, fat: 0, fibre: 0 }, foods)).toEqual([]);
  });
});

describe('exercise', () => {
  it('uses MET formula', () => {
    expect(exerciseKcal(8.3, 80, 30)).toBe(349); // 8.3*3.5*80/200*30
    expect(exerciseNetKcal(8.3, 80, 30)).toBe(307);
    expect(exerciseKcal(0, 80, 30)).toBe(0);
    expect(activity('jog')?.met).toBe(8.3);
    expect(new Set(ACTIVITIES.map((a) => a.key)).size).toBe(ACTIVITIES.length);
  });
  it('converts steps above baseline to kcal', () => {
    expect(stepsKcal(3000, 80)).toBe(0);
    expect(stepsKcal(10000, 80)).toBe(246);
    expect(stepsKcal(0, 80)).toBe(0);
  });
});

describe('streaks and milestones', () => {
  it('counts current and longest streaks', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05', '2026-01-06'];
    expect(currentStreak(days, '2026-01-06')).toBe(2);
    expect(currentStreak(days, '2026-01-07')).toBe(2); // yesterday counts
    expect(currentStreak(days, '2026-01-08')).toBe(0);
    expect(longestStreak(days)).toBe(3);
    expect(currentStreak([], '2026-01-01')).toBe(0);
    expect(shift('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('builds reached milestones plus the next one', () => {
    const m = weightMilestones(92, 86.5, 80);
    expect(m.find((x) => x.key === 'kg-5')?.reached).toBe(true);
    expect(m.find((x) => x.key === 'pct-5')?.reached).toBe(true);
    expect(m.filter((x) => !x.reached)).toHaveLength(1);
    expect(['kg-10', 'pct-10']).toContain(m.filter((x) => !x.reached)[0]!.key); // whichever is nearer
    expect(weightMilestones(92, null, 80)).toEqual([]);
    expect(weightMilestones(80, 80, 80)).toEqual([]);
  });
});
