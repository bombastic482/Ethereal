import { round, type Sex } from './units';

export interface BodyFatInput {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  neckCm: number;
  waistCm: number;
  /** Required for women (hip at widest point). */
  hipCm?: number;
}

export type BodyFatCategory = 'essential' | 'athletes' | 'fitness' | 'average' | 'obese';

export interface BodyFatResult {
  percent: number;
  category: BodyFatCategory;
  label: string;
  fatMassKg: number;
  leanMassKg: number;
  /** ACE category bands for this sex, for gauges. */
  bands: ReadonlyArray<{ max: number; category: BodyFatCategory; label: string }>;
}

const MALE_BANDS = [
  { max: 6, category: 'essential', label: 'Essential fat' },
  { max: 14, category: 'athletes', label: 'Athletic' },
  { max: 18, category: 'fitness', label: 'Fitness' },
  { max: 25, category: 'average', label: 'Average' },
  { max: Infinity, category: 'obese', label: 'Above average' },
] as const satisfies ReadonlyArray<{ max: number; category: BodyFatCategory; label: string }>;

const FEMALE_BANDS = [
  { max: 14, category: 'essential', label: 'Essential fat' },
  { max: 21, category: 'athletes', label: 'Athletic' },
  { max: 25, category: 'fitness', label: 'Fitness' },
  { max: 32, category: 'average', label: 'Average' },
  { max: Infinity, category: 'obese', label: 'Above average' },
] as const satisfies ReadonlyArray<{ max: number; category: BodyFatCategory; label: string }>;

export function bodyFatBands(sex: Sex) {
  return sex === 'male' ? MALE_BANDS : FEMALE_BANDS;
}

export function bodyFatCategory(percent: number, sex: Sex) {
  const bands = bodyFatBands(sex);
  return bands.find((b) => percent < b.max) ?? bands[bands.length - 1]!;
}

/**
 * U.S. Navy circumference method (Hodgdon & Beckett, 1984), metric form.
 * Typical error is ±3–4% versus DEXA; still the best free method available.
 */
export function calculateBodyFatNavy(input: BodyFatInput): BodyFatResult {
  const { sex, heightCm, weightKg, neckCm, waistCm, hipCm } = input;
  if (!(heightCm > 0) || !(neckCm > 0) || !(waistCm > 0) || !(weightKg > 0)) {
    throw new RangeError('All measurements must be positive');
  }
  let percent: number;
  if (sex === 'male') {
    const diff = waistCm - neckCm;
    if (diff <= 0) throw new RangeError('Waist must be larger than neck');
    percent = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!(hipCm && hipCm > 0)) throw new RangeError('Hip measurement is required for women');
    const diff = waistCm + hipCm - neckCm;
    if (diff <= 0) throw new RangeError('Waist plus hip must be larger than neck');
    percent = 495 / (1.29579 - 0.35004 * Math.log10(diff) + 0.221 * Math.log10(heightCm)) - 450;
  }
  if (!Number.isFinite(percent) || percent < 2 || percent > 70) {
    throw new RangeError('Measurements produce an implausible result. Double-check them.');
  }
  const band = bodyFatCategory(percent, sex);
  const fatMassKg = weightKg * (percent / 100);
  return {
    percent: round(percent, 1),
    category: band.category,
    label: band.label,
    fatMassKg: round(fatMassKg, 1),
    leanMassKg: round(weightKg - fatMassKg, 1),
    bands: bodyFatBands(sex),
  };
}
