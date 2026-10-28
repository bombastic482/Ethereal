/**
 * Shared Open Graph card renderer (1200×630) used by the build-time PNG endpoints for recipes,
 * guides and calculators. Inline SVG rasterised with sharp; nothing runs at request time.
 */
import sharp from 'sharp';

export interface OgCard {
  /** Small amber line above the title, e.g. "BREAKFAST · 20 MIN". */
  kicker: string;
  title: string;
  /** Up to four big stats along the bottom. */
  stats?: Array<{ label: string; value: string }>;
  /** Optional ring on the right: fraction 0–1 plus a label. */
  ring?: { fraction: number; big: string; label: string };
  /** One-line summary shown when there is no ring/stats, truncated. */
  summary?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy wrap into at most `lines` lines of about `width` characters, ellipsis if longer. */
export function wrap(text: string, width: number, lines: number): string[] {
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

const star = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}l${r * 0.29} ${r * 0.71}L${cx + r} ${cy}l-${r * 0.71} ${r * 0.29}L${cx} ${cy + r}l-${r * 0.29}-${r * 0.71}L${cx - r} ${cy}l${r * 0.71}-${r * 0.29}Z`;

export function ogSvg(card: OgCard): string {
  const brand = '#5aa072';
  const accent = '#e8a06a';
  const hasRing = !!card.ring;
  const titleWidth = hasRing ? 26 : 34;
  const title = wrap(card.title, titleWidth, 3);
  const size = title.length === 3 ? 62 : title.some((l) => l.length > 20) ? 72 : 84;
  const y0 = title.length === 1 ? 330 : title.length === 2 ? 280 : 250;
  const stats = card.stats ?? [];
  const stat = (x: number, label: string, value: string) =>
    `<text x="${x}" y="536" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="800" fill="#fff" letter-spacing="-1.5">${esc(value)}</text>
     <text x="${x}" y="566" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="#b8ae9f" letter-spacing="1.5">${esc(label.toUpperCase())}</text>`;
  const summary = card.summary && stats.length === 0 ? wrap(card.summary, 70, 2) : [];
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
  <text x="80" y="212" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="${accent}" letter-spacing="3">${esc(card.kicker.toUpperCase())}</text>
  ${title
    .map(
      (line, i) =>
        `<text x="80" y="${y0 + i * (size + 8)}" font-family="Georgia, Times New Roman, serif" font-size="${size}" fill="#fff" letter-spacing="-2">${esc(line)}</text>`,
    )
    .join('\n  ')}
  ${stats.map((s, i) => stat(80 + i * 220, s.label, s.value)).join('\n  ')}
  ${summary
    .map(
      (line, i) =>
        `<text x="80" y="${520 + i * 40}" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#d9d2c7">${esc(line)}</text>`,
    )
    .join('\n  ')}
  ${
    card.ring
      ? `<g transform="translate(940 330)">
    <circle cx="110" cy="110" r="90" fill="none" stroke="#ffffff14" stroke-width="20"/>
    <circle cx="110" cy="110" r="90" fill="none" stroke="url(#g)" stroke-width="20" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 90 * Math.min(0.95, Math.max(0.02, card.ring.fraction))).toFixed(1)} 999" transform="rotate(-90 110 110)"/>
    <text x="110" y="104" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="800" fill="#fff" letter-spacing="-1.5">${esc(card.ring.big)}</text>
    <text x="110" y="134" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#b8ae9f" letter-spacing="1.5">${esc(card.ring.label.toUpperCase())}</text>
  </g>`
      : ''
  }
</svg>`;
}

export async function ogPng(card: OgCard): Promise<Response> {
  const png = await sharp(Buffer.from(ogSvg(card)))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
