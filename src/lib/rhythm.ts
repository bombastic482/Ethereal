/**
 * Your rhythm: how many of four everyday habits each day held, over the last few weeks. Not a
 * streak to break: a picture of showing up, where a quiet day is just a lighter square.
 *
 *   ate      some food was logged
 *   moved    a workout or exercise was logged, or 5,000+ steps
 *   checked  a mood check-in or a weigh-in
 *   plan     three or more things ticked off on Today
 */

export type Habit = 'ate' | 'moved' | 'checked' | 'plan';
export const HABITS: readonly Habit[] = ['ate', 'moved', 'checked', 'plan'];
export const HABIT_LABEL: Record<Habit, string> = {
  ate: 'Logged food',
  moved: 'Moved',
  checked: 'Checked in',
  plan: 'Followed the plan',
};

export interface RhythmInput {
  foodDates: Iterable<string>;
  exerciseDates: Iterable<string>;
  steps: Readonly<Record<string, number>>;
  checkinDates: Iterable<string>;
  weighDates: Iterable<string>;
  ticks: Readonly<Record<string, readonly string[]>>;
}

export interface RhythmDay {
  date: string;
  /** 0–4: how many habits held. */
  score: number;
  habits: Record<Habit, boolean>;
  /** After the end date: shown faded, never counted. */
  future: boolean;
}

const STEPS_FOR_MOVED = 5000;
const TICKS_FOR_PLAN = 3;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
/** 0 for Monday … 6 for Sunday. */
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/**
 * Whole weeks, Monday to Sunday, ending with the week that holds `end`, oldest first. Days
 * after `end` in that last week are marked as future.
 */
export function rhythm(input: RhythmInput, end: string, weeks = 12): RhythmDay[] {
  const food = new Set(input.foodDates);
  const ex = new Set(input.exerciseDates);
  const checked = new Set([...input.checkinDates, ...input.weighDates]);
  const lastSunday = addDays(end, 6 - weekday(end));
  const first = addDays(lastSunday, -(weeks * 7 - 1));
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(first, i);
    const future = date > end;
    const habits: Record<Habit, boolean> = {
      ate: !future && food.has(date),
      moved: !future && (ex.has(date) || (input.steps[date] ?? 0) >= STEPS_FOR_MOVED),
      checked: !future && checked.has(date),
      plan: !future && (input.ticks[date]?.length ?? 0) >= TICKS_FOR_PLAN,
    };
    return { date, habits, future, score: HABITS.filter((h) => habits[h]).length };
  });
}

/** Days in the last `n` (ending at the last non-future day) that held at least two habits. */
export function showedUp(days: readonly RhythmDay[], n = 28): { days: number; of: number } {
  const past = days.filter((d) => !d.future).slice(-n);
  return { days: past.filter((d) => d.score >= 2).length, of: past.length };
}
