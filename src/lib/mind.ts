/**
 * The part of progress that isn't on a scale: how you feel, how much energy you have, and
 * whether the plan is still serving you. A short daily check-in shapes the day (a gentle day
 * when you're running low), a comeback mode welcomes you back after a gap without guilt, and a
 * few guardrails speak up when you're pushing too hard.
 */
import { createStore } from './store';

export interface CheckIn {
  date: string;
  /** 1 rough … 5 great. */
  mood: number;
  /** 1 empty … 5 full. */
  energy: number;
  /** Hours slept last night, if given. */
  sleepH?: number;
}

export interface MindState {
  checkins: CheckIn[];
  /** Dates with a breathing session done. */
  recharges: string[];
  /** Guardrail or card id → the date it was dismissed; it stays quiet for a week. */
  dismissed: Record<string, string>;
}

export const MOODS = ['Rough', 'Low', 'Okay', 'Good', 'Great'] as const;
export const ENERGY = ['Empty', 'Low', 'Fine', 'Good', 'Full'] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const level = (v: unknown) => (typeof v === 'number' && v >= 1 && v <= 5 ? Math.round(v) : null);

export const mindStore = createStore<MindState>(
  'ethereal:mind:v1',
  { checkins: [], recharges: [], dismissed: {} },
  (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<MindState>;
    return {
      checkins: Array.isArray(r.checkins)
        ? r.checkins
            .filter(
              (c): c is CheckIn =>
                !!c &&
                ISO.test(String(c.date)) &&
                level(c.mood) !== null &&
                level(c.energy) !== null,
            )
            .map((c) => ({
              date: c.date,
              mood: level(c.mood)!,
              energy: level(c.energy)!,
              ...(typeof c.sleepH === 'number' && c.sleepH >= 0 && c.sleepH <= 16
                ? { sleepH: c.sleepH }
                : {}),
            }))
        : [],
      recharges: Array.isArray(r.recharges)
        ? r.recharges.filter((d): d is string => ISO.test(String(d)))
        : [],
      dismissed:
        r.dismissed && typeof r.dismissed === 'object'
          ? Object.fromEntries(Object.entries(r.dismissed).filter(([, v]) => ISO.test(String(v))))
          : {},
    };
  },
);

export function saveCheckIn(c: CheckIn): void {
  const { checkins } = mindStore.get();
  mindStore.patch({
    checkins: [...checkins.filter((x) => x.date !== c.date), c].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  });
}

export function addRecharge(date: string): void {
  const { recharges } = mindStore.get();
  if (!recharges.includes(date)) mindStore.patch({ recharges: [...recharges, date] });
}

/** A gentle day: low mood or energy, or a short night. Training goes optional and shorter. */
export function isGentleDay(c: CheckIn | undefined): boolean {
  return !!c && (c.mood <= 2 || c.energy <= 2 || (c.sleepH !== undefined && c.sleepH < 5));
}

const DAY = 864e5;
const between = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/**
 * Days since you last did anything at all in the app: logged food, weighed in, trained, checked
 * in. Null when there is no history yet (a new user is not "coming back").
 */
export function daysAway(activity: Iterable<string>, today: string): number | null {
  let last: string | null = null;
  for (const d of activity) if (d <= today && (!last || d > last)) last = d;
  return last ? between(last, today) : null;
}

/** Back after three days or more. */
export const isComeback = (away: number | null) => away !== null && away >= 3;

export interface GuardrailInput {
  today: string;
  /** Workout dates, any order. */
  workouts: readonly string[];
  /** How the last workouts felt, oldest first: 1 easy, 2 right, 3 hard. */
  feels: readonly (1 | 2 | 3 | undefined)[];
  /** Daily intake for days with food logged: date → kcal. */
  intake: Readonly<Record<string, number>>;
  /** The calorie floor for this person. */
  floorKcal: number;
  /** Trend change in kg over the last 21 days (negative is loss), and current weight. */
  lossPerWeekKg: number | null;
  weightKg: number;
  checkins: readonly CheckIn[];
}

export interface Guardrail {
  id: string;
  title: string;
  text: string;
}

/**
 * Speaks up when the plan stops serving you. Each rule is deliberately conservative: better a
 * rare, useful nudge than a nagging app.
 */
export function guardrails(g: GuardrailInput): Guardrail[] {
  const out: Guardrail[] = [];
  const recent = (d: string, days: number) => {
    const ago = between(d, g.today);
    return ago >= 0 && ago < days;
  };

  // Training every day for a week.
  const days = new Set(g.workouts.filter((d) => recent(d, 7)));
  if (days.size >= 7)
    out.push({
      id: 'rest',
      title: 'Seven days straight',
      text: 'Muscle grows while you rest. Take a day off training: a walk counts, and tomorrow’s session will be better for it.',
    });

  // Three hard sessions in a row.
  const last3 = g.feels.slice(-3);
  if (last3.length === 3 && last3.every((f) => f === 3))
    out.push({
      id: 'hard',
      title: 'Three hard sessions in a row',
      text: 'Hard every time means the plan is ahead of you. Use Too hard on the toughest move, or switch to 20-minute sessions for a week.',
    });

  // Eating under the floor for three logged days running.
  const lastThree = [0, 1, 2].map((n) =>
    new Date(Date.parse(`${g.today}T00:00:00Z`) - (n + 1) * DAY).toISOString().slice(0, 10),
  );
  if (
    g.floorKcal > 0 &&
    lastThree.every(
      (d) => g.intake[d] !== undefined && g.intake[d]! > 300 && g.intake[d]! < g.floorKcal * 0.9,
    )
  )
    out.push({
      id: 'under',
      title: 'Eating below your floor',
      text: 'Three days under your minimum. Going lower doesn’t speed things up for long: it costs muscle, sleep and mood. Add a proper meal today.',
    });

  // Losing more than 1% of body weight a week.
  if (g.lossPerWeekKg !== null && g.weightKg > 0 && -g.lossPerWeekKg > g.weightKg * 0.01)
    out.push({
      id: 'fast',
      title: 'Losing faster than 1% a week',
      text: 'Fast is not better past this point: more of it comes from muscle. Eat a little more and let the trend settle around 0.5 to 1%.',
    });

  // Low for most of the past week.
  const week = g.checkins.filter((c) => recent(c.date, 7));
  if (week.length >= 4 && week.filter((c) => c.mood <= 2).length >= 4)
    out.push({
      id: 'low',
      title: 'A low week',
      text: 'Most days this week have felt rough. Be kind to yourself: keep the basics (sleep, a walk, regular meals) and drop the rest for now. If it keeps up, talk to someone you trust or your doctor.',
    });

  return out;
}

/** Average mood and energy over the last `days`, or null without check-ins. */
export function averages(checkins: readonly CheckIn[], today: string, days = 7) {
  const rows = checkins.filter((c) => {
    const ago = between(c.date, today);
    return ago >= 0 && ago < days;
  });
  if (!rows.length) return null;
  const avg = (k: 'mood' | 'energy') =>
    Math.round((rows.reduce((s, c) => s + c[k], 0) / rows.length) * 10) / 10;
  return { mood: avg('mood'), energy: avg('energy'), count: rows.length };
}

/** Hides a card or guardrail for a week. */
export function dismiss(id: string, today: string): void {
  mindStore.patch({ dismissed: { ...mindStore.get().dismissed, [id]: today } });
}

/** Whether a card was dismissed within the last week. */
export function isDismissed(
  dismissed: Readonly<Record<string, string>>,
  id: string,
  today: string,
): boolean {
  const d = dismissed[id];
  return !!d && between(d, today) < 7;
}
