import { round } from './units';

export type MacroPresetKey = 'balanced' | 'high-protein' | 'low-carb' | 'keto' | 'custom';

export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroPreset {
  key: MacroPresetKey;
  label: string;
  description: string;
  split: MacroSplit; // percentages, must sum to 100
}

export const MACRO_PRESETS: readonly MacroPreset[] = [
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'Flexible, sustainable default for most people',
    split: { protein: 30, carbs: 40, fat: 30 },
  },
  {
    key: 'high-protein',
    label: 'High protein',
    description: 'Best for fat loss while keeping muscle',
    split: { protein: 40, carbs: 30, fat: 30 },
  },
  {
    key: 'low-carb',
    label: 'Low carb',
    description: 'Fewer carbs, more fat; good for appetite control',
    split: { protein: 35, carbs: 25, fat: 40 },
  },
  {
    key: 'keto',
    label: 'Ketogenic',
    description: 'Very low carb; consult a clinician first',
    split: { protein: 25, carbs: 5, fat: 70 },
  },
  {
    key: 'custom',
    label: 'Custom',
    description: 'Set your own percentages',
    split: { protein: 30, carbs: 40, fat: 30 },
  },
];

export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export interface MacroGrams {
  protein: number;
  carbs: number;
  fat: number;
  /** Rough fibre target (14 g per 1,000 kcal, per Dietary Guidelines). */
  fibre: number;
}

export interface MacroResult {
  calories: number;
  split: MacroSplit;
  grams: MacroGrams;
  /** Calories from each macro, useful for charts. */
  kcal: MacroSplit;
  gramsPerKg: { protein: number };
}

export function normaliseSplit(split: MacroSplit): MacroSplit {
  const total = split.protein + split.carbs + split.fat;
  if (total <= 0) return { protein: 30, carbs: 40, fat: 30 };
  return {
    protein: round((split.protein / total) * 100, 1),
    carbs: round((split.carbs / total) * 100, 1),
    fat: round((split.fat / total) * 100, 1),
  };
}

/** Distribute calories across a percentage split. */
export function macrosFromSplit(
  calories: number,
  split: MacroSplit,
  weightKg?: number,
): MacroResult {
  if (!(calories > 0)) throw new RangeError('Calories must be positive');
  const s = normaliseSplit(split);
  const kcal = {
    protein: round(calories * (s.protein / 100)),
    carbs: round(calories * (s.carbs / 100)),
    fat: round(calories * (s.fat / 100)),
  };
  const grams: MacroGrams = {
    protein: round(kcal.protein / KCAL_PER_GRAM.protein),
    carbs: round(kcal.carbs / KCAL_PER_GRAM.carbs),
    fat: round(kcal.fat / KCAL_PER_GRAM.fat),
    fibre: round((calories / 1000) * 14),
  };
  return {
    calories: round(calories),
    split: s,
    grams,
    kcal,
    gramsPerKg: { protein: weightKg ? round(grams.protein / weightKg, 2) : 0 },
  };
}

/**
 * "Protein-first" method: fix protein in g/kg, fix fat as a % of calories, fill the rest with carbs.
 * This is how most evidence-based coaches set macros for fat loss.
 */
export function macrosProteinFirst(
  calories: number,
  weightKg: number,
  proteinGPerKg: number,
  fatPercent: number,
): MacroResult {
  if (!(calories > 0) || !(weightKg > 0))
    throw new RangeError('Calories and weight must be positive');
  const proteinG = weightKg * proteinGPerKg;
  const proteinKcal = proteinG * KCAL_PER_GRAM.protein;
  const fatKcal = calories * (fatPercent / 100);
  let carbKcal = calories - proteinKcal - fatKcal;
  let fatK = fatKcal;
  if (carbKcal < 0) {
    // Not enough calories: shrink fat first, then carbs sit at zero.
    fatK = Math.max(0, calories - proteinKcal);
    carbKcal = 0;
  }
  const split = normaliseSplit({
    protein: (proteinKcal / calories) * 100,
    carbs: (carbKcal / calories) * 100,
    fat: (fatK / calories) * 100,
  });
  return {
    calories: round(calories),
    split,
    kcal: { protein: round(proteinKcal), carbs: round(carbKcal), fat: round(fatK) },
    grams: {
      protein: round(proteinG),
      carbs: round(carbKcal / KCAL_PER_GRAM.carbs),
      fat: round(fatK / KCAL_PER_GRAM.fat),
      fibre: round((calories / 1000) * 14),
    },
    gramsPerKg: { protein: round(proteinG / weightKg, 2) },
  };
}
