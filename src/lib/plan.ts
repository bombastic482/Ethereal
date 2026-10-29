/**
 * The user's plan: goal, pace and the derived daily targets. Built from the shared profile.
 * Stored locally; recomputed on demand so edits to the profile flow through.
 */
import {
  calculateCalorieTarget,
  minimumSafeCalories,
  type BmrFormula,
  type Goal,
} from './calc/energy';
import {
  macrosFromSplit,
  macrosProteinFirst,
  MACRO_PRESETS,
  type MacroPresetKey,
} from './calc/macros';
import { calculateProtein } from './calc/protein';
import { projectTimeline } from './calc/timeline';
import { trendSeries, type WeighIn } from './calc/trend';
import { round } from './calc/units';
import type { Profile } from './profile';
import { createStore } from './store';

export interface Plan {
  /** Whether the onboarding has been completed. */
  active: boolean;
  goal: Goal;
  goalWeightKg: number;
  rateKgPerWeek: number;
  formula: BmrFormula;
  macroPreset: MacroPresetKey;
  /** ISO date the plan started (YYYY-MM-DD). */
  startedOn: string;
  startWeightKg: number;
  /** Manual calorie override after an adjustment; null means use the computed target. */
  calorieOverride: number | null;
  /** Date of the last accepted adjustment, to pace re-checks. */
  lastAdjustedOn: string | null;
}

export const DEFAULT_PLAN: Plan = {
  active: false,
  goal: 'lose',
  goalWeightKg: 70,
  rateKgPerWeek: 0.5,
  formula: 'mifflin',
  macroPreset: 'high-protein',
  startedOn: '1970-01-01',
  startWeightKg: 78,
  calorieOverride: null,
  lastAdjustedOn: null,
};

export const planStore = createStore<Plan>('ethereal:plan:v1', DEFAULT_PLAN);

export interface PlanSummary {
  tdee: number;
  bmr: number;
  computedTarget: number;
  target: number;
  floor: number;
  macros: ReturnType<typeof macrosFromSplit>;
  protein: ReturnType<typeof calculateProtein>;
  timeline: ReturnType<typeof projectTimeline> | null;
  warnings: string[];
}

/**
 * The profile a plan is computed from. Weigh-ins do not rewrite the profile, so once there are
 * any, the latest trend weight stands in for the weight entered at setup. Every screen then shows
 * the same target, and the target follows the user down as they get lighter.
 */
export function planProfile(profile: Profile, entries: WeighIn[]): Profile {
  const trend = trendSeries(entries);
  const latest = trend[trend.length - 1];
  return latest ? { ...profile, weightKg: latest.trendKg } : profile;
}

export function buildPlanSummary(profile: Profile, plan: Plan, today = new Date()): PlanSummary {
  const bodyFat = profile.bodyFatPercent;
  const p = {
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    ...(bodyFat !== undefined ? { bodyFatPercent: bodyFat } : {}),
  };
  const formula: BmrFormula =
    plan.formula === 'katch' && bodyFat === undefined ? 'mifflin' : plan.formula;
  const ct = calculateCalorieTarget({
    profile: p,
    activity: profile.activity,
    goal: plan.goal,
    rateKgPerWeek: plan.rateKgPerWeek,
    formula,
  });
  const floor = minimumSafeCalories(profile.sex);
  const target =
    plan.calorieOverride !== null ? Math.max(floor, round(plan.calorieOverride)) : ct.target;
  const preset = MACRO_PRESETS.find((m) => m.key === plan.macroPreset) ?? MACRO_PRESETS[0]!;
  const protein = calculateProtein({
    weightKg: profile.weightKg,
    goal: plan.goal,
    training: 'regular',
    age: profile.age,
    ...(bodyFat !== undefined ? { bodyFatPercent: bodyFat } : {}),
  });
  // Protein comes from the evidence-based target; the preset only decides the fat share, carbs fill the rest.
  // If protein alone would exceed the preset's share by a lot (very low calories), fall back to the plain split.
  let macros = macrosProteinFirst(
    target,
    profile.weightKg,
    protein.target / profile.weightKg,
    preset.split.fat,
  );
  if (macros.grams.carbs <= 0) macros = macrosFromSplit(target, preset.split, profile.weightKg);
  let timeline: PlanSummary['timeline'] = null;
  if (plan.goal !== 'maintain') {
    try {
      timeline = projectTimeline({
        profile: p,
        activity: profile.activity,
        goalWeightKg: plan.goalWeightKg,
        dailyIntake: target,
        startDate: today,
      });
    } catch {
      timeline = null;
    }
  }
  return {
    tdee: ct.tdee,
    bmr: ct.bmr,
    computedTarget: ct.target,
    target,
    floor,
    macros,
    protein,
    timeline,
    warnings: ct.warnings,
  };
}

export function todayIso(d = new Date()): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
