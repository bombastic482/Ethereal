import { cmToIn, round, type Sex } from './units';

export interface IdealWeightResult {
  /** Formula results in kg. */
  devine: number;
  robinson: number;
  miller: number;
  hamwi: number;
  /** Mean of the four formulas. */
  average: number;
  /** BMI 18.5–24.9 range for the height. */
  bmiRange: { min: number; max: number };
  /** Notes on formula applicability. */
  notes: string[];
}

/**
 * Classic ideal body weight formulas. They are all linear in inches over 5 ft,
 * were derived for adults, and are most often used for drug dosing.
 * For everyday use the BMI range is the more defensible "healthy" band.
 */
export function calculateIdealWeight(heightCm: number, sex: Sex): IdealWeightResult {
  if (!(heightCm > 0)) throw new RangeError('Height must be positive');
  const inches = cmToIn(heightCm);
  const over = inches - 60; // inches over 5 ft (can be negative)
  const notes: string[] = [];

  const formulas =
    sex === 'male'
      ? { devine: [50, 2.3], robinson: [52, 1.9], miller: [56.2, 1.41], hamwi: [48, 2.7] }
      : { devine: [45.5, 2.3], robinson: [49, 1.7], miller: [53.1, 1.36], hamwi: [45.5, 2.2] };

  const apply = ([base, perInch]: number[]) => Math.max(0, base! + perInch! * over);
  const devine = apply(formulas.devine);
  const robinson = apply(formulas.robinson);
  const miller = apply(formulas.miller);
  const hamwi = apply(formulas.hamwi);

  if (over < 0)
    notes.push(
      'These formulas were derived for heights of 5 ft (152 cm) and above; results below that are extrapolated.',
    );
  notes.push(
    'Formula weights ignore muscle mass and frame size. Treat them as reference points, not targets.',
  );

  const h = heightCm / 100;
  return {
    devine: round(devine, 1),
    robinson: round(robinson, 1),
    miller: round(miller, 1),
    hamwi: round(hamwi, 1),
    average: round((devine + robinson + miller + hamwi) / 4, 1),
    bmiRange: { min: round(18.5 * h * h, 1), max: round(24.9 * h * h, 1) },
    notes,
  };
}
