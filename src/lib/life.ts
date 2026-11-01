/**
 * Everything about you beyond body stats: what you are working toward, the shape of your day,
 * your health notes and medicines, faith and fasting. The Today timeline is built from this, so
 * the app can tell you what to do next without you having to plan it.
 *
 * Stored on this device only, like everything else.
 */
import { createStore } from './store';
import type { PrayerMethod } from './prayer';

export type Goal =
  | 'lose-fat'
  | 'get-stronger'
  | 'move-more'
  | 'eat-better'
  | 'sleep-better'
  | 'calm-mind'
  | 'routine'
  | 'health';

export const GOALS: Array<{ id: Goal; label: string; hint: string }> = [
  { id: 'lose-fat', label: 'Lose fat', hint: 'A steady deficit you can live with' },
  { id: 'get-stronger', label: 'Get stronger', hint: 'Short home sessions that progress' },
  { id: 'move-more', label: 'Move more', hint: 'Walks and steps, every day' },
  { id: 'eat-better', label: 'Eat better', hint: 'More protein, fewer surprises' },
  { id: 'sleep-better', label: 'Sleep better', hint: 'A wind-down and a fixed wake time' },
  { id: 'calm-mind', label: 'Calmer mind', hint: 'Less noise, fewer bad days' },
  { id: 'routine', label: 'A daily routine', hint: 'Know what to do, and when' },
  { id: 'health', label: 'Look after my health', hint: 'Medicines, check-ups, symptoms' },
];

/** When a medicine or supplement should be taken relative to food and sleep. */
export type MedRule = 'any' | 'with-food' | 'empty-stomach' | 'bedtime';

export const MED_RULES: Array<{ id: MedRule; label: string }> = [
  { id: 'any', label: 'Any time' },
  { id: 'with-food', label: 'With food' },
  { id: 'empty-stomach', label: 'Empty stomach' },
  { id: 'bedtime', label: 'At bedtime' },
];

export interface Med {
  id: string;
  name: string;
  dose: string;
  /** 'HH:MM' times; for food or bedtime rules these are filled from your meals and sleep. */
  times: string[];
  rule: MedRule;
}

export interface Busy {
  id: string;
  label: string;
  start: string;
  end: string;
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
}

export interface Prayer {
  on: boolean;
  city: string;
  lat: number | null;
  lon: number | null;
  method: PrayerMethod;
  asr: 'standard' | 'hanafi';
}

export interface Life {
  name: string;
  goals: Goal[];
  /** Your reason, in your own words. Shown back to you on hard days. */
  why: string;
  wake: string;
  sleep: string;
  meals: { breakfast: string; lunch: string; dinner: string };
  busy: Busy[];
  conditions: string[];
  meds: Med[];
  avoid: string[];
  prayer: Prayer;
  /** Fasting mode: meals move to suhoor and iftar, workouts to after iftar. */
  fasting: boolean;
  weighDay: number;
  weighTime: string;
  /** Progress photos every this many weeks. */
  photoWeeks: number;
  /** First-run setup finished. */
  ready: boolean;
  /** When first-run setup finished (ISO time), so the first day does not count what came before. */
  joinedAt?: string;
}

export const DEFAULT_LIFE: Life = {
  name: '',
  goals: [],
  why: '',
  wake: '07:00',
  sleep: '23:00',
  meals: { breakfast: '08:00', lunch: '13:30', dinner: '19:30' },
  busy: [],
  conditions: [],
  meds: [],
  avoid: [],
  prayer: { on: false, city: '', lat: null, lon: null, method: 'mwl', asr: 'standard' },
  fasting: false,
  weighDay: 5,
  weighTime: '08:00',
  photoWeeks: 4,
  ready: false,
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = (v: unknown, fallback: string) =>
  typeof v === 'string' && TIME.test(v) ? v : fallback;
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];

export const lifeStore = createStore<Life>('ethereal:life:v1', DEFAULT_LIFE, (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Life>;
  const meals = (r.meals ?? {}) as Partial<Life['meals']>;
  const prayer = (r.prayer ?? {}) as Partial<Prayer>;
  return {
    name: typeof r.name === 'string' ? r.name.slice(0, 40) : '',
    goals: strings(r.goals).filter((g): g is Goal => GOALS.some((x) => x.id === g)),
    why: typeof r.why === 'string' ? r.why.slice(0, 280) : '',
    wake: time(r.wake, DEFAULT_LIFE.wake),
    sleep: time(r.sleep, DEFAULT_LIFE.sleep),
    meals: {
      breakfast: time(meals.breakfast, DEFAULT_LIFE.meals.breakfast),
      lunch: time(meals.lunch, DEFAULT_LIFE.meals.lunch),
      dinner: time(meals.dinner, DEFAULT_LIFE.meals.dinner),
    },
    busy: Array.isArray(r.busy)
      ? r.busy
          .filter((b): b is Busy => !!b && typeof b === 'object' && typeof b.label === 'string')
          .map((b) => ({
            id: String(b.id ?? Math.random().toString(36).slice(2)),
            label: b.label,
            start: time(b.start, '09:00'),
            end: time(b.end, '17:00'),
            days: Array.isArray(b.days) ? b.days.filter((d) => d >= 0 && d <= 6) : [],
          }))
      : [],
    conditions: strings(r.conditions),
    meds: Array.isArray(r.meds)
      ? r.meds
          .filter((m): m is Med => !!m && typeof m === 'object' && typeof m.name === 'string')
          .map((m) => ({
            id: String(m.id ?? Math.random().toString(36).slice(2)),
            name: m.name,
            dose: typeof m.dose === 'string' ? m.dose : '',
            times: strings(m.times).filter((t) => TIME.test(t)),
            rule: MED_RULES.some((x) => x.id === m.rule) ? m.rule : 'any',
          }))
      : [],
    avoid: strings(r.avoid),
    prayer: {
      on: prayer.on === true,
      city: typeof prayer.city === 'string' ? prayer.city : '',
      lat: typeof prayer.lat === 'number' && Math.abs(prayer.lat) <= 90 ? prayer.lat : null,
      lon: typeof prayer.lon === 'number' && Math.abs(prayer.lon) <= 180 ? prayer.lon : null,
      method: (prayer.method as PrayerMethod) ?? 'mwl',
      asr: prayer.asr === 'hanafi' ? 'hanafi' : 'standard',
    },
    fasting: r.fasting === true,
    weighDay: typeof r.weighDay === 'number' && r.weighDay >= 0 && r.weighDay <= 6 ? r.weighDay : 5,
    weighTime: time(r.weighTime, DEFAULT_LIFE.weighTime),
    photoWeeks:
      typeof r.photoWeeks === 'number' && r.photoWeeks >= 1 && r.photoWeeks <= 12
        ? r.photoWeeks
        : 4,
    ready: r.ready === true,
    ...(typeof r.joinedAt === 'string' && !Number.isNaN(Date.parse(r.joinedAt))
      ? { joinedAt: r.joinedAt }
      : {}),
  };
});

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Minutes since midnight for an 'HH:MM' string. */
export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** 'HH:MM' for minutes since midnight, wrapping past midnight. */
export const fromMinutes = (mins: number): string => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * The times a medicine is taken today. Rules tie it to your day: with food means with your
 * meals, empty stomach means 30 minutes before breakfast (or two hours after dinner for a second
 * dose), bedtime means half an hour before sleep. Times you set yourself win.
 */
export function medTimes(med: Med, life: Pick<Life, 'meals' | 'sleep' | 'wake'>): string[] {
  if (med.times.length) return [...med.times].sort();
  switch (med.rule) {
    case 'with-food':
      return [life.meals.breakfast];
    case 'empty-stomach':
      return [fromMinutes(toMinutes(life.meals.breakfast) - 30)];
    case 'bedtime':
      return [fromMinutes(toMinutes(life.sleep) - 30)];
    default:
      return [fromMinutes(toMinutes(life.wake) + 30)];
  }
}

/** Common things people are told to avoid, offered as one-tap chips. */
export const COMMON_AVOID = [
  'Tuna',
  'Shellfish',
  'Peanuts',
  'Tree nuts',
  'Dairy',
  'Gluten',
  'Eggs',
  'Grapefruit',
  'Fried food',
  'Fizzy drinks',
  'Added sugar',
  'Caffeine late',
];

/** Common things worth the app knowing, offered as chips. */
export const COMMON_CONDITIONS = [
  'Knee pain',
  'Lower back pain',
  'Shoulder pain',
  'High blood pressure',
  'Type 2 diabetes',
  'Prediabetes',
  'Asthma',
  'Thyroid',
  'Reflux',
  'Anxiety',
  'Low mood',
  'Poor sleep',
];
