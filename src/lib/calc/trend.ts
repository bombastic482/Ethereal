import { KCAL_PER_KG } from './energy';
import { round } from './units';

export interface WeighIn {
  /** ISO date, YYYY-MM-DD (local). One entry per day. */
  date: string;
  weightKg: number;
  /** Optional circumferences in cm. */
  waistCm?: number;
  hipsCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  note?: string;
}

export interface TrendPoint {
  date: string;
  weightKg: number;
  /** Exponentially-smoothed trend weight (the number to care about). */
  trendKg: number;
}

/** Parse YYYY-MM-DD as a UTC date to avoid DST surprises. */
export function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/**
 * Exponentially-weighted trend (the "Hacker's Diet" method, alpha 0.1). The trend ignores
 * day-to-day water swings and is what we compare against the plan.
 */
export function trendSeries(entries: WeighIn[], alpha = 0.1): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  let trend: number | null = null;
  for (const e of sorted) {
    trend = trend === null ? e.weightKg : trend + alpha * (e.weightKg - trend);
    out.push({ date: e.date, weightKg: e.weightKg, trendKg: round(trend, 2) });
  }
  return out;
}

/** Simple linear regression slope (kg/day) over the last `days` days of trend values. */
export function slopeKgPerDay(points: TrendPoint[], days = 14): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1]!;
  const window = points.filter((p) => daysBetween(p.date, last.date) < days);
  if (window.length < 2) return null;
  const xs = window.map((p) => daysBetween(window[0]!.date, p.date));
  const ys = window.map((p) => p.trendKg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

export interface ProgressInput {
  entries: WeighIn[];
  /** Planned rate of change, kg/week (positive = loss). */
  plannedRateKgPerWeek: number;
  /** Current daily calorie target. */
  targetCalories: number;
  goalWeightKg: number;
  startWeightKg: number;
  /** Minimum intake we will ever recommend. */
  floorCalories: number;
}

export type ProgressStatus =
  'insufficient-data' | 'on-track' | 'too-slow' | 'too-fast' | 'stalled' | 'gaining';

export interface ProgressReport {
  status: ProgressStatus;
  /** Latest trend weight, kg. */
  trendKg: number | null;
  /** Measured rate over the last two weeks, kg/week (positive = loss). */
  measuredRateKgPerWeek: number | null;
  plannedRateKgPerWeek: number;
  /** Implied real-world deficit, kcal/day, derived from the measured rate. */
  impliedDeficitKcal: number | null;
  /** Recommended new daily calories, or null to keep the current target. */
  recommendedCalories: number | null;
  /** Change in kcal/day the recommendation represents (negative = eat less). */
  adjustmentKcal: number;
  /** Kilograms lost since start (trend-based), and % of the way to goal. */
  lostKg: number | null;
  progressPercent: number | null;
  /** Days of data available and days since the last entry. */
  daysOfData: number;
  daysSinceLastEntry: number | null;
  headline: string;
  detail: string;
}

/**
 * Compares the measured trend with the plan and recommends a calorie adjustment using
 * the standard coaching rule: wait for 14 days of data, then move intake by the implied gap
 * (capped at ±250 kcal per fortnight) and never below the floor.
 */
export function assessProgress(input: ProgressInput, today = toDay(new Date())): ProgressReport {
  const {
    entries,
    plannedRateKgPerWeek,
    targetCalories,
    goalWeightKg,
    startWeightKg,
    floorCalories,
  } = input;
  const series = trendSeries(entries);
  const daysOfData = series.length
    ? daysBetween(series[0]!.date, series[series.length - 1]!.date) + 1
    : 0;
  const latest = series[series.length - 1] ?? null;
  const daysSinceLastEntry = latest ? daysBetween(latest.date, today) : null;
  const trendKg = latest?.trendKg ?? null;
  const losing = goalWeightKg < startWeightKg;
  const totalToLose = Math.abs(startWeightKg - goalWeightKg);
  const lostKg =
    trendKg === null ? null : round(losing ? startWeightKg - trendKg : trendKg - startWeightKg, 2);
  const progressPercent =
    lostKg === null || totalToLose === 0
      ? null
      : round(Math.min(100, Math.max(0, (lostKg / totalToLose) * 100)), 0);

  const base = {
    trendKg,
    plannedRateKgPerWeek,
    lostKg,
    progressPercent,
    daysOfData,
    daysSinceLastEntry,
    recommendedCalories: null as number | null,
    adjustmentKcal: 0,
  };

  if (series.length < 7 || daysOfData < 14) {
    return {
      ...base,
      status: 'insufficient-data',
      measuredRateKgPerWeek: null,
      impliedDeficitKcal: null,
      headline:
        series.length === 0
          ? 'Log your first weigh-in'
          : `${Math.max(0, 14 - daysOfData)} more days of data needed`,
      detail:
        'Weight swings 1–2 kg day to day from water alone. Keep eating at your target and weigh in daily; after two weeks the trend is reliable enough to act on.',
    };
  }

  const slope = slopeKgPerDay(series, 14);
  const measuredRate = slope === null ? null : round(-slope * 7, 2); // positive = loss
  const impliedDeficit = measuredRate === null ? null : round((measuredRate * KCAL_PER_KG) / 7);
  const planned = losing ? plannedRateKgPerWeek : -plannedRateKgPerWeek;
  const measured = measuredRate ?? 0;

  // Tolerance: ±35% of planned rate or 0.15 kg/week, whichever is larger.
  const tol = Math.max(0.15, Math.abs(planned) * 0.35);
  let status: ProgressStatus;
  if (losing && measured < -0.1) status = 'gaining';
  else if (Math.abs(measured) < 0.1 && Math.abs(planned) >= 0.2) status = 'stalled';
  else if (Math.abs(measured - planned) <= tol) status = 'on-track';
  else if (Math.abs(measured) < Math.abs(planned)) status = 'too-slow';
  else status = 'too-fast';

  // Adjustment: close the gap between planned and measured deficit, capped at ±250 kcal.
  const gapKcal = ((planned - measured) * KCAL_PER_KG) / 7; // positive => need bigger deficit
  let adjustment = 0;
  if (status === 'too-slow' || status === 'stalled' || status === 'gaining')
    adjustment = -Math.min(250, Math.max(100, round(gapKcal, -1)));
  else if (status === 'too-fast') adjustment = Math.min(250, Math.max(100, round(-gapKcal, -1)));
  let recommended = adjustment
    ? Math.max(floorCalories, round(targetCalories + adjustment, -1))
    : null;
  if (recommended !== null && recommended === targetCalories) recommended = null;
  const finalAdjust = recommended === null ? 0 : recommended - targetCalories;

  const text: Record<ProgressStatus, [string, string]> = {
    'insufficient-data': ['', ''],
    'on-track': [
      'On track',
      `Your trend is moving at ${Math.abs(measured)} kg/week against a plan of ${Math.abs(planned)}. Change nothing; keep logging.`,
    ],
    'too-slow': [
      'Slower than planned',
      `Your trend is moving ${Math.abs(measured)} kg/week versus ${Math.abs(planned)} planned, which implies a real deficit of about ${impliedDeficit} kcal/day. ${
        recommended
          ? `Drop intake to ${recommended} kcal, or add ~${Math.abs(finalAdjust)} kcal of daily movement, then re-check in two weeks.`
          : 'You are already at the intake floor: add daily steps rather than cutting food.'
      }`,
    ],
    'too-fast': [
      'Faster than planned',
      `You are losing ${Math.abs(measured)} kg/week, more than the ${Math.abs(planned)} you planned. Fast early loss is mostly water; if it continues, raise intake to ${recommended ?? targetCalories} kcal to protect muscle and energy.`,
    ],
    stalled: [
      'Stalled',
      `Your trend has been flat for two weeks. That usually means the deficit has shrunk to nothing through adaptation, lower activity or logging drift. ${
        recommended
          ? `Reduce intake to ${recommended} kcal or add ~${Math.abs(finalAdjust)} kcal of activity.`
          : 'You are at the intake floor: add daily movement and review logging accuracy.'
      } If you have been dieting for 12+ weeks, take a 1–2 week maintenance break first.`,
    ],
    gaining: [
      'Trend is rising',
      `Your trend weight has risen over two weeks. Check logging accuracy and weekend intake, then ${recommended ? `set intake to ${recommended} kcal` : 'add activity'} and reassess in 14 days.`,
    ],
  };
  const [headline, detail] = text[status];
  return {
    ...base,
    status,
    measuredRateKgPerWeek: measuredRate,
    impliedDeficitKcal: impliedDeficit,
    recommendedCalories: recommended,
    adjustmentKcal: finalAdjust,
    headline,
    detail,
  };
}

/** Weekly averages for a table: [{ weekStart, avgKg, change }] newest first. */
export function weeklyAverages(
  entries: WeighIn[],
): Array<{ weekStart: string; avgKg: number; changeKg: number | null; count: number }> {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = parseDay(sorted[0]!.date);
  const buckets = new Map<string, number[]>();
  for (const e of sorted) {
    const idx = Math.floor(daysBetween(toDay(first), e.date) / 7);
    const start = toDay(new Date(first.getTime() + idx * 7 * 86_400_000));
    buckets.set(start, [...(buckets.get(start) ?? []), e.weightKg]);
  }
  const rows = [...buckets.entries()].map(([weekStart, ws]) => ({
    weekStart,
    avgKg: round(ws.reduce((a, b) => a + b, 0) / ws.length, 2),
    count: ws.length,
  }));
  return rows
    .map((r, i) => ({ ...r, changeKg: i === 0 ? null : round(r.avgKg - rows[i - 1]!.avgKg, 2) }))
    .reverse();
}
