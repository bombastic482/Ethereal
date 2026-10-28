// Validates the built-in food database: shape, unique ids, plausible values, energy consistency.
import { readFileSync } from 'node:fs';

const files = ['src/data/foods-a.json', 'src/data/foods-b.json'];
const VEG = new Set(['vegan', 'vegetarian', 'no']);
const TAGS = new Set([
  'high-protein',
  'lean',
  'high-fibre',
  'high-fat',
  'processed',
  'low-carb',
  'snack',
  'breakfast',
]);
const ids = new Set();
let problems = 0;
let total = 0;
for (const f of files) {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${f} is not an array`);
  for (const x of data) {
    total++;
    const bad = (m) => {
      problems++;
      console.log(`${f} :: ${x.id ?? '?'} :: ${m}`);
    };
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(x.id ?? '')) bad('bad id');
    if (ids.has(x.id)) bad('duplicate id');
    ids.add(x.id);
    if (typeof x.name !== 'string' || x.name.length < 3) bad('bad name');
    if (typeof x.category !== 'string') bad('bad category');
    const n = x.per100g ?? {};
    for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fibre'])
      if (typeof n[k] !== 'number' || n[k] < 0) bad(`bad ${k}`);
    if (n.kcal > 905 || n.protein > 100 || n.carbs > 100 || n.fat > 100) bad('implausible value');
    const est = 4 * n.protein + 4 * n.carbs + 9 * n.fat;
    const alcohol =
      /beer|wine|lager|cider|vodka|gin|whisky|rum|spirit|prosecco|champagne|liqueur|cocktail|ale\b/i.test(
        x.name,
      );
    if (est > 0 && !alcohol && Math.abs(n.kcal - est) / est > 0.12 && Math.abs(n.kcal - est) > 12)
      bad(`energy ${n.kcal} vs ${est.toFixed(0)}`);
    if (!Array.isArray(x.servings) || x.servings.length < 1 || x.servings.length > 3)
      bad('servings count');
    for (const s of x.servings ?? [])
      if (typeof s.label !== 'string' || !(s.grams > 0)) bad('bad serving');
    if (!VEG.has(x.veg)) bad('bad veg');
    for (const t of x.tags ?? []) if (!TAGS.has(t)) bad(`bad tag ${t}`);
  }
  console.log(`${f}: ${data.length} foods`);
}
console.log(`total ${total}, problems ${problems}`);
process.exit(problems ? 1 : 0);
