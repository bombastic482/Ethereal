/**
 * Open Graph card for each recipe, rendered at build time with sharp from an inline SVG so
 * shared links show the name, calories, protein and time. Nothing runs at request time.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { builtRecipes, type BuiltRecipe } from '@/lib/recipes-build';

export const getStaticPaths: GetStaticPaths = () =>
  builtRecipes.map((r) => ({ params: { id: r.id }, props: { recipe: r } }));

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy wrap into at most `lines` lines of about `width` characters, ellipsis if longer. */
function wrap(text: string, width: number, lines: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = kept[lines - 1]!.replace(/\s+\S*$/, '') + '…';
    return kept;
  }
  return out;
}

const MEAL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const star = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}l${r * 0.29} ${r * 0.71}L${cx + r} ${cy}l-${r * 0.71} ${r * 0.29}L${cx} ${cy + r}l-${r * 0.29}-${r * 0.71}L${cx - r} ${cy}l${r * 0.71}-${r * 0.29}Z`;

function svg(r: BuiltRecipe): string {
  const brand = '#5aa072';
  const accent = '#e8a06a';
  const title = wrap(r.name, 26, 3);
  const size = title.length === 3 ? 62 : title.some((l) => l.length > 20) ? 72 : 84;
  const y0 = title.length === 1 ? 330 : title.length === 2 ? 280 : 250;
  const kcal = Math.round(r.totals.kcal);
  const p = Math.round(r.totals.protein);
  const c = Math.round(r.totals.carbs);
  const f = Math.round(r.totals.fat);
  const stat = (x: number, label: string, value: string) =>
    `<text x="${x}" y="536" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="800" fill="#fff" letter-spacing="-1.5">${value}</text>
     <text x="${x}" y="566" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="#b8ae9f" letter-spacing="1.5">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d1a16"/><stop offset="1" stop-color="#2a251f"/></linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${brand}"/><stop offset="1" stop-color="${accent}"/></linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.2" r="0.6"><stop offset="0" stop-color="${brand}" stop-opacity="0.4"/><stop offset="1" stop-color="${brand}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="80" y="80" width="56" height="56" rx="14" fill="url(#g)"/>
  <path d="${star(108, 108, 17)}" fill="#fff"/>
  <text x="152" y="122" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="700" fill="#fff" letter-spacing="-1">Ethereal</text>
  <text x="80" y="212" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="${accent}" letter-spacing="3">${MEAL[r.meal].toUpperCase()} · ${r.minutes} MIN${r.diet === 'vegan' ? ' · VEGAN' : r.diet === 'vegetarian' ? ' · VEGETARIAN' : ''}</text>
  ${title
    .map(
      (line, i) =>
        `<text x="80" y="${y0 + i * (size + 8)}" font-family="Georgia, Times New Roman, serif" font-size="${size}" fill="#fff" letter-spacing="-2">${esc(line)}</text>`,
    )
    .join('\n  ')}
  ${stat(80, 'KCAL', String(kcal))}
  ${stat(300, 'PROTEIN', `${p} g`)}
  ${stat(520, 'CARBS', `${c} g`)}
  ${stat(740, 'FAT', `${f} g`)}
  <g transform="translate(940 330)">
    <circle cx="110" cy="110" r="90" fill="none" stroke="#ffffff14" stroke-width="20"/>
    <circle cx="110" cy="110" r="90" fill="none" stroke="url(#g)" stroke-width="20" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 90 * Math.min(0.95, (p * 4) / Math.max(1, kcal))).toFixed(1)} 999" transform="rotate(-90 110 110)"/>
    <text x="110" y="104" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="800" fill="#fff" letter-spacing="-1.5">${Math.round(((p * 4) / Math.max(1, kcal)) * 100)}%</text>
    <text x="110" y="134" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#b8ae9f" letter-spacing="1.5">FROM PROTEIN</text>
  </g>
</svg>`;
}

export const GET: APIRoute = async ({ props }) => {
  const png = await sharp(Buffer.from(svg(props.recipe as BuiltRecipe)))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
