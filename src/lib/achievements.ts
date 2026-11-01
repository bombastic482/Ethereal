/**
 * Milestones worth marking: training, consistency and the body, not just the scale. Each knows
 * when it was reached (so it can be celebrated once) or how close it is (so the next one is
 * visible). Plain data in, plain data out.
 */
import { bodyFatCategory } from './calc/body-fat';
import { trendSeries, type WeighIn } from './calc/trend';
import type { Sex } from './calc/units';
import type { CompositionPoint, Measure } from './body';
import { LADDERS } from './train/program';
import type { WorkoutLog } from './train/store';

export type AchievementIcon =
  'dumbbell' | 'flame' | 'scale' | 'ruler' | 'spark' | 'check' | 'target';

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  icon: AchievementIcon;
  /** Date reached, or null while still ahead. */
  on: string | null;
  /** 0 to 1 toward it. */
  progress: number;
}

export interface AchievementInput {
  entries: readonly WeighIn[];
  workouts: readonly WorkoutLog[];
  /** Dates with food logged (any order, duplicates fine). */
  foodDates: readonly string[];
  measures: readonly Measure[];
  composition: readonly CompositionPoint[];
  sex: Sex;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** The date the n-th item arrived, from a sorted list of dates. */
const nth = (dates: readonly string[], n: number) => (dates.length >= n ? dates[n - 1]! : null);

export function achievements(input: AchievementInput): Achievement[] {
  const out: Achievement[] = [];
  const workoutDates = [...input.workouts].map((w) => w.date).sort();
  const days = [...new Set(input.foodDates)].sort();

  const count = (
    id: string,
    title: string,
    detail: string,
    icon: AchievementIcon,
    dates: string[],
    n: number,
  ) =>
    out.push({ id, title, detail, icon, on: nth(dates, n), progress: clamp01(dates.length / n) });

  // Showing up.
  const firstAny =
    [workoutDates[0], days[0], input.entries[0]?.date].filter(Boolean).sort()[0] ?? null;
  out.push({
    id: 'first-step',
    title: 'First step',
    detail: 'Logged something. Starting is the hardest part.',
    icon: 'spark',
    on: firstAny,
    progress: firstAny ? 1 : 0,
  });
  count('workout-1', 'First workout', 'One session done.', 'dumbbell', workoutDates, 1);
  count('workout-10', 'Ten workouts', 'A habit is forming.', 'dumbbell', workoutDates, 10);
  count('workout-30', 'Thirty workouts', 'This is who you are now.', 'dumbbell', workoutDates, 30);
  count('log-7', 'A week of logging', 'Seven days of food logged.', 'flame', days, 7);
  count('log-30', 'A month of logging', 'Thirty days of food logged.', 'flame', days, 30);

  // Four training weeks in a row.
  const weekOf = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / (7 * 864e5) + 4 / 7);
  const weeks = [...new Set(workoutDates.map(weekOf))].sort((a, b) => a - b);
  let run = 0;
  let best = 0;
  let streakOn: string | null = null;
  weeks.forEach((w, i) => {
    run = i > 0 && w === weeks[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    if (run === 4 && !streakOn) streakOn = workoutDates.find((d) => weekOf(d) === w) ?? null;
  });
  out.push({
    id: 'weeks-4',
    title: 'Four weeks running',
    detail: 'Trained every week for a month.',
    icon: 'check',
    on: streakOn,
    progress: clamp01(best / 4),
  });

  // The first full push-up: any logged set of the push-up or a harder push move.
  const push = LADDERS.push ?? [];
  const from = push.indexOf('push-up');
  const fullPush = new Set(push.slice(from));
  const pushOn =
    [...input.workouts]
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((w) => w.sets.some((s) => fullPush.has(s.exerciseId) && s.value > 0))?.date ?? null;
  const reached = Math.max(
    -1,
    ...input.workouts.flatMap((w) => w.sets.map((s) => push.indexOf(s.exerciseId))),
  );
  out.push({
    id: 'push-up',
    title: 'A full push-up',
    detail: 'From the floor, on your toes.',
    icon: 'dumbbell',
    on: pushOn,
    progress: pushOn ? 1 : clamp01((reached + 1) / (from + 1)),
  });

  // The scale, through the trend.
  const trend = trendSeries([...input.entries]);
  if (trend.length) {
    const start = input.entries.length
      ? [...input.entries].sort((a, b) => a.date.localeCompare(b.date))[0]!.weightKg
      : trend[0]!.trendKg;
    const lost = (kg: number) => trend.find((p) => start - p.trendKg >= kg)?.date ?? null;
    const latestLoss = start - trend[trend.length - 1]!.trendKg;
    out.push({
      id: 'kg-2',
      title: 'Two kilos down',
      detail: 'On the trend, not a lucky morning.',
      icon: 'scale',
      on: lost(2),
      progress: clamp01(latestLoss / 2),
    });
    const fivePct = start * 0.05;
    out.push({
      id: 'pct-5',
      title: '5% lighter',
      detail: 'Where blood pressure and blood sugar start to improve.',
      icon: 'target',
      on: lost(fivePct),
      progress: clamp01(latestLoss / fivePct),
    });
  }

  // The tape.
  const waists: Array<{ date: string; cm: number }> = [
    ...input.measures.filter((m) => m.waistCm).map((m) => ({ date: m.date, cm: m.waistCm! })),
    ...input.entries.filter((e) => e.waistCm).map((e) => ({ date: e.date, cm: e.waistCm! })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  out.push({
    id: 'measured',
    title: 'Measured up',
    detail: 'A first tape measurement to compare against.',
    icon: 'ruler',
    on: input.measures[0]?.date ?? waists[0]?.date ?? null,
    progress: input.measures.length || waists.length ? 1 : 0,
  });
  if (waists.length) {
    const first = waists[0]!.cm;
    const down5 = waists.find((w) => first - w.cm >= 5)?.date ?? null;
    out.push({
      id: 'waist-5',
      title: '5 cm off the waist',
      detail: 'The number that tracks belly fat best.',
      icon: 'ruler',
      on: down5,
      progress: clamp01((first - waists[waists.length - 1]!.cm) / 5),
    });
  }

  // A better body-fat band, per source so a scale and a tape are never compared.
  for (const source of ['tape', 'scale'] as const) {
    const pts = input.composition.filter((p) => p.source === source);
    if (pts.length < 2) continue;
    const rank = (bf: number) => {
      const band = bodyFatCategory(bf, input.sex).category;
      return ['essential', 'athletes', 'fitness', 'average', 'obese'].indexOf(band);
    };
    const firstRank = rank(pts[0]!.bodyFat);
    const better = pts.find((p) => rank(p.bodyFat) < firstRank && rank(p.bodyFat) >= 1);
    out.push({
      id: `band-${source}`,
      title: 'A new body-fat band',
      detail: source === 'tape' ? 'By the tape measure.' : 'By your smart scale.',
      icon: 'target',
      on: better?.date ?? null,
      progress: better ? 1 : 0.5,
    });
    break;
  }

  return out;
}

/** Reached ones newest first, then the closest ones still ahead. */
export function ordered(list: readonly Achievement[]): Achievement[] {
  const done = list.filter((a) => a.on).sort((a, b) => b.on!.localeCompare(a.on!));
  const ahead = list.filter((a) => !a.on).sort((a, b) => b.progress - a.progress);
  return [...done, ...ahead];
}
