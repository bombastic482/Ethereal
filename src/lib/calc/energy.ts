import { clamp, round, type Sex } from './units';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type BmrFormula = 'mifflin' | 'harris' | 'katch';

export interface ActivityInfo {
  key: ActivityLevel;
  label: string;
  multiplier: number;
  description: string;
}

export const ACTIVITY_LEVELS: readonly ActivityInfo[] = [
  {
    key: 'sedentary',
    label: 'Sedentary',
    multiplier: 1.2,
    description: 'Desk job, little or no exercise',
  },
  {
    key: 'light',
    label: 'Lightly active',
    multiplier: 1.375,
    description: 'Light exercise 1–3 days a week',
  },
  {
    key: 'moderate',
    label: 'Moderately active',
    multiplier: 1.55,
    description: 'Moderate exercise 3–5 days a week',
  },
  {
    key: 'active',
    label: 'Very active',
    multiplier: 1.725,
    description: 'Hard exercise 6–7 days a week',
  },
  {
    key: 'very-active',
    label: 'Extremely active',
    multiplier: 1.9,
    description: 'Physical job plus hard daily training',
  },
];

export function activityMultiplier(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((a) => a.key === level)?.multiplier ?? 1.2;
}

export interface BodyProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  /** Body-fat percentage (0–100). Required for the Katch-McArdle formula. */
  bodyFatPercent?: number;
}

/** Mifflin-St Jeor (1990): the most accurate general-population equation (ADA position). */
export function bmrMifflin({ sex, age, heightCm, weightKg }: BodyProfile): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Revised Harris-Benedict (Roza & Shizgal, 1984). */
export function bmrHarrisBenedict({ sex, age, heightCm, weightKg }: BodyProfile): number {
  return sex === 'male'
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
}

/** Katch-McArdle: based on lean body mass, best when body fat is known accurately. */
export function bmrKatchMcArdle({ weightKg, bodyFatPercent }: BodyProfile): number {
  if (bodyFatPercent === undefined)
    throw new RangeError('Body fat % is required for Katch-McArdle');
  const lbm = weightKg * (1 - bodyFatPercent / 100);
  return 370 + 21.6 * lbm;
}

export function calculateBmr(profile: BodyProfile, formula: BmrFormula = 'mifflin'): number {
  validateProfile(profile);
  switch (formula) {
    case 'harris':
      return round(bmrHarrisBenedict(profile));
    case 'katch':
      return round(bmrKatchMcArdle(profile));
    default:
      return round(bmrMifflin(profile));
  }
}

export function calculateTdee(
  profile: BodyProfile,
  activity: ActivityLevel,
  formula: BmrFormula = 'mifflin',
): number {
  return round(calculateBmr(profile, formula) * activityMultiplier(activity));
}

/** Energy density of body-weight change used for rate → deficit conversion (≈7,700 kcal per kg). */
export const KCAL_PER_KG = 7700;

export type Goal = 'lose' | 'maintain' | 'gain';

/** Minimum daily intake below which unsupervised dieting is not recommended. */
export function minimumSafeCalories(sex: Sex): number {
  return sex === 'male' ? 1500 : 1200;
}

export interface CalorieTargetInput {
  profile: BodyProfile;
  activity: ActivityLevel;
  goal: Goal;
  /** Target rate of weight change in kg per week (positive number). */
  rateKgPerWeek: number;
  formula?: BmrFormula;
}

export interface CalorieTarget {
  bmr: number;
  tdee: number;
  /** Recommended daily intake after applying safety limits. */
  target: number;
  /** Deficit (positive) or surplus (negative) actually applied, kcal/day. */
  dailyDelta: number;
  /** Deficit/surplus the user asked for before limits, kcal/day. */
  requestedDelta: number;
  /** Achievable rate after limits, kg/week. */
  achievableRateKgPerWeek: number;
  /** Deficit as a percentage of TDEE (positive = deficit). */
  deficitPercent: number;
  warnings: string[];
}

/**
 * Converts a desired rate of loss/gain into a daily calorie target, applying two guard rails:
 *  1. The deficit never exceeds 25% of TDEE, except that the standard 550 kcal (0.5 kg or 1 lb per week) deficit is always
 *     allowed; it is also hard-capped at 1,100 kcal/day.
 *  2. Intake never falls below the sex-specific minimum.
 */
export function calculateCalorieTarget(input: CalorieTargetInput): CalorieTarget {
  const { profile, activity, goal, formula = 'mifflin' } = input;
  const bmr = calculateBmr(profile, formula);
  const tdee = round(bmr * activityMultiplier(activity));
  const warnings: string[] = [];

  const rate = Math.max(0, input.rateKgPerWeek);
  const requestedDelta = goal === 'maintain' ? 0 : round((rate * KCAL_PER_KG) / 7);

  let target: number;
  if (goal === 'lose') {
    const maxDeficit = Math.min(Math.max(round(tdee * 0.25), 550), 1100);
    let deficit = Math.min(requestedDelta, maxDeficit);
    if (requestedDelta > maxDeficit) {
      warnings.push(
        `A ${rate} kg/week loss would need a ${requestedDelta} kcal daily deficit. We capped it at ${deficit} kcal/day to protect muscle and energy levels.`,
      );
    }
    target = tdee - deficit;
    const floor = minimumSafeCalories(profile.sex);
    if (target < floor) {
      target = floor;
      deficit = tdee - floor;
      warnings.push(
        `Intake was raised to ${floor} kcal/day, the minimum we recommend without medical supervision.`,
      );
    }
    if (deficit < 0) deficit = 0;
    if (tdee - target <= 0)
      warnings.push(
        'Your maintenance calories are already at the safety floor; focus on activity and food quality rather than a deficit.',
      );
  } else if (goal === 'gain') {
    const maxSurplus = 500;
    const surplus = Math.min(requestedDelta, maxSurplus);
    if (requestedDelta > maxSurplus) {
      warnings.push(
        `Surpluses above ${maxSurplus} kcal/day mostly add fat, so we capped it there.`,
      );
    }
    target = tdee + surplus;
  } else {
    target = tdee;
  }

  target = round(target);
  const dailyDelta = tdee - target;
  return {
    bmr,
    tdee,
    target,
    dailyDelta,
    requestedDelta,
    achievableRateKgPerWeek: round((dailyDelta * 7) / KCAL_PER_KG, 2),
    deficitPercent: round((dailyDelta / tdee) * 100, 1),
    warnings,
  };
}

export function validateProfile(p: BodyProfile): void {
  if (!(p.age >= 13 && p.age <= 120)) throw new RangeError('Age must be between 13 and 120');
  if (!(p.heightCm >= 100 && p.heightCm <= 260)) throw new RangeError('Height must be 100–260 cm');
  if (!(p.weightKg >= 25 && p.weightKg <= 400)) throw new RangeError('Weight must be 25–400 kg');
  if (p.bodyFatPercent !== undefined && !(p.bodyFatPercent >= 2 && p.bodyFatPercent <= 70)) {
    throw new RangeError('Body fat must be 2–70%');
  }
}

/** Kcal per day required to lose `kg` in `weeks` (informational). */
export function deficitForRate(kgPerWeek: number): number {
  return round((clamp(kgPerWeek, 0, 2) * KCAL_PER_KG) / 7);
}
