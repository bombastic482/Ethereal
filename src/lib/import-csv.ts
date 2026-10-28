/**
 * Imports food and weight history from other apps' CSV exports (MyFitnessPal, Lose It!,
 * Cronometer, Apple Health exports via third-party tools, generic spreadsheets). Columns are
 * recognised by name, so the same code handles every layout; rows become diary entries whose
 * nutrients are stored as the row's totals, and weight rows become weigh-ins.
 */
import type { FoodEntry, Meal } from './calc/nutrition';
import type { WeighIn } from './calc/trend';
import { diaryStore, uid } from './food-store';
import { logStore } from './log';

/** Picks the delimiter from the header line: whichever of , ; and tab appears most outside quotes. */
export function sniffDelimiter(firstLine: string): ',' | ';' | '\t' {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const c of firstLine) {
    if (c === '"') q = !q;
    else if (!q && c in counts) counts[c]!++;
  }
  const best = (Object.entries(counts) as Array<[',' | ';' | '\t', number]>).sort(
    (a, b) => b[1] - a[1],
  )[0]!;
  return best[1] > 0 ? best[0] : ',';
}

/** RFC 4180-ish parser: quoted fields, doubled quotes, CRLF, trailing newline. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  const delim = sniffDelimiter(src.split(/\r?\n/, 1)[0] ?? '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '')
      quoted = true; // a quote mid-field (6" sub) is literal
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

type Col =
  | 'date'
  | 'time'
  | 'meal'
  | 'name'
  | 'brand'
  | 'quantity'
  | 'unit'
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fibre'
  | 'sugar'
  | 'satFat'
  | 'sodium'
  | 'weight'
  | 'waist';

const HEADERS: Array<[Col, RegExp]> = [
  ['date', /^(date|day|logged on|entry date|datetime|timestamp)$/],
  ['time', /^(time|logged at)$/],
  ['meal', /^(meal|type|category|group|meal type|section)$/],
  ['name', /^(food|food name|name|item|description|product|food item)$/],
  ['brand', /^(brand|brand name)$/],
  ['quantity', /^(quantity|amount|serving|servings|qty|number of servings)$/],
  ['unit', /^(unit|units|serving size|measure)$/],
  ['kcal', /^(calories|energy|kcal|calories \(kcal\)|energy \(kcal\)|cals|kilocalories)$/],
  ['protein', /^protein/],
  ['carbs', /^(carb|carbs|carbohydrate|carbohydrates|net carbs|total carbohydrate)/],
  ['fat', /^(fat|total fat|fats|lipids)(_g| \(g\))?$/],
  ['fibre', /^(fiber|fibre|dietary fiber|dietary fibre)/],
  ['sugar', /^(sugar|sugars|total sugars)/],
  ['satFat', /^(saturated fat|saturated|sat fat)/],
  ['sodium', /^(sodium|salt)/],
  [
    'weight',
    /^(weight|body weight|bodyweight|weight[ _]?\((kg|lbs?)\)|weight_(kg|lbs?)|weightkg|mass)$/,
  ],
  ['waist', /^(waist|waist_cm|waist \(cm\)|waist \(in\))$/],
];

const normHeader = (h: string) => h.toLowerCase().replace(/[ ]/g, ' ').replace(/\s+/g, ' ').trim();

export function detectColumns(header: string[]): Partial<Record<Col, number>> {
  const map: Partial<Record<Col, number>> = {};
  header.forEach((raw, i) => {
    const h = normHeader(raw);
    for (const [col, re] of HEADERS) {
      if (map[col] === undefined && re.test(h)) {
        map[col] = i;
        break;
      }
    }
  });
  return map;
}

/**
 * Accepts ISO, US (M/D/YYYY), EU (D/M/YYYY, always for dotted dates) and "October 3, 2026".
 * `dayFirst` is decided once per file (see `fileIsDayFirst`) so one file is read consistently.
 */
export function parseDate(raw: string, dayFirst = false): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})([/.-])(\d{1,2})[/.-](\d{2,4})/.exec(s);
  if (m) {
    let a = +m[1]!;
    let b = +m[3]!;
    const y = m[4]!.length === 2 ? 2000 + +m[4]! : +m[4]!;
    const df = dayFirst || m[2] === '.' || (a > 12 && b <= 12);
    if (df) [a, b] = [b, a];
    return iso(y, a, b);
  }
  if (/^\d+$/.test(s)) return null; // Excel serials and bare numbers are not dates
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return null;
}
/** True when any slash/dash date in the column has a first component over 12 (so it is a day). */
export function fileIsDayFirst(values: string[]): boolean {
  return values.some((v) => {
    const m = /^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}/.exec(v.trim());
    return !!m && +m[1]! > 12 && +m[2]! <= 12;
  });
}
const iso = (y: number, mo: number, d: number): string | null =>
  y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31
    ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : null;

/** Reads "1,500", "1.250,5", "30,5", "250 kcal": with both separators the first one is grouping. */
export const num = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  let t = v.replace(/[^\d.,-]/g, '');
  if (!t) return null;
  const hasDot = t.includes('.');
  const hasComma = t.includes(',');
  if (hasDot && hasComma) {
    t =
      t.indexOf('.') < t.indexOf(',')
        ? t.replace(/\./g, '').replace(',', '.')
        : t.replace(/,/g, '');
  } else if (hasComma) {
    // "1,500" (groups of three) is a thousands separator; "30,5" is a decimal comma.
    t = /^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

/** "07:30", "7:30 PM", "12:05 am" → minutes since midnight; null when not a time. */
export function parseTime(v: string | undefined): number | null {
  if (!v) return null;
  const m = /(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/.exec(v);
  if (!m) return null;
  let h = +m[1]!;
  const mins = +m[2]!;
  const ap = m[3]?.toLowerCase();
  if (ap) h = (h % 12) + (ap === 'pm' ? 12 : 0);
  if (h > 23 || mins > 59) return null;
  return h * 60 + mins;
}

export function mapMeal(raw: string | undefined, time?: string): Meal {
  const s = (raw ?? '').toLowerCase();
  if (/break|morning|petit/.test(s)) return 'breakfast';
  if (/lunch|midday|noon/.test(s)) return 'lunch';
  if (/dinner|supper|evening|tea\b/.test(s)) return 'dinner';
  if (/snack|other|uncategor/.test(s)) return 'snack';
  const t = parseTime(time);
  if (t !== null) {
    const h = Math.floor(t / 60);
    return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
  }
  return 'snack';
}

export interface ImportPreview {
  food: FoodEntry[];
  weighIns: WeighIn[];
  days: number;
  skipped: number;
  /** Which app the layout looked like, for the confirmation copy. */
  source: 'MyFitnessPal' | 'Lose It!' | 'Cronometer' | 'spreadsheet';
  weightUnit: 'kg' | 'lb' | null;
}

/** Turns CSV text into diary entries and weigh-ins without touching the stores. */
export function previewImport(text: string): ImportPreview | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const header = rows[0]!;
  const cols = detectColumns(header);
  if (cols.date === undefined) return null;
  const joined = header.join(' ').toLowerCase();
  const source: ImportPreview['source'] = /polyunsaturated|monounsaturated/.test(joined)
    ? 'MyFitnessPal'
    : /^date,name,icon,type,quantity|lose it/i.test(header.join(','))
      ? 'Lose It!'
      : /energy \(kcal\)|group/.test(joined)
        ? 'Cronometer'
        : 'spreadsheet';
  const weightHeader = cols.weight !== undefined ? normHeader(header[cols.weight]!) : '';
  let weightUnit: ImportPreview['weightUnit'] = /lb/.test(weightHeader)
    ? 'lb'
    : /kg/.test(weightHeader)
      ? 'kg'
      : null;
  const waistHeader = cols.waist !== undefined ? normHeader(header[cols.waist]!) : '';
  const waistIn = /\(in\)|_in$/.test(waistHeader);
  const dayFirst = fileIsDayFirst(rows.slice(1).map((r) => r[cols.date!] ?? ''));

  const food: FoodEntry[] = [];
  const weights = new Map<string, number>();
  const waists = new Map<string, number>();
  let skipped = 0;
  const days = new Set<string>();
  for (const r of rows.slice(1)) {
    const date = parseDate(r[cols.date] ?? '', dayFirst);
    if (!date) {
      skipped++;
      continue;
    }
    const kcal = cols.kcal !== undefined ? num(r[cols.kcal]) : null;
    const weight = cols.weight !== undefined ? num(r[cols.weight]) : null;
    if (weight !== null && weight > 0) {
      weights.set(date, weight);
      days.add(date);
      const waist = cols.waist !== undefined ? num(r[cols.waist]) : null;
      if (waist !== null && waist > 0) waists.set(date, waistIn ? waist * 2.54 : waist);
    }
    if (kcal !== null && kcal > 0) {
      const name = (r[cols.name ?? -1] ?? '').trim() || `Imported ${mealLabel(r, cols)}`;
      const brand = (r[cols.brand ?? -1] ?? '').trim();
      const time = r[cols.time ?? -1];
      const p = num(r[cols.protein ?? -1]) ?? 0;
      const c = num(r[cols.carbs ?? -1]) ?? 0;
      const f = num(r[cols.fat ?? -1]) ?? 0;
      const fibre = num(r[cols.fibre ?? -1]);
      const sugar = num(r[cols.sugar ?? -1]);
      const satFat = num(r[cols.satFat ?? -1]);
      food.push({
        id: uid(),
        date,
        meal: mapMeal(r[cols.meal ?? -1], time),
        name: name.slice(0, 80),
        ...(brand ? { brand } : {}),
        // Totals stored per 100 g of a 100 g "portion", so the row's numbers are preserved exactly.
        grams: 100,
        per100g: {
          kcal: Math.round(kcal),
          protein: round1(p),
          carbs: round1(c),
          fat: round1(f),
          fibre: round1(fibre ?? 0),
          ...(sugar !== null ? { sugar: round1(sugar) } : {}),
          ...(satFat !== null ? { satFat: round1(satFat) } : {}),
        },
        source: 'custom',
        ...(parseTime(time) !== null ? { time: parseTime(time)! } : {}),
      });
      days.add(date);
    } else if (weight === null) skipped++;
  }
  // Unit guess when the header did not say: adult body weights in lb are rarely under 90.
  if (weightUnit === null && weights.size) {
    const vals = [...weights.values()];
    const median = vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)]!;
    weightUnit = median > 140 ? 'lb' : 'kg';
  }
  const weighIns: WeighIn[] = [...weights.entries()].map(([date, w]) => ({
    date,
    weightKg: round1(weightUnit === 'lb' ? w * 0.45359237 : w),
    ...(waists.has(date) ? { waistCm: round1(waists.get(date)!) } : {}),
  }));
  if (food.length === 0 && weighIns.length === 0) return null;
  return { food, weighIns, days: days.size, skipped, source, weightUnit };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mealLabel = (r: string[], cols: Partial<Record<Col, number>>) =>
  (r[cols.meal ?? -1] ?? 'food').toLowerCase();

/** Merges a preview into the stores, skipping rows that are already there. Returns counts. */
export function applyImport(p: ImportPreview): { food: number; weighIns: number } {
  const d = diaryStore.get();
  const seen = new Set(
    d.food.map((e) => `${e.date}|${e.meal}|${e.name}|${e.per100g.kcal * e.grams}`),
  );
  const fresh = p.food.filter(
    (e) => !seen.has(`${e.date}|${e.meal}|${e.name}|${e.per100g.kcal * e.grams}`),
  );
  if (fresh.length) diaryStore.set({ ...d, food: [...d.food, ...fresh] });
  const log = logStore.get();
  const have = new Set(log.entries.map((e) => e.date));
  const newW = p.weighIns.filter((w) => !have.has(w.date));
  if (newW.length)
    logStore.set({
      entries: [...log.entries, ...newW].sort((a, b) => a.date.localeCompare(b.date)),
    });
  return { food: fresh.length, weighIns: newW.length };
}
