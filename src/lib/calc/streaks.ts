import { daysBetween } from './trend';

/** Consecutive days, ending today or yesterday, on which `dates` contains an entry. */
export function currentStreak(dates: Iterable<string>, today: string): number {
  const set = new Set(dates);
  if (set.size === 0) return 0;
  let cursor = set.has(today) ? today : shift(today, -1);
  if (!set.has(cursor)) return 0;
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = shift(cursor, -1);
  }
  return n;
}

export function longestStreak(dates: Iterable<string>): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && daysBetween(sorted[i - 1]!, sorted[i]!) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface Milestone {
  key: string;
  label: string;
  detail: string;
  reached: boolean;
  /** 0–1 progress toward the milestone. */
  progress: number;
}

/**
 * Weight milestones from trend weight: each 5% of start weight, every whole 5 kg (or 10 lb), and the goal.
 * Keeps the list short: the next unreached milestone plus everything already reached.
 */
export function weightMilestones(
  startKg: number,
  trendKg: number | null,
  goalKg: number,
  imperial = false,
): Milestone[] {
  const losing = goalKg < startKg;
  const total = Math.abs(startKg - goalKg);
  if (total === 0 || trendKg === null) return [];
  const done = losing ? startKg - trendKg : trendKg - startKg;
  const list: Milestone[] = [];
  const unit = imperial ? 4.5359237 : 5; // 10 lb or 5 kg steps
  for (let k = unit; k < total; k += unit) {
    const label = imperial
      ? `${Math.round(k / 0.45359237)} lb ${losing ? 'lost' : 'gained'}`
      : `${Math.round(k)} kg ${losing ? 'lost' : 'gained'}`;
    list.push({
      key: `kg-${k}`,
      label,
      detail: `${losing ? 'Down' : 'Up'} to ${(losing ? startKg - k : startKg + k).toFixed(1)} kg`,
      reached: done >= k,
      progress: Math.min(1, Math.max(0, done / k)),
    });
  }
  for (const pct of [5, 10, 15, 20]) {
    const k = (startKg * pct) / 100;
    if (k >= total) break;
    list.push({
      key: `pct-${pct}`,
      label: `${pct}% of body weight`,
      detail: 'Where health markers start to improve',
      reached: done >= k,
      progress: Math.min(1, Math.max(0, done / k)),
    });
  }
  list.push({
    key: 'goal',
    label: 'Goal weight',
    detail: `${goalKg.toFixed(1)} kg`,
    reached: done >= total,
    progress: Math.min(1, Math.max(0, done / total)),
  });
  list.sort((a, b) => Number(b.reached) - Number(a.reached) || b.progress - a.progress);
  const reached = list.filter((m) => m.reached);
  const next = list.filter((m) => !m.reached).sort((a, b) => b.progress - a.progress)[0];
  return next ? [...reached, next] : reached;
}
