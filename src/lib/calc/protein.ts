import { round } from './units';

export type ProteinGoal = 'lose' | 'maintain' | 'gain';
export type TrainingLevel = 'none' | 'light' | 'regular' | 'heavy';

export interface ProteinInput {
  weightKg: number;
  goal: ProteinGoal;
  training: TrainingLevel;
  /** Optional; when given, targets use lean mass for very high body-fat levels. */
  bodyFatPercent?: number;
  /** Adults 65+ benefit from the upper end of ranges. */
  age?: number;
  mealsPerDay?: number;
}

export interface ProteinResult {
  /** Daily grams: low end, recommended, high end. */
  low: number;
  target: number;
  high: number;
  gPerKg: { low: number; target: number; high: number };
  /** Reference mass used (total or lean-adjusted), kg. */
  referenceKg: number;
  usedLeanAdjustment: boolean;
  perMeal: number;
  mealsPerDay: number;
  rationale: string;
}

/**
 * Evidence-based ranges (g per kg of body weight per day):
 *  - Sedentary adults: 0.8–1.2 (RDA is 0.8, most experts consider it a floor).
 *  - Training, maintaining: 1.4–1.8.
 *  - Building muscle: 1.6–2.2.
 *  - Fat loss: 1.6–2.4; leaner, harder-training people sit at the top.
 * For people above ~30% body fat, using total mass overshoots, so we use an adjusted mass
 * (lean mass × 1.3, a common coaching heuristic) instead.
 */
export function calculateProtein(input: ProteinInput): ProteinResult {
  const { weightKg, goal, training, bodyFatPercent, age } = input;
  if (!(weightKg > 0)) throw new RangeError('Weight must be positive');
  const mealsPerDay = Math.min(6, Math.max(2, input.mealsPerDay ?? 4));

  let range: [number, number];
  let rationale: string;
  if (training === 'none') {
    range = goal === 'lose' ? [1.2, 1.6] : [0.8, 1.2];
    rationale =
      goal === 'lose'
        ? 'Without training, a moderate bump above the RDA still protects muscle in a deficit.'
        : 'The RDA (0.8 g/kg) prevents deficiency; slightly more supports healthy ageing and satiety.';
  } else if (goal === 'lose') {
    range = training === 'heavy' ? [1.8, 2.4] : training === 'regular' ? [1.6, 2.2] : [1.4, 2.0];
    rationale = 'In a calorie deficit, higher protein preserves lean mass and controls hunger.';
  } else if (goal === 'gain') {
    range = training === 'heavy' ? [1.8, 2.2] : [1.6, 2.0];
    rationale =
      'Muscle gain plateaus around 1.6 g/kg for most; heavier training benefits from a little more.';
  } else {
    range = training === 'heavy' ? [1.6, 1.8] : [1.4, 1.6];
    rationale = 'Active people maintaining weight need roughly double the RDA to support recovery.';
  }
  if (age !== undefined && age >= 65) {
    range = [Math.max(range[0], 1.2), range[1]];
    rationale += ' Adults over 65 need the upper end to counter anabolic resistance.';
  }

  let referenceKg = weightKg;
  let usedLeanAdjustment = false;
  if (bodyFatPercent !== undefined && bodyFatPercent > 30) {
    referenceKg = round(weightKg * (1 - bodyFatPercent / 100) * 1.3, 1);
    usedLeanAdjustment = true;
    rationale +=
      ' Targets are scaled to lean mass because total body weight would overstate needs.';
  }

  const target = round(referenceKg * ((range[0] + range[1]) / 2));
  return {
    low: round(referenceKg * range[0]),
    target,
    high: round(referenceKg * range[1]),
    gPerKg: { low: range[0], target: round((range[0] + range[1]) / 2, 2), high: range[1] },
    referenceKg,
    usedLeanAdjustment,
    perMeal: round(target / mealsPerDay),
    mealsPerDay,
    rationale,
  };
}
