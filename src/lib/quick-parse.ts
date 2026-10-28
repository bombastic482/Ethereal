/**
 * Natural-language food entry: "2 eggs, a slice of toast and 150g greek yogurt".
 * Splits into items, pulls out quantity and unit, matches the local database, picks a serving.
 * Pure function over the loaded database so it is testable and instant.
 */
import type { Food } from './foods';

export interface ParsedItem {
  raw: string;
  quantity: number;
  /** 'g' | 'ml' | 'oz' | 'serving' | 'cup' | 'tbsp' | 'tsp' | 'slice' | 'piece' | ... */
  unit: string;
  query: string;
}

export interface ResolvedItem extends ParsedItem {
  food: Food | null;
  grams: number;
  servingLabel: string;
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  half: 0.5,
  quarter: 0.25,
  couple: 2,
  few: 3,
};
const UNITS: Record<string, { grams?: number; kind: 'mass' | 'volume' | 'count' }> = {
  g: { grams: 1, kind: 'mass' },
  gram: { grams: 1, kind: 'mass' },
  grams: { grams: 1, kind: 'mass' },
  kg: { grams: 1000, kind: 'mass' },
  oz: { grams: 28.35, kind: 'mass' },
  ounce: { grams: 28.35, kind: 'mass' },
  ounces: { grams: 28.35, kind: 'mass' },
  lb: { grams: 453.6, kind: 'mass' },
  ml: { grams: 1, kind: 'volume' },
  l: { grams: 1000, kind: 'volume' },
  litre: { grams: 1000, kind: 'volume' },
  liter: { grams: 1000, kind: 'volume' },
  cup: { grams: 240, kind: 'volume' },
  cups: { grams: 240, kind: 'volume' },
  tbsp: { grams: 15, kind: 'volume' },
  tablespoon: { grams: 15, kind: 'volume' },
  tablespoons: { grams: 15, kind: 'volume' },
  tsp: { grams: 5, kind: 'volume' },
  teaspoon: { grams: 5, kind: 'volume' },
  glass: { grams: 250, kind: 'volume' },
  glasses: { grams: 250, kind: 'volume' },
  slice: { kind: 'count' },
  slices: { kind: 'count' },
  piece: { kind: 'count' },
  pieces: { kind: 'count' },
  scoop: { kind: 'count' },
  scoops: { kind: 'count' },
  handful: { kind: 'count' },
  serving: { kind: 'count' },
  servings: { kind: 'count' },
  portion: { kind: 'count' },
  bowl: { kind: 'count' },
  can: { kind: 'count' },
  bar: { kind: 'count' },
  egg: { kind: 'count' },
  eggs: { kind: 'count' },
};
const FILLER =
  /\b(of|the|some|with|and|plus|my|for|breakfast|lunch|dinner|snack|i|had|ate|have)\b/g;

export function parseQuickEntry(text: string): ParsedItem[] {
  return text
    .toLowerCase()
    .replace(/\band\b/g, ',')
    .replace(/\+/g, ',')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      let rest = raw;
      let quantity = 1;
      let unit = 'serving';
      const num = rest.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+|½|¼|¾|[a-z]+)\s+/);
      if (num) {
        const tok = num[1]!;
        let q: number | null = null;
        if (/^\d+\/\d+$/.test(tok)) {
          const [a, b] = tok.split('/').map(Number);
          q = a! / b!;
        } else if (tok === '½') q = 0.5;
        else if (tok === '¼') q = 0.25;
        else if (tok === '¾') q = 0.75;
        else if (/^\d/.test(tok)) q = parseFloat(tok.replace(',', '.'));
        else if (tok in WORD_NUMBERS) q = WORD_NUMBERS[tok]!;
        if (q !== null) {
          quantity = q;
          rest = rest.slice(num[0].length);
        }
      }
      // attached unit, e.g. "150g", "2x", "200ml"
      const attached = rest.match(/^(\d+(?:[.,]\d+)?)(g|kg|ml|l|oz|lb)\b\s*/);
      if (attached) {
        quantity = parseFloat(attached[1]!.replace(',', '.'));
        unit = attached[2]!;
        rest = rest.slice(attached[0].length);
      } else {
        const u = rest.match(/^([a-z]+)\b\s*/);
        if (u && u[1]! in UNITS && !['egg', 'eggs'].includes(u[1]!)) {
          unit = u[1]!;
          rest = rest.slice(u[0].length);
        }
      }
      const query = rest.replace(FILLER, ' ').replace(/\s+/g, ' ').trim() || raw;
      return { raw, quantity, unit, query };
    });
}

/** Picks grams for a parsed item given a matched food and its servings. */
export function resolveGrams(
  item: ParsedItem,
  food: Food,
): { grams: number; servingLabel: string } {
  const u = UNITS[item.unit];
  if (u?.grams)
    return {
      grams: Math.round(item.quantity * u.grams),
      servingLabel: `${item.quantity} ${item.unit}`,
    };
  // count-like units: prefer a serving whose label mentions the unit, else the first serving
  const byLabel =
    u && u.kind === 'count'
      ? food.servings.find((s) => s.label.toLowerCase().includes(item.unit.replace(/s$/, '')))
      : undefined;
  const serving = byLabel ?? food.servings[0] ?? { label: '100 g', grams: 100 };
  return {
    grams: Math.round(item.quantity * serving.grams),
    servingLabel: `${item.quantity} × ${serving.label}`,
  };
}

export function resolveQuickEntry(
  text: string,
  search: (q: string, limit?: number) => Food[],
): ResolvedItem[] {
  return parseQuickEntry(text).map((item) => {
    const food = search(item.query, 1)[0] ?? null;
    if (!food) return { ...item, food: null, grams: 0, servingLabel: '' };
    const { grams, servingLabel } = resolveGrams(item, food);
    return { ...item, food, grams, servingLabel };
  });
}
