import {
  activityMultiplier,
  bmrMifflin,
  KCAL_PER_KG,
  minimumSafeCalories,
  validateProfile,
  type ActivityLevel,
  type BodyProfile,
} from './energy';
import { round } from './units';

export interface TimelineInput {
  profile: BodyProfile;
  activity: ActivityLevel;
  goalWeightKg: number;
  /** Fixed daily intake in kcal. */
  dailyIntake: number;
  /** Optional start date, defaults to today. */
  startDate?: Date;
  /** Hard stop for the projection. */
  maxWeeks?: number;
}

export interface TimelinePoint {
  week: number;
  date: Date;
  weightKg: number;
  tdee: number;
}

export interface TimelineResult {
  points: TimelinePoint[];
  /** Weeks to reach the goal, or null if not reached within maxWeeks. */
  weeksToGoal: number | null;
  goalDate: Date | null;
  reached: boolean;
  startTdee: number;
  endTdee: number;
  totalChangeKg: number;
  /** Average rate over the projection, kg/week (positive = loss). */
  averageRateKgPerWeek: number;
  /** Naive "3,500 kcal/lb" estimate for comparison, in weeks (null if no deficit). */
  naiveWeeks: number | null;
  warnings: string[];
}

/**
 * Week-by-week projection that recomputes maintenance calories as body weight changes.
 * This models the single biggest reason real-world loss slows: a lighter body burns less.
 * It does not model glycogen/water shifts or adaptive thermogenesis beyond that.
 */
export function projectTimeline(input: TimelineInput): TimelineResult {
  const { profile, activity, goalWeightKg, dailyIntake } = input;
  validateProfile(profile);
  if (!(goalWeightKg >= 25 && goalWeightKg <= 400))
    throw new RangeError('Goal weight must be 25–400 kg');
  if (!(dailyIntake >= 500 && dailyIntake <= 10000))
    throw new RangeError('Daily intake must be 500–10,000 kcal');

  const maxWeeks = input.maxWeeks ?? 156;
  const start = input.startDate ?? new Date();
  const mult = activityMultiplier(activity);
  const warnings: string[] = [];
  const losing = goalWeightKg < profile.weightKg;

  const floor = minimumSafeCalories(profile.sex);
  if (dailyIntake < floor) {
    warnings.push(
      `${dailyIntake} kcal/day is below the ${floor} kcal minimum we recommend without medical supervision.`,
    );
  }

  let weight = profile.weightKg;
  const tdeeAt = (w: number) => round(bmrMifflin({ ...profile, weightKg: w }) * mult);
  const startTdee = tdeeAt(weight);
  const points: TimelinePoint[] = [
    { week: 0, date: start, weightKg: round(weight, 2), tdee: startTdee },
  ];

  let reached = Math.abs(weight - goalWeightKg) < 0.05;
  let week = 0;
  while (!reached && week < maxWeeks) {
    week += 1;
    const tdee = tdeeAt(weight);
    const weeklyDelta = ((tdee - dailyIntake) * 7) / KCAL_PER_KG; // positive = loss
    const next = weight - weeklyDelta;
    // Stop if we're no longer moving toward the goal (intake ≈ maintenance).
    if ((losing && next >= weight) || (!losing && next <= weight)) {
      warnings.push(
        losing
          ? `At ${dailyIntake} kcal/day you are at or above maintenance (${tdee} kcal); weight will not fall.`
          : `At ${dailyIntake} kcal/day you are at or below maintenance (${tdee} kcal); weight will not rise.`,
      );
      break;
    }
    weight = next;
    if ((losing && weight <= goalWeightKg) || (!losing && weight >= goalWeightKg)) {
      weight = goalWeightKg;
      reached = true;
    }
    const date = new Date(start.getTime() + week * 7 * 86_400_000);
    points.push({ week, date, weightKg: round(weight, 2), tdee: tdeeAt(weight) });
  }

  if (!reached && week >= maxWeeks) {
    warnings.push(
      `Goal not reached within ${Math.round(maxWeeks / 52)} years at this intake. Consider a larger, still-safe deficit.`,
    );
  }

  const last = points[points.length - 1]!;
  const totalChangeKg = round(profile.weightKg - last.weightKg, 2);
  const naiveDeficit = startTdee - dailyIntake;
  const naiveWeeks =
    losing && naiveDeficit > 0
      ? round(((profile.weightKg - goalWeightKg) * KCAL_PER_KG) / (naiveDeficit * 7), 1)
      : null;

  return {
    points,
    weeksToGoal: reached ? last.week : null,
    goalDate: reached ? last.date : null,
    reached,
    startTdee,
    endTdee: last.tdee,
    totalChangeKg,
    averageRateKgPerWeek: last.week > 0 ? round(totalChangeKg / last.week, 2) : 0,
    naiveWeeks,
    warnings,
  };
}

/** Formats a number of weeks as "6 months, 2 weeks" style text. */
export function humaniseWeeks(weeks: number): string {
  if (weeks < 1) return 'less than a week';
  if (weeks < 9) return `${weeks} week${weeks === 1 ? '' : 's'}`;
  let months = Math.floor(weeks / 4.345);
  let rem = Math.round(weeks - months * 4.345);
  if (rem >= 4) {
    months += 1;
    rem = 0;
  }
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const m = months % 12;
    return `${years} year${years === 1 ? '' : 's'}${m ? `, ${m} month${m === 1 ? '' : 's'}` : ''}`;
  }
  return `${months} month${months === 1 ? '' : 's'}${rem ? `, ${rem} week${rem === 1 ? '' : 's'}` : ''}`;
}
