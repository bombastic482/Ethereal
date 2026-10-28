// Generates the Open Graph image and PWA icons from inline SVG using sharp.
// Run once (`npm run og`) and commit the output; nothing runs at request time.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const brand = '#14b8a6';
const accent = '#a78bfa';

const star = (cx, cy, r) =>
  `M${cx} ${cy - r}l${r * 0.29} ${r * 0.71}L${cx + r} ${cy}l-${r * 0.71} ${r * 0.29}L${cx} ${cy + r}l-${r * 0.29}-${r * 0.71}L${cx - r} ${cy}l${r * 0.71}-${r * 0.29}Z`;

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#111a2e"/></linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${brand}"/><stop offset="1" stop-color="${accent}"/></linearGradient>
    <radialGradient id="glow1" cx="0.2" cy="0.1" r="0.6"><stop offset="0" stop-color="${brand}" stop-opacity="0.45"/><stop offset="1" stop-color="${brand}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow2" cx="0.9" cy="0.9" r="0.6"><stop offset="0" stop-color="${accent}" stop-opacity="0.4"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <rect x="80" y="80" width="72" height="72" rx="18" fill="url(#g)"/>
  <path d="${star(116, 116, 22)}" fill="#fff"/>
  <text x="172" y="134" font-family="Inter, Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="#fff" letter-spacing="-1">Ethereal</text>
  <text x="80" y="330" font-family="Inter, Helvetica, Arial, sans-serif" font-size="84" font-weight="800" fill="#fff" letter-spacing="-3">Weight loss,</text>
  <text x="80" y="420" font-family="Inter, Helvetica, Arial, sans-serif" font-size="84" font-weight="800" fill="url(#g)" letter-spacing="-3">done properly.</text>
  <text x="80" y="500" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="#c7d2e0">Food diary, barcode scanning, adaptive calorie targets. Free and private.</text>
  <g transform="translate(900 150)">
    <circle cx="120" cy="120" r="96" fill="none" stroke="#ffffff14" stroke-width="22"/>
    <circle cx="120" cy="120" r="96" fill="none" stroke="url(#g)" stroke-width="22" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 96 * 0.68).toFixed(1)} 999" transform="rotate(-90 120 120)"/>
    <text x="120" y="112" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="46" font-weight="800" fill="#fff" letter-spacing="-2">612</text>
    <text x="120" y="142" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#9fb0c4" letter-spacing="1.5">KCAL LEFT</text>
    <g transform="translate(20 260)">
      <rect width="200" height="10" rx="5" fill="#ffffff14"/><rect width="150" height="10" rx="5" fill="${brand}"/>
      <rect y="24" width="200" height="10" rx="5" fill="#ffffff14"/><rect y="24" width="118" height="10" rx="5" fill="${accent}"/>
      <rect y="48" width="200" height="10" rx="5" fill="#ffffff14"/><rect y="48" width="90" height="10" rx="5" fill="#f5c04a"/>
    </g>
  </g>
  <g font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" font-weight="600" fill="#fff">
    <rect x="80" y="540" width="132" height="44" rx="22" fill="#ffffff18"/><text x="146" y="569" text-anchor="middle">No sign-up</text>
    <rect x="228" y="540" width="132" height="44" rx="22" fill="#ffffff18"/><text x="294" y="569" text-anchor="middle">No ads</text>
    <rect x="376" y="540" width="160" height="44" rx="22" fill="#ffffff18"/><text x="456" y="569" text-anchor="middle">No tracking</text>
  </g>
</svg>`;

const icon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${brand}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <path d="${star(32, 30, 18)}" fill="#fff"/>
</svg>`;

await mkdir('public/icons', { recursive: true });
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile('public/og.png');
for (const size of [192, 512]) {
  await sharp(Buffer.from(icon(size)))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
}
await sharp(Buffer.from(icon(180)))
  .resize(180, 180)
  .png()
  .toFile('public/icons/apple-touch-icon.png');
const ico = await sharp(Buffer.from(icon(32)))
  .resize(32, 32)
  .png()
  .toBuffer();
// A PNG payload inside an ICO container is valid for every modern browser.
const header = Buffer.alloc(6 + 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header[8] = 0;
header[9] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(ico.length, 14);
header.writeUInt32LE(22, 18);
await writeFile('public/favicon.ico', Buffer.concat([header, ico]));
console.log('Generated public/og.png, icons and favicon.ico');
