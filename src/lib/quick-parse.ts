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
  dozen: 12,
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
  lbs: { grams: 453.6, kind: 'mass' },
  pound: { grams: 453.6, kind: 'mass' },
  pounds: { grams: 453.6, kind: 'mass' },
  kgs: { grams: 1000, kind: 'mass' },
  ml: { grams: 1, kind: 'volume' },
  l: { grams: 1000, kind: 'volume' },
  litre: { grams: 1000, kind: 'volume' },
  liter: { grams: 1000, kind: 'volume' },
  litres: { grams: 1000, kind: 'volume' },
  liters: { grams: 1000, kind: 'volume' },
  cup: { grams: 240, kind: 'volume' },
  cups: { grams: 240, kind: 'volume' },
  tbsp: { grams: 15, kind: 'volume' },
  tablespoon: { grams: 15, kind: 'volume' },
  tablespoons: { grams: 15, kind: 'volume' },
  tsp: { grams: 5, kind: 'volume' },
  teaspoon: { grams: 5, kind: 'volume' },
  teaspoons: { grams: 5, kind: 'volume' },
  x: { kind: 'count' },
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
  /\b(of|the|a|an|some|with|and|plus|my|for|breakfast|lunch|dinner|snack|i|had|ate|have)\b/g;

export function parseQuickEntry(text: string): ParsedItem[] {
  return text
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2') // decimal comma: "1,5 cups"
    .replace(/\band\b/g, ',')
    .replace(/\+/g, ',')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      let rest = raw;
      let quantity = 1;
      let unit = 'serving';
      // "a couple of eggs": an article alone is not the quantity, so look once more after it.
      rest = rest.replace(/^(a|an)\s+(?=(couple|few|half|quarter|dozen)\b)/, '');
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
          rest = rest.slice(num[0].length).replace(/^(a|an|of)\s+/, '');
        }
      }
      // attached unit, e.g. "150g", "2x", "200ml"
      const attached = rest.match(/^(\d+(?:[.,]\d+)?)(g|kg|ml|l|oz|lb|x)\b\s*/);
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
  if (u?.grams) {
    // Volume units: the food's own "1 cup" / "1 tbsp" serving beats the water-density table.
    if (u.kind === 'volume') {
      const base = item.unit.replace(/s$/, '');
      const own = food.servings.find((sv) => {
        const m = /^(\d+(?:\/\d+|\.\d+)?)\s*([a-z]+)/i.exec(sv.label);
        return m && m[2]!.toLowerCase().replace(/s$/, '') === base;
      });
      if (own) {
        const m = /^(\d+(?:\/\d+|\.\d+)?)/.exec(own.label)!;
        const n = m[1]!.includes('/')
          ? Number(m[1]!.split('/')[0]) / Number(m[1]!.split('/')[1])
          : Number(m[1]);
        return {
          grams: Math.round((item.quantity / (n || 1)) * own.grams),
          servingLabel: `${item.quantity} ${item.unit}`,
        };
      }
    }
    return {
      grams: Math.round(item.quantity * u.grams),
      servingLabel: `${item.quantity} ${item.unit}`,
    };
  }
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
