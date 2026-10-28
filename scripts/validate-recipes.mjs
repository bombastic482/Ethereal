// Validates the starter recipes: shape, unique ids, every ingredient resolves, sensible per-serving ranges.
import { readFileSync } from 'node:fs';

const foods = new Map();
for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) {
  for (const f of JSON.parse(readFileSync(`src/data/foods-${k}.json`, 'utf8'))) foods.set(f.id, f);
}
const recipes = JSON.parse(readFileSync('src/data/recipes.json', 'utf8'));
if (!Array.isArray(recipes)) throw new Error('recipes.json is not an array');

const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const DIETS = new Set(['vegan', 'vegetarian', 'pescatarian', 'omnivore']);
const TAGS = new Set([
  'high-protein',
  'high-fibre',
  'low-carb',
  'budget',
  'no-cook',
  'batch-cook',
  '15-min',
  'one-pan',
]);
const KCAL = { breakfast: [280, 520], lunch: [380, 680], dinner: [430, 780], snack: [90, 260] };
const ids = new Set();
let problems = 0;
for (const r of recipes) {
  const bad = (m) => {
    problems++;
    console.log(`${r.id ?? '?'} :: ${m}`);
  };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id ?? '')) bad('bad id');
  if (ids.has(r.id)) bad('duplicate id');
  ids.add(r.id);
  if (typeof r.name !== 'string' || r.name.length < 4) bad('bad name');
  if (!MEALS.has(r.meal)) bad('bad meal');
  if (!DIETS.has(r.diet)) bad('bad diet');
  if (!Number.isInteger(r.minutes) || r.minutes < 1 || r.minutes > 120) bad('bad minutes');
  if (!Array.isArray(r.tags) || r.tags.length < 1 || r.tags.length > 3) bad('bad tags');
  else for (const t of r.tags) if (!TAGS.has(t)) bad(`unknown tag ${t}`);
  if (typeof r.method !== 'string' || r.method.length < 10 || r.method.length > 220)
    bad('bad method');
  if (!Array.isArray(r.items) || r.items.length < 1 || r.items.length > 10) bad('bad items');
  let kcal = 0;
  let protein = 0;
  let vegOk = true;
  for (const it of r.items ?? []) {
    const f = foods.get(it.foodId);
    if (!f) {
      bad(`unknown food ${it.foodId}`);
      continue;
    }
    if (!(it.grams > 0 && it.grams <= 600)) bad(`bad grams for ${it.foodId}`);
    kcal += (f.per100g.kcal * it.grams) / 100;
    protein += (f.per100g.protein * it.grams) / 100;
    if (r.diet === 'vegan' && f.veg !== 'vegan') vegOk = false;
    if (r.diet === 'vegetarian' && f.veg === 'no') vegOk = false;
  }
  if (!vegOk) bad('diet label is less restrictive than its ingredients allow');
  const [lo, hi] = KCAL[r.meal] ?? [0, 9999];
  if (kcal < lo || kcal > hi) bad(`kcal ${Math.round(kcal)} outside ${lo}-${hi}`);
  if (protein < (r.meal === 'snack' ? 10 : 25)) bad(`protein ${protein.toFixed(1)} too low`);
}
console.log(`recipes: ${recipes.length}, problems ${problems}`);
if (problems) process.exit(1);
