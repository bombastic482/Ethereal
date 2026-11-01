/**
 * Body composition beyond the scale: tape-measure sessions with a U.S. Navy body-fat estimate,
 * smart-scale readings carried on weigh-ins, a physique target, and the trend of fat and lean
 * mass. The scale says how much you weigh; this says what the weight is made of.
 */
import { calculateBodyFatNavy } from './calc/body-fat';
import type { WeighIn } from './calc/trend';
import { trendSeries } from './calc/trend';
import type { Sex } from './calc/units';
import { createStore } from './store';

/** One tape-measure session, in centimetres. */
export interface Measure {
  date: string;
  neckCm?: number;
  /** At the navel: the Navy method's waist for men. */
  waistCm?: number;
  /** At the narrowest point: the Navy method's waist for women. */
  waistNarrowCm?: number;
  hipsCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
}

export interface BodyState {
  measures: Measure[];
  /** Physique target as a body-fat percentage. */
  targetBodyFat: number | null;
  /** Milestones already celebrated, so each confetti burst happens once. */
  seen: string[];
}

const SITES = [
  'neckCm',
  'waistCm',
  'waistNarrowCm',
  'hipsCm',
  'chestCm',
  'armCm',
  'thighCm',
] as const;
export type Site = (typeof SITES)[number];

const plausible = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;

export const bodyStore = createStore<BodyState>(
  'ethereal:body:v1',
  { measures: [], targetBodyFat: null, seen: [] },
  (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<BodyState>;
    const measures = Array.isArray(r.measures)
      ? r.measures
          .filter(
            (m): m is Measure =>
              !!m && typeof m === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(m.date)),
          )
          .map((m) => {
            const out: Measure = { date: m.date };
            for (const s of SITES) {
              const v = plausible(m[s], 15, 250);
              if (v !== undefined) out[s] = v;
            }
            return out;
          })
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
    return {
      measures,
      targetBodyFat: plausible(r.targetBodyFat, 5, 45) ?? null,
      seen: Array.isArray(r.seen) ? r.seen.filter((x): x is string => typeof x === 'string') : [],
    };
  },
);

/** Saves a session, replacing any other on the same day. Empty sites are dropped. */
export function saveMeasure(m: Measure): void {
  const clean: Measure = { date: m.date };
  for (const s of SITES) if (m[s] !== undefined && m[s]! > 0) clean[s] = m[s];
  const { measures } = bodyStore.get();
  bodyStore.patch({
    measures: [...measures.filter((x) => x.date !== m.date), clean].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  });
}

/** The trend weight on (or nearest before) a date; the first weigh-in if all are later. */
export function weightOn(entries: readonly WeighIn[], date: string): number | null {
  const trend = trendSeries([...entries]);
  if (!trend.length) return null;
  let best = trend[0]!.trendKg;
  for (const p of trend) if (p.date <= date) best = p.trendKg;
  return best;
}

/**
 * The Navy body-fat estimate for a session, or null when the sites it needs are missing. Men need
 * neck and waist at the navel; women neck, the narrowest waist and hips.
 */
export function navyFor(
  m: Measure,
  who: { sex: Sex; heightCm: number },
  weightKg: number,
): number | null {
  const waist = who.sex === 'male' ? m.waistCm : (m.waistNarrowCm ?? m.waistCm);
  if (!m.neckCm || !waist || (who.sex === 'female' && !m.hipsCm)) return null;
  try {
    return calculateBodyFatNavy({
      sex: who.sex,
      heightCm: who.heightCm,
      weightKg,
      neckCm: m.neckCm,
      waistCm: waist,
      ...(m.hipsCm ? { hipCm: m.hipsCm } : {}),
    }).percent;
  } catch {
    return null;
  }
}

export interface CompositionPoint {
  date: string;
  bodyFat: number;
  weightKg: number;
  fatKg: number;
  leanKg: number;
  source: 'tape' | 'scale';
}

/**
 * Body fat over time from both sources: tape sessions (Navy, at that day's trend weight) and
 * smart-scale readings on weigh-ins. Kept apart by source, since scales read consistently high or
 * low for a person; it is each line's direction that counts.
 */
export function composition(
  measures: readonly Measure[],
  entries: readonly WeighIn[],
  who: { sex: Sex; heightCm: number },
  /** Used when there are no weigh-ins yet: the weight from your profile. */
  fallbackKg?: number,
): CompositionPoint[] {
  const out: CompositionPoint[] = [];
  for (const m of measures) {
    const w = weightOn(entries, m.date) ?? fallbackKg ?? null;
    if (w === null) continue;
    const bf = navyFor(m, who, w);
    if (bf === null) continue;
    out.push(point(m.date, bf, w, 'tape'));
  }
  for (const e of entries) {
    if (typeof e.bodyFatPct === 'number' && e.bodyFatPct > 2 && e.bodyFatPct < 70)
      out.push(point(e.date, e.bodyFatPct, e.weightKg, 'scale'));
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function point(
  date: string,
  bodyFat: number,
  weightKg: number,
  source: 'tape' | 'scale',
): CompositionPoint {
  const fatKg = Math.round(weightKg * bodyFat) / 100;
  return {
    date,
    bodyFat,
    weightKg,
    fatKg,
    leanKg: Math.round((weightKg - fatKg) * 100) / 100,
    source,
  };
}

/**
 * The weight at which you would reach a body-fat target while keeping today's lean mass. Losing
 * fat slowly with enough protein and strength work keeps most lean mass, so this is a fair aim;
 * the real number lands a little lower.
 */
export function targetWeight(leanKg: number, targetBodyFat: number): number {
  return Math.round((leanKg / (1 - targetBodyFat / 100)) * 10) / 10;
}

/** Sensible targets to offer, per sex: healthy, fit, athletic. */
export function targetPresets(sex: Sex): Array<{ value: number; label: string; hint: string }> {
  return sex === 'male'
    ? [
        { value: 22, label: 'Healthy', hint: 'Lower health risk' },
        { value: 17, label: 'Fit', hint: 'Lean, some definition' },
        { value: 13, label: 'Athletic', hint: 'Visible abs for most' },
      ]
    : [
        { value: 30, label: 'Healthy', hint: 'Lower health risk' },
        { value: 25, label: 'Fit', hint: 'Toned, some definition' },
        { value: 21, label: 'Athletic', hint: 'Lean and defined' },
      ];
}

/** Waist to height: under 0.5 is the simplest health check there is. */
export function waistToHeight(waistCm: number, heightCm: number): number {
  return Math.round((waistCm / heightCm) * 100) / 100;
}
