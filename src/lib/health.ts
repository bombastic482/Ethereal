/**
 * A private health diary: how symptoms come and go, lab results over time, and plain rules for
 * when something is worth showing a doctor. It never diagnoses; it makes patterns visible and
 * gives you something concrete to bring to an appointment.
 */
import { createStore } from './store';

export interface SymptomEntry {
  date: string;
  symptom: string;
  /** 0 none … 10 worst imaginable. */
  severity: number;
  note?: string;
}

export interface LabEntry {
  id: string;
  date: string;
  test: string;
  value: number;
  unit: string;
}

export interface HealthState {
  symptoms: SymptomEntry[];
  labs: LabEntry[];
}

export const COMMON_SYMPTOMS = [
  'Leg pain',
  'Knee pain',
  'Back pain',
  'Headache',
  'Low energy',
  'Bloating',
  'Heartburn',
  'Poor sleep',
  'Low mood',
  'Anxiety',
];

/** Lab tests people track most, with units and the usual target ranges for adults. */
export const LAB_TESTS: Array<{
  test: string;
  unit: string;
  good: string;
  low?: number;
  high?: number;
}> = [
  { test: 'HbA1c', unit: '%', good: 'under 5.7%', high: 5.7 },
  { test: 'Fasting glucose', unit: 'mmol/L', good: '3.9 to 5.5', low: 3.9, high: 5.5 },
  { test: 'LDL cholesterol', unit: 'mmol/L', good: 'under 3.0', high: 3.0 },
  { test: 'HDL cholesterol', unit: 'mmol/L', good: 'over 1.0', low: 1.0 },
  { test: 'Triglycerides', unit: 'mmol/L', good: 'under 1.7', high: 1.7 },
  { test: 'Vitamin D', unit: 'nmol/L', good: '50 or more', low: 50 },
  { test: 'Blood pressure, systolic', unit: 'mmHg', good: 'under 120', high: 120 },
  { test: 'Blood pressure, diastolic', unit: 'mmHg', good: 'under 80', high: 80 },
  { test: 'Resting heart rate', unit: 'bpm', good: '50 to 90', low: 50, high: 90 },
  { test: 'Ferritin', unit: 'µg/L', good: '30 or more', low: 30 },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const healthStore = createStore<HealthState>(
  'ethereal:health:v1',
  { symptoms: [], labs: [] },
  (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<HealthState>;
    return {
      symptoms: Array.isArray(r.symptoms)
        ? r.symptoms
            .filter(
              (s): s is SymptomEntry =>
                !!s &&
                typeof s === 'object' &&
                ISO.test(String(s.date)) &&
                typeof s.symptom === 'string' &&
                typeof s.severity === 'number',
            )
            .map((s) => ({
              date: s.date,
              symptom: s.symptom.slice(0, 40),
              severity: Math.max(0, Math.min(10, Math.round(s.severity))),
              ...(typeof s.note === 'string' && s.note ? { note: s.note.slice(0, 200) } : {}),
            }))
        : [],
      labs: Array.isArray(r.labs)
        ? r.labs.filter(
            (l): l is LabEntry =>
              !!l &&
              typeof l === 'object' &&
              ISO.test(String(l.date)) &&
              typeof l.test === 'string' &&
              Number.isFinite(l.value),
          )
        : [],
    };
  },
);

/** Records a symptom for a day, replacing that day's earlier rating. Severity 0 clears it. */
export function rateSymptom(date: string, symptom: string, severity: number, note?: string): void {
  const { symptoms } = healthStore.get();
  const rest = symptoms.filter((s) => !(s.date === date && s.symptom === symptom));
  healthStore.patch({
    symptoms:
      severity > 0
        ? [...rest, { date, symptom, severity, ...(note ? { note } : {}) }].sort((a, b) =>
            a.date.localeCompare(b.date),
          )
        : rest,
  });
}

const DAY = 864e5;
const daysAgo = (today: string, d: string) =>
  Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / DAY);

export interface Prompt {
  symptom: string;
  level: 'see-doctor' | 'keep-an-eye';
  reason: string;
}

/**
 * When a pattern is worth a professional's eyes: on most days for two weeks, or severe three
 * times in a week. Tracking a symptom for a fortnight is exactly the information a doctor will
 * ask for.
 */
export function doctorPrompts(symptoms: readonly SymptomEntry[], today: string): Prompt[] {
  const out: Prompt[] = [];
  const names = [...new Set(symptoms.map((s) => s.symptom))];
  for (const name of names) {
    const mine = symptoms
      .filter((s) => s.symptom === name)
      .sort((a, b) => a.date.localeCompare(b.date));
    const fortnight = mine.filter((s) => daysAgo(today, s.date) < 14);
    const week = mine.filter((s) => daysAgo(today, s.date) < 7);
    const severe = week.filter((s) => s.severity >= 7);
    const first = mine[0];
    const lastingDays = first ? daysAgo(today, first.date) + 1 : 0;
    if (severe.length >= 3)
      out.push({
        symptom: name,
        level: 'see-doctor',
        reason: `Severe (7 or more) on ${severe.length} days this week.`,
      });
    else if (fortnight.length >= 10)
      out.push({
        symptom: name,
        level: 'see-doctor',
        reason: `On ${fortnight.length} of the last 14 days.`,
      });
    else if (fortnight.length >= 5 && lastingDays >= 14)
      out.push({
        symptom: name,
        level: 'keep-an-eye',
        reason: `Coming and going for ${lastingDays} days.`,
      });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'see-doctor' ? -1 : 1));
}

/** Signs that should never wait for a pattern. */
export const RED_FLAGS = [
  'Chest pain or pressure, especially with breathlessness, sweating or pain spreading to the arm or jaw',
  'Sudden severe headache, weakness on one side, face drooping or slurred speech',
  'A calf that is swollen, warm, red and painful, or sudden breathlessness',
  'Fainting, or a racing heartbeat that will not settle',
  'Thoughts of harming yourself',
];

/** Average severity per day for a symptom over the last `days`, 0 where nothing was logged. */
export function symptomStrip(
  symptoms: readonly SymptomEntry[],
  symptom: string,
  today: string,
  days = 28,
): number[] {
  const out = Array.from({ length: days }, () => 0);
  for (const s of symptoms) {
    if (s.symptom !== symptom) continue;
    const ago = daysAgo(today, s.date);
    if (ago >= 0 && ago < days) out[days - 1 - ago] = s.severity;
  }
  return out;
}

/** Whether a lab value sits outside its usual range. */
export function labFlag(test: string, value: number): 'low' | 'high' | null {
  const t = LAB_TESTS.find((x) => x.test === test);
  if (!t) return null;
  if (t.low !== undefined && value < t.low) return 'low';
  if (t.high !== undefined && value >= t.high) return 'high';
  return null;
}
