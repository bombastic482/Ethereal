import { round } from './units';

export type Climate = 'temperate' | 'hot' | 'cold';

export interface HydrationInput {
  weightKg: number;
  /** Minutes of moderate-to-vigorous exercise per day. */
  exerciseMinutes: number;
  climate: Climate;
  /** Pregnant or breastfeeding adds ~300–700 ml. */
  pregnantOrBreastfeeding?: boolean;
}

export interface HydrationResult {
  /** Baseline from body weight only, ml/day. */
  baselineMl: number;
  exerciseMl: number;
  climateMl: number;
  extraMl: number;
  totalMl: number;
  /** A sensible range around the total (±10%). */
  rangeMl: { min: number; max: number };
  glasses: number; // 250 ml
  notes: string[];
}

/**
 * Body-weight heuristic used by dietitians: ~35 ml/kg/day for adults, plus ~12 ml per minute of exercise,
 * plus a warm-climate allowance. Roughly 20% of fluid comes from food, which this ignores on purpose:
 * the number is drinking-water guidance, and thirst remains the best day-to-day regulator.
 */
export function calculateHydration(input: HydrationInput): HydrationResult {
  const { weightKg, exerciseMinutes, climate, pregnantOrBreastfeeding } = input;
  if (!(weightKg > 0)) throw new RangeError('Weight must be positive');
  if (exerciseMinutes < 0) throw new RangeError('Exercise minutes cannot be negative');

  const baselineMl = round(weightKg * 35);
  const exerciseMl = round(Math.min(exerciseMinutes, 240) * 12);
  const climateMl = climate === 'hot' ? 500 : climate === 'cold' ? 0 : 0;
  const extraMl = pregnantOrBreastfeeding ? 500 : 0;
  const totalMl = baselineMl + exerciseMl + climateMl + extraMl;
  const notes: string[] = [];
  if (totalMl > 5000)
    notes.push(
      'Very high totals are only appropriate for prolonged hard exercise; drink to thirst and include electrolytes.',
    );
  if (climate === 'cold')
    notes.push(
      'Cold, dry air still dehydrates; thirst is blunted in the cold, so drink on a schedule.',
    );
  return {
    baselineMl,
    exerciseMl,
    climateMl,
    extraMl,
    totalMl,
    rangeMl: { min: round(totalMl * 0.9, -2), max: round(totalMl * 1.1, -2) },
    glasses: round(totalMl / 250),
    notes,
  };
}
