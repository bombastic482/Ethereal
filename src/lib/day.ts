/**
 * Builds today's plan: the handful of things that matter, each at a time that fits your day.
 * Meals, medicines, prayers, the workout or a walk, the weigh-in, winding down and sleep, placed
 * around your wake time, meals and busy blocks. Nothing here touches the DOM or storage, so the
 * whole day can be tested from plain inputs.
 */
import { fromMinutes, medTimes, toMinutes, type Life } from './life';
import type { PrayerName, PrayerTimes } from './prayer';
import { createStore } from './store';

export type DayKind =
  | 'wake'
  | 'meal'
  | 'med'
  | 'prayer'
  | 'workout'
  | 'walk'
  | 'weigh'
  | 'photo'
  | 'wind'
  | 'sleep'
  | 'busy';

export interface DayItem {
  /** Stable for the day, so ticks survive a reload. */
  id: string;
  kind: DayKind;
  /** 'HH:MM', local. */
  time: string;
  end?: string;
  title: string;
  detail?: string;
  /** Done, either ticked or detected from what you logged. */
  done: boolean;
  /** Detected from your data rather than ticked; cannot be unticked here. */
  auto: boolean;
  /** Context only (busy blocks): shown, never asked of you. */
  passive?: boolean;
  /** Meal slot, for meals. */
  meal?: 'breakfast' | 'lunch' | 'dinner';
}

export interface DayContext {
  date: string;
  weekday: number;
  life: Life;
  /** Prayer times for the date, when turned on. */
  prayers: PrayerTimes | null;
  /** Today is one of your training days. */
  trainingDay: boolean;
  /** A workout was logged today. */
  trained: boolean;
  /** Session length in minutes, for the workout block. */
  sessionMinutes: number;
  walkMinutes: number;
  /** Meal slots with food logged today. */
  logged: ReadonlySet<'breakfast' | 'lunch' | 'dinner' | 'snack'>;
  /** A weigh-in exists for today. */
  weighed: boolean;
  /** A progress photo is due today. */
  photoDue: boolean;
  /** Items ticked by hand today. */
  ticks: ReadonlySet<string>;
  /** Convert a Date to local minutes since midnight (injected so tests can fix the zone). */
  minutesOf: (d: Date) => number;
}

const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_TITLE: Record<PrayerName, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

interface Span {
  start: number;
  end: number;
}

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/**
 * Picks the workout start: the first candidate that sits clear of busy blocks and meals, inside
 * waking hours. Evening before dinner is the default; after work, morning and midday follow.
 */
export function workoutSlot(
  life: Life,
  weekday: number,
  minutes: number,
  extraBusy: Span[] = [],
): number {
  const wake = toMinutes(life.wake);
  let sleep = toMinutes(life.sleep);
  if (sleep <= wake) sleep += 1440;
  const busy: Span[] = [
    ...life.busy
      .filter((b) => b.days.includes(weekday))
      .map((b) => {
        const s = toMinutes(b.start);
        let e = toMinutes(b.end);
        if (e <= s) e += 1440;
        return { start: s, end: e };
      }),
    ...extraBusy,
  ];
  const meals = [life.meals.breakfast, life.meals.lunch, life.meals.dinner].map(toMinutes);
  // Not on a full stomach: an hour after a meal, and finish 30 minutes before the next.
  const mealBlocks = meals.map((m) => ({ start: m - 30, end: m + 60 }));
  const lastBusyEnd = busy.length ? Math.max(...busy.map((b) => b.end)) : null;
  const dinner = toMinutes(life.meals.dinner);
  const candidates = [
    dinner - 30 - minutes,
    ...(lastBusyEnd !== null ? [lastBusyEnd + 30] : []),
    wake + 45,
    toMinutes(life.meals.lunch) + 90,
    dinner + 90,
  ];
  for (const start of candidates) {
    const span = { start, end: start + minutes };
    if (start < wake + 30 || span.end > sleep - 90) continue;
    if (busy.some((b) => overlaps(span, b))) continue;
    if (mealBlocks.some((m) => overlaps(span, m))) continue;
    return start;
  }
  return Math.max(wake + 45, dinner - 30 - minutes);
}

export function buildDay(ctx: DayContext): DayItem[] {
  const { life, ticks } = ctx;
  const items: DayItem[] = [];
  const add = (item: Omit<DayItem, 'done' | 'auto'> & { done?: boolean; auto?: boolean }) =>
    items.push({ ...item, done: item.done ?? ticks.has(item.id), auto: item.auto ?? false });

  const fasting = life.fasting && ctx.prayers !== null;
  const fajr = ctx.prayers ? ctx.minutesOf(ctx.prayers.fajr) : null;
  const maghrib = ctx.prayers ? ctx.minutesOf(ctx.prayers.maghrib) : null;

  add({
    id: 'wake',
    kind: 'wake',
    time: life.wake,
    title: 'Wake up',
    detail: 'Water first, then daylight if you can.',
  });

  // Meals. Fasting moves them to suhoor, iftar and a lighter late meal.
  const meals: Array<{
    slot: 'breakfast' | 'lunch' | 'dinner';
    time: string;
    title: string;
    detail: string;
  }> =
    fasting && fajr !== null && maghrib !== null
      ? [
          {
            slot: 'breakfast',
            time: fromMinutes(fajr - 40),
            title: 'Suhoor',
            detail: 'Protein, slow carbs and water. It carries you to iftar.',
          },
          {
            slot: 'lunch',
            time: fromMinutes(maghrib),
            title: 'Iftar',
            detail: 'Dates and water, pray, then a proper plate.',
          },
          {
            slot: 'dinner',
            time: fromMinutes(maghrib + 180),
            title: 'Late meal',
            detail: 'Lighter: protein and vegetables.',
          },
        ]
      : [
          {
            slot: 'breakfast',
            time: life.meals.breakfast,
            title: 'Breakfast',
            detail: 'Start with protein: eggs, yogurt or laban.',
          },
          {
            slot: 'lunch',
            time: life.meals.lunch,
            title: 'Lunch',
            detail: 'Half the plate vegetables, a palm of protein.',
          },
          {
            slot: 'dinner',
            time: life.meals.dinner,
            title: 'Dinner',
            detail: 'Protein first, then the rest.',
          },
        ];
  for (const m of meals) {
    const done = ctx.logged.has(m.slot);
    add({
      id: `meal-${m.slot}`,
      kind: 'meal',
      meal: m.slot,
      time: m.time,
      title: m.title,
      detail: m.detail,
      done: done || ticks.has(`meal-${m.slot}`),
      auto: done,
    });
  }

  // Medicines and supplements, each dose at its own time.
  const mealsForMeds = fasting
    ? { ...life.meals, breakfast: meals[0]!.time, lunch: meals[1]!.time, dinner: meals[2]!.time }
    : life.meals;
  for (const med of life.meds) {
    for (const t of medTimes(med, { ...life, meals: mealsForMeds })) {
      add({
        id: `med-${med.id}-${t}`,
        kind: 'med',
        time: t,
        title: med.name,
        detail: [
          med.dose,
          {
            any: '',
            'with-food': 'with food',
            'empty-stomach': 'on an empty stomach',
            bedtime: 'before bed',
          }[med.rule],
        ]
          .filter(Boolean)
          .join(', '),
      });
    }
  }

  if (ctx.prayers) {
    for (const p of PRAYERS) {
      add({
        id: `prayer-${p}`,
        kind: 'prayer',
        time: fromMinutes(ctx.minutesOf(ctx.prayers[p])),
        title: PRAYER_TITLE[p],
      });
    }
  }

  for (const b of life.busy.filter((x) => x.days.includes(ctx.weekday))) {
    add({
      id: `busy-${b.id}`,
      kind: 'busy',
      time: b.start,
      end: b.end,
      title: b.label,
      passive: true,
    });
  }

  // Training, or a walk on rest days.
  const prayerBlocks: Span[] = ctx.prayers
    ? PRAYERS.map((p) => {
        const m = ctx.minutesOf(ctx.prayers![p]);
        return { start: m - 5, end: m + 15 };
      })
    : [];
  if (ctx.trainingDay || ctx.trained) {
    let start: number;
    if (fasting && maghrib !== null) start = maghrib + 90;
    else start = workoutSlot(life, ctx.weekday, ctx.sessionMinutes, prayerBlocks);
    add({
      id: 'workout',
      kind: 'workout',
      time: fromMinutes(start),
      end: fromMinutes(start + ctx.sessionMinutes),
      title: 'Workout',
      detail: `About ${ctx.sessionMinutes} minutes, then a ${ctx.walkMinutes}-minute walk.`,
      done: ctx.trained,
      auto: ctx.trained,
    });
  } else {
    const dinnerAt = toMinutes(meals[2]!.time);
    add({
      id: 'walk',
      kind: 'walk',
      time: fromMinutes(dinnerAt + 30),
      title: `${ctx.walkMinutes}-minute walk`,
      detail: 'A rest day from training, not from moving. After a meal is the best time.',
    });
  }

  if (ctx.weekday === life.weighDay) {
    add({
      id: 'weigh',
      kind: 'weigh',
      time: life.weighTime,
      title: 'Weigh-in',
      detail: 'After the bathroom, before food and drink.',
      done: ctx.weighed,
      auto: ctx.weighed,
    });
    if (ctx.photoDue) {
      add({
        id: 'photo',
        kind: 'photo',
        time: fromMinutes(toMinutes(life.weighTime) + 5),
        title: 'Progress photo',
        detail: 'Same spot, same light: front and side.',
      });
    }
  }

  add({
    id: 'wind',
    kind: 'wind',
    time: fromMinutes(toMinutes(life.sleep) - 45),
    title: 'Wind down',
    detail: 'Screens away, lights low, tomorrow can wait.',
  });
  add({
    id: 'sleep',
    kind: 'sleep',
    time: life.sleep,
    title: 'Lights out',
    detail: 'The same time most nights matters more than the hour.',
  });

  // Order by time across the day, which starts at wake-up or Fajr, whichever is earlier; a
  // bedtime after midnight sorts last.
  const start = Math.min(toMinutes(life.wake), fajr ?? Infinity) - 30;
  const key = (t: string) => (toMinutes(t) - start + 1440) % 1440;
  return items.sort((a, b) => key(a.time) - key(b.time) || (a.kind === 'wake' ? -1 : 0));
}

/** Minutes into the day, where the day starts half an hour before its first item. */
function relativeTo(items: readonly DayItem[]) {
  const start = (items[0] ? toMinutes(items[0].time) : 0) - 30;
  return (m: number) => (m - start + 1440) % 1440;
}

/**
 * What to show as "Now": the earliest open item from 45 minutes ago onward, or, once the day's
 * done, nothing. Busy blocks are context only and never the answer.
 */
export function nowItem(items: readonly DayItem[], nowMinutes: number): DayItem | null {
  const rel = relativeTo(items);
  const now = rel(nowMinutes);
  const open = items.filter((i) => !i.done && !i.passive);
  return open.find((i) => rel(toMinutes(i.time)) >= now - 45) ?? null;
}

/** Open items that have slipped past: more than 45 minutes ago. */
export function missedItems(items: readonly DayItem[], nowMinutes: number): DayItem[] {
  const rel = relativeTo(items);
  const now = rel(nowMinutes);
  return items.filter(
    (i) => !i.done && !i.passive && i.kind !== 'wake' && rel(toMinutes(i.time)) < now - 45,
  );
}

/** Hand-ticked items per day. Only the last fortnight is kept. */
export const dayStore = createStore<{ ticks: Record<string, string[]> }>(
  'ethereal:day:v1',
  { ticks: {} },
  (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const t = (raw as { ticks?: unknown }).ticks;
    if (!t || typeof t !== 'object') return { ticks: {} };
    const ticks: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(t)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(v))
        ticks[k] = v.filter((x) => typeof x === 'string');
    }
    return { ticks };
  },
);

export function toggleTick(date: string, id: string): void {
  const { ticks } = dayStore.get();
  const day = new Set(ticks[date] ?? []);
  if (day.has(id)) day.delete(id);
  else day.add(id);
  const cutoff = new Date(Date.parse(`${date}T00:00:00Z`) - 14 * 864e5).toISOString().slice(0, 10);
  const kept = Object.fromEntries(Object.entries(ticks).filter(([d]) => d >= cutoff && d !== date));
  dayStore.set({ ticks: { ...kept, [date]: [...day] } });
}
