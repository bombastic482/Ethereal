import { round } from './units';

export type BmiCategory =
  'underweight' | 'healthy' | 'overweight' | 'obese-1' | 'obese-2' | 'obese-3';

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  label: string;
  /** Healthy weight range (kg) for this height, BMI 18.5–24.9. */
  healthyRangeKg: { min: number; max: number };
  /** Kilograms to gain (negative) or lose (positive) to reach the nearest edge of the healthy range. 0 if already inside. */
  deltaToHealthyKg: number;
  /** Ponderal (Corpulence) index, a height-fairer alternative to BMI. */
  ponderalIndex: number;
  /** Where this BMI sits on a 0–100 scale between BMI 12 and BMI 45, for gauges. */
  gaugePercent: number;
}

export const BMI_BANDS: ReadonlyArray<{ max: number; category: BmiCategory; label: string }> = [
  { max: 18.5, category: 'underweight', label: 'Underweight' },
  { max: 25, category: 'healthy', label: 'Healthy weight' },
  { max: 30, category: 'overweight', label: 'Overweight' },
  { max: 35, category: 'obese-1', label: 'Obesity class I' },
  { max: 40, category: 'obese-2', label: 'Obesity class II' },
  { max: Infinity, category: 'obese-3', label: 'Obesity class III' },
];

export function bmiCategory(bmi: number): { category: BmiCategory; label: string } {
  const band = BMI_BANDS.find((b) => bmi < b.max) ?? BMI_BANDS[BMI_BANDS.length - 1]!;
  return { category: band.category, label: band.label };
}

export function calculateBmi(weightKg: number, heightCm: number): BmiResult {
  if (!(weightKg > 0) || !(heightCm > 0))
    throw new RangeError('Weight and height must be positive');
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  const { category, label } = bmiCategory(bmi);
  const min = 18.5 * h * h;
  const max = 24.9 * h * h;
  let deltaToHealthyKg = 0;
  if (weightKg > max) deltaToHealthyKg = weightKg - max;
  else if (weightKg < min) deltaToHealthyKg = weightKg - min;
  return {
    bmi: round(bmi, 1),
    category,
    label,
    healthyRangeKg: { min: round(min, 1), max: round(max, 1) },
    deltaToHealthyKg: round(deltaToHealthyKg, 1),
    ponderalIndex: round(weightKg / (h * h * h), 1),
    gaugePercent: round(Math.min(100, Math.max(0, ((bmi - 12) / (45 - 12)) * 100)), 1),
  };
}
