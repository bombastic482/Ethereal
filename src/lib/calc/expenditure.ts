import { KCAL_PER_KG } from './energy';
import { daysBetween, trendSeries, type WeighIn } from './trend';
import { round } from './units';

export interface IntakeDay {
  date: string;
  kcal: number;
}

export interface ExpenditureEstimate {
  /** Estimated true daily expenditure, kcal/day. */
  tdee: number;
  /** Lower / upper plausible bounds. */
  low: number;
  high: number;
  /** Days of paired intake + weight data used. */
  days: number;
  /** Average logged intake over the window. */
  avgIntake: number;
  /** Trend weight change over the window, kg (negative = loss). */
  trendChangeKg: number;
  /** Difference from the formula estimate (positive = you burn more than the formula says). */
  vsFormula: number | null;
  confidence: 'low' | 'medium' | 'high';
  note: string;
}

/**
 * Estimates real-world energy expenditure from what you ate and what the scale did:
 *   TDEE ≈ average intake + (energy value of trend-weight change) / days.
 * This is the method adaptive coaching apps use; it is only as good as the logging.
 * Requires at least 10 logged days with weigh-ins spanning 14+ days.
 */
export function estimateExpenditure(
  intake: IntakeDay[],
  weighIns: WeighIn[],
  formulaTdee: number | null = null,
  windowDays = 21,
): ExpenditureEstimate | null {
  const trend = trendSeries(weighIns);
  if (trend.length < 2) return null;
  const end = trend[trend.length - 1]!.date;
  const startBound = shiftDate(end, -(windowDays - 1));
  const window = trend.filter((p) => p.date >= startBound);
  if (window.length < 2) return null;
  const first = window[0]!;
  const last = window[window.length - 1]!;
  const span = daysBetween(first.date, last.date);
  if (span < 13) return null;

  const loggedDays = intake.filter(
    (d) => d.date >= first.date && d.date <= last.date && d.kcal > 0,
  );
  if (loggedDays.length < 10) return null;
  // Days without a log are assumed to equal the average of logged days (conservative).
  const avgIntake = loggedDays.reduce((a, d) => a + d.kcal, 0) / loggedDays.length;
  const trendChangeKg = last.trendKg - first.trendKg;
  const energyChangePerDay = (trendChangeKg * KCAL_PER_KG) / span;
  const tdee = avgIntake - energyChangePerDay;

  const coverage = loggedDays.length / (span + 1);
  const confidence: ExpenditureEstimate['confidence'] =
    coverage >= 0.85 && span >= 20 ? 'high' : coverage >= 0.6 ? 'medium' : 'low';
  const spread = confidence === 'high' ? 0.05 : confidence === 'medium' ? 0.08 : 0.12;
  const vsFormula = formulaTdee === null ? null : round(tdee - formulaTdee);

  let note: string;
  if (vsFormula === null) note = 'Based on your logged intake and trend weight.';
  else if (Math.abs(vsFormula) < 100)
    note = 'Your logging and the formula agree closely. Trust the plan.';
  else if (vsFormula > 0)
    note = `You appear to burn about ${vsFormula} kcal/day more than the formula predicts. Under-logging food also looks like this, so check portions before raising your target.`;
  else
    note = `You appear to burn about ${-vsFormula} kcal/day less than the formula predicts. This is common after weeks of dieting (adaptation) or when activity drops.`;

  return {
    tdee: round(tdee),
    low: round(tdee * (1 - spread)),
    high: round(tdee * (1 + spread)),
    days: loggedDays.length,
    avgIntake: round(avgIntake),
    trendChangeKg: round(trendChangeKg, 2),
    vsFormula,
    confidence,
    note,
  };
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
