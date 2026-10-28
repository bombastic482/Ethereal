/**
 * Open Food Facts client (https://world.openfoodfacts.org). Free, open, no API key.
 * Called straight from the browser; nothing passes through our servers because we have none.
 */
import type { Nutrients } from './calc/nutrition';

export interface OffProduct {
  barcode: string;
  name: string;
  brand?: string;
  per100g: Nutrients;
  servingGrams?: number;
  servingLabel?: string;
  image?: string;
}

const FIELDS =
  'code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,image_front_small_url';
const BASE = 'https://world.openfoodfacts.org';

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

function normalise(p: Record<string, unknown>): OffProduct | null {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kcal =
    num(n['energy-kcal_100g']) ??
    (num(n.energy_100g) !== undefined ? num(n.energy_100g)! / 4.184 : undefined);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if (kcal === undefined || protein === undefined || carbs === undefined || fat === undefined)
    return null;
  const name = (p.product_name_en as string) || (p.product_name as string);
  if (!name) return null;
  const brand = typeof p.brands === 'string' ? p.brands.split(',')[0]?.trim() : undefined;
  const servingGrams = num(p.serving_quantity);
  return {
    barcode: String(p.code ?? ''),
    name: name.trim(),
    ...(brand ? { brand } : {}),
    per100g: {
      kcal: Math.round(kcal),
      protein: +protein.toFixed(1),
      carbs: +carbs.toFixed(1),
      fat: +fat.toFixed(1),
      fibre: +(num(n.fiber_100g) ?? 0).toFixed(1),
      ...(num(n.sugars_100g) !== undefined ? { sugar: +num(n.sugars_100g)!.toFixed(1) } : {}),
      ...(num(n['saturated-fat_100g']) !== undefined
        ? { satFat: +num(n['saturated-fat_100g'])!.toFixed(1) }
        : {}),
      ...(num(n.salt_100g) !== undefined
        ? { salt: +num(n.salt_100g)!.toFixed(2) }
        : num(n.sodium_100g) !== undefined
          ? { salt: +(num(n.sodium_100g)! * 2.5).toFixed(2) }
          : {}),
    },
    ...(servingGrams
      ? {
          servingGrams,
          servingLabel: typeof p.serving_size === 'string' ? p.serving_size : `${servingGrams} g`,
        }
      : {}),
    ...(typeof p.image_front_small_url === 'string' ? { image: p.image_front_small_url } : {}),
  };
}

export async function lookupBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<OffProduct | null> {
  const res = await fetch(
    `${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
    { signal: signal ?? null },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
  if (!json.product) return null;
  return normalise(json.product);
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<OffProduct[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`;
  const res = await fetch(url, { signal: signal ?? null });
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const json = (await res.json()) as { products?: Record<string, unknown>[] };
  return (json.products ?? []).map(normalise).filter((p): p is OffProduct => p !== null);
}
