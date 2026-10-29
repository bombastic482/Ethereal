/**
 * Regenerates the README visuals in docs/readme/. It captures the app in dark mode on a desktop
 * browser and a phone, using a realistic demo diary. It then composes each scene as a dark card:
 * a neutral browser window and a generic phone, plus a banner for the numbers. Every scene has a
 * wide version and a portrait version for phones; README.md switches between them with <picture>.
 *
 *   npm run build && node scripts/serve.mjs dist 4173 &
 *   npm run readme:visuals                  # capture and compose
 *   npm run readme:visuals -- --compose     # compose again from the last captures
 *
 * Set PW_CHROMIUM_PATH to use a preinstalled Chromium.
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:4173';
const RAW = 'docs/readme/.raw';
const OUT = 'docs/readme';
const COMPOSE_ONLY = process.argv.includes('--compose');
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

/** Demo data: six weeks of weigh-ins and meals; today is mid-day with dinner still to log. Each
 *  day is the same breakfast, lunch and snack with a dinner from a weekly rotation, all weighed
 *  against the real food database so every number matches what the app would compute. */
const DEMO_DAYS = 42;
const foodDb = new Map(
  'abcdef'
    .split('')
    .flatMap((chunk) => JSON.parse(readFileSync(`src/data/foods-${chunk}.json`, 'utf8')))
    .map((f) => [f.id, f]),
);
const demoMeals = {
  daily: [
    ['breakfast', 'yogurt-greek-0', 250],
    ['breakfast', 'blueberries', 80],
    ['lunch', 'chicken-breast-cooked', 180],
    ['lunch', 'rice-basmati-cooked', 120],
    ['snack', 'almonds', 25],
  ],
  dinners: [
    [
      ['salmon-farmed-cooked', 125],
      ['sweet-potato-baked', 150],
    ],
    [['chicken-stir-fry', 400]],
    [
      ['lentil-soup-homemade', 350],
      ['salad-greek', 150],
    ],
    [['big-mac-mcdonalds', 219]],
    [['lamb-kofta-grilled', 180]],
    [['chicken-tikka-masala', 300]],
  ],
};
const demoFoods = Object.fromEntries(
  [...demoMeals.daily.map((m) => m[1]), ...demoMeals.dinners.flat().map((d) => d[0])].map((id) => {
    const f = foodDb.get(id);
    if (!f) throw new Error(`Demo food ${id} is not in the database`);
    return [id, { name: f.name, per100g: f.per100g }];
  }),
);

const seed = ({ days, meals, foods }) => {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => new Date(today.getTime() - n * 864e5);
  const time = { breakfast: 480, lunch: 760, snack: 960, dinner: 1170 };
  const food = [];
  const weights = [];
  const weightOn = (i) => +(82 - (days - 1 - i) * 0.075 + Math.sin(i) * 0.35).toFixed(1);
  for (let i = 0; i < days; i++) {
    const date = iso(daysAgo(i));
    weights.push({ date, weightKg: weightOn(i) });
    const dinner =
      i === 0 ? [] : meals.dinners[i % meals.dinners.length].map((d) => ['dinner', ...d]);
    for (const [meal, foodId, grams] of [...meals.daily, ...dinner]) {
      food.push({
        id: `${date}-${meal}-${foodId}`,
        date,
        meal,
        name: foods[foodId].name,
        foodId,
        grams,
        per100g: foods[foodId].per100g,
        source: 'local',
        time: time[meal],
      });
    }
  }
  localStorage.setItem('ethereal:tour:v1', '1');
  localStorage.setItem(
    'ethereal:profile:v1',
    JSON.stringify({
      units: 'metric',
      sex: 'female',
      age: 35,
      heightCm: 168,
      weightKg: weightOn(0),
      activity: 1.375,
      bodyFatPct: null,
    }),
  );
  localStorage.setItem(
    'ethereal:plan:v1',
    JSON.stringify({
      active: true,
      goal: 'lose',
      goalWeightKg: 68,
      rateKgPerWeek: 0.5,
      formula: 'mifflin',
      macroPreset: 'high-protein',
      startedOn: iso(daysAgo(days - 1)),
      startWeightKg: 82,
      calorieOverride: null,
      lastAdjustedOn: null,
    }),
  );
  localStorage.setItem('ethereal:log:v1', JSON.stringify({ entries: weights.reverse() }));
  localStorage.setItem(
    'ethereal:diary:v1',
    JSON.stringify({
      food,
      exercise: [{ id: 'x1', date: iso(today), activity: 'walking-brisk', minutes: 30, kcal: 150 }],
      water: { [iso(today)]: 4 },
      customFoods: [],
      recent: [],
      favourites: [],
      meals: [],
      steps: Object.fromEntries(
        [8200, 9400, 7100, 10300, 8800, 6900, 9600].map((n, i) => [iso(daysAgo(i)), n]),
      ),
      products: {},
    }),
  );
};
const demo = { days: DEMO_DAYS, meals: demoMeals, foods: demoFoods };

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);

// 1. Capture, in dark mode. Desktop screens are 1280 px wide and end at a natural break in the
// page (the bottom of a card), so no screen is cut through the middle of something. Phone
// screens are a full 400 × 860 viewport, tab bar included.
const DESKTOP_WIDTH = 1280;
const phone = {
  ...devices['Pixel 7'],
  viewport: { width: 400, height: 860 },
  deviceScaleFactor: 3,
};

/** Where a desktop screen starts and ends: from the top of the page, or of the section under
 *  `heading`, down to 40 px below the card holding `until` (or below that section). Anything after it
 *  is hidden. */
const frameFor = (page, { heading, until }, hide) =>
  page.evaluate(
    ([heading, until, hide]) => {
      const header = document.querySelector('.site-header').getBoundingClientRect().height;
      const y = (el, edge) => el.getBoundingClientRect()[edge] + window.scrollY;
      let top = 0;
      let end = null;
      if (heading) {
        const h = [...document.querySelectorAll('main h2')].find((x) =>
          x.textContent.includes(heading),
        );
        end = h.closest('section');
        top = y(end, 'top') - header - 32;
      }
      if (until) {
        const leaf = [...document.querySelectorAll('main *')].find(
          (e) =>
            e.children.length === 0 &&
            (e.textContent.includes(until) || e.getAttribute('placeholder')?.includes(until)),
        );
        end = leaf.closest('.surface, section');
      }
      // Hide whatever starts below it, so the next card does not peek in under the margin. Screens that
      // open a dialog keep it, as the dialog's backdrop covers the page anyway.
      const cut = y(end, 'bottom');
      for (let el = hide ? end : null; el && el !== document.body; el = el.parentElement) {
        for (let sib = el.nextElementSibling; sib; sib = sib.nextElementSibling) {
          if (y(sib, 'top') >= cut) sib.style.visibility = 'hidden';
        }
      }
      return { top: Math.round(top), height: Math.round(y(end, 'bottom') + 40 - top) };
    },
    [heading, until, hide],
  );
// Search runs offline, as the capture has no network: the dialog then says built-in foods
// still work, instead of reporting that Open Food Facts did not respond.
const searchFor = (query) => async (p) => {
  await p.context().setOffline(true);
  await p.getByRole('button', { name: /^Add$/ }).first().click();
  await p.waitForTimeout(500);
  await p.locator('input[type="search"], input[type="text"]').first().fill(query);
  await p.mouse.move(0, 0); // no hover highlight on a result
  await p.waitForTimeout(900);
};
const scrollTo = (y) => (p) =>
  p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
const scrollToSelector = (selector, offset) => (p) =>
  p.evaluate(
    ([selector, offset]) => {
      const top = document.querySelector(selector).getBoundingClientRect().top;
      window.scrollTo({ top: top + scrollY - offset, behavior: 'instant' });
    },
    [selector, offset],
  );
const scrollToChain = (name, offset) => (p) =>
  p.evaluate(
    ([name, offset]) => {
      const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.includes(name));
      window.scrollTo({
        top: h.getBoundingClientRect().top + scrollY - offset,
        behavior: 'instant',
      });
    },
    [name, offset],
  );

const desktopShots = [
  // [name, path, frame, action]
  ['d-today', '/today/', { until: 'Type what you ate' }],
  ['d-search', '/today/', { until: 'Type what you ate' }, searchFor('chicken breast')],
  ['d-plan', '/plan/', { until: 'Fine-tune macros' }],
  ['d-review', '/review/', { until: 'Average ' }],
  ['d-eatout', '/eating-out/', { heading: "Nando's" }],
];
const phoneShots = [
  // [name, path, action]
  ['m-today', '/today/'],
  ['m-plan', '/plan/'],
  ['m-search', '/today/', searchFor('chicken')],
  ['m-planner', '/plan/', scrollToSelector('#dayplan-h', 120)],
  ['m-track', '/track/', scrollTo(640)],
  ['m-review', '/review/'],
  ['m-recipe', '/recipes/shakshuka-with-feta/'],
  ['m-eatout', '/eating-out/', scrollToChain("Nando's", 90)],
];
const open = async (device, path) => {
  const ctx = await browser.newContext({ ...device, colorScheme: 'dark' });
  await ctx.addInitScript(seed, demo);
  await ctx.addInitScript(() => localStorage.setItem('ethereal:theme', 'dark'));
  const page = await ctx.newPage();
  await page.goto(ORIGIN + path);
  await page.waitForTimeout(2200);
  return { ctx, page };
};
if (!COMPOSE_ONLY) {
  for (const [name, path, frame, action] of desktopShots) {
    const device = { viewport: { width: DESKTOP_WIDTH, height: 1600 }, deviceScaleFactor: 2 };
    const { ctx, page } = await open(device, path);
    const { top, height } = await frameFor(page, frame, !action);
    await page.setViewportSize({ width: DESKTOP_WIDTH, height });
    await scrollTo(top)(page);
    await page.waitForTimeout(400);
    if (action) await action(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${RAW}/${name}.png` });
    await ctx.close();
    console.log('shot', name, `${DESKTOP_WIDTH}×${height}`);
  }
  for (const [name, path, action] of phoneShots) {
    const { ctx, page } = await open(phone, path);
    if (action) await action(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${RAW}/${name}.png` });
    await ctx.close();
    console.log('shot', name);
  }
}

// 2. Compose. Every scene is a dark card; devices sit wholly inside it with even margins.
const base64 = (path) => readFileSync(path).toString('base64');
const shot = (name) => `data:image/png;base64,${base64(`${RAW}/${name}.png`)}`;
const font = (pkg, file) => base64(`node_modules/@fontsource-variable/${pkg}/files/${file}`);
const icon = `data:image/png;base64,${base64('public/icons/icon-512.png')}`;
const sizes = Object.fromEntries(
  await Promise.all(
    [...desktopShots, ...phoneShots].map(async ([name]) => {
      const { width, height } = await sharp(`${RAW}/${name}.png`).metadata();
      return [name, height / width];
    }),
  ),
);

// Device geometry, in CSS pixels of the scene.
const BAR = 36; // browser title bar
const BEZEL = 9; // phone frame
const TOP_STRIP = 30; // phone status area above the app
const winHeight = (name, w) => BAR + w * sizes[name];
const phoneHeight = (name, w) => 2 * BEZEL + TOP_STRIP + (w - 2 * BEZEL) * sizes[name];

const css = `
@font-face { font-family: Manrope; src: url(data:font/woff2;base64,${font('manrope', 'manrope-latin-wght-normal.woff2')}) format('woff2'); font-weight: 200 800; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: transparent; }
body { font-family: Manrope, sans-serif; color: #f3f5f8; -webkit-font-smoothing: antialiased; }
.card { position: relative; overflow: hidden; border-radius: 32px; isolation: isolate;
  background:
    radial-gradient(var(--gw, 1100px) var(--gh, 620px) at var(--gx, 50%) var(--gy, -8%), rgba(34, 195, 138, .22), transparent 70%),
    radial-gradient(760px 520px at var(--ax, 100%) var(--ay, 110%), rgba(34, 195, 138, .06), transparent 70%),
    linear-gradient(180deg, #0b0f12, #07090b); }
.card::before { content: ''; position: absolute; inset: 0; z-index: -1;
  background-image: radial-gradient(rgba(255, 255, 255, .07) 1.2px, transparent 1.6px); background-size: 30px 30px;
  -webkit-mask-image: radial-gradient(var(--gw, 1100px) var(--gh, 620px) at var(--gx, 50%) var(--gy, -8%), #000, transparent 75%); }
.rim { position: absolute; inset: 0; border-radius: 32px; z-index: 20; pointer-events: none;
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, .085), inset 0 1.5px 0 rgba(255, 255, 255, .06); }

.win { position: absolute; border-radius: 14px; overflow: hidden; background: #0c0f13;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, .11), 0 50px 90px -30px rgba(0, 0, 0, .85), 0 20px 40px -20px rgba(0, 0, 0, .6); }
.win .bar { height: ${BAR}px; display: flex; align-items: center; gap: 8px; padding: 0 16px;
  background: #12151a; border-bottom: 1px solid rgba(255, 255, 255, .06); }
.win .bar i { width: 11px; height: 11px; border-radius: 50%; background: #2b3038; }
.win img { display: block; width: 100%; }

.phone { position: absolute; border-radius: 46px; padding: ${BEZEL}px;
  background: linear-gradient(150deg, #2c3037, #17191d 38%, #0e1013);
  box-shadow: 0 0 0 1px #000, inset 0 0 0 1.5px rgba(255, 255, 255, .11), 0 50px 90px -30px rgba(0, 0, 0, .9), 0 20px 40px -20px rgba(0, 0, 0, .65); }
.phone::after { content: ''; position: absolute; right: -2.5px; top: 21%; width: 3px; height: 64px; border-radius: 0 2px 2px 0; background: #2a2e35; }
.phone .scr { position: relative; overflow: hidden; border-radius: 37px; background: rgb(6, 8, 11); padding-top: ${TOP_STRIP}px; }
.phone .cam { position: absolute; top: 10px; left: 50%; width: 11px; height: 11px; margin-left: -5.5px; border-radius: 50%;
  background: #000; box-shadow: 0 0 0 2px #14161a; }
.phone img { display: block; width: 100%; }

.brand { display: flex; align-items: center; gap: 16px; font-weight: 800; letter-spacing: -.03em; }
.brand img { border-radius: 24%; box-shadow: 0 10px 30px -8px rgba(34, 195, 138, .5); }
h1 { font-weight: 800; letter-spacing: -.048em; line-height: .98; color: #f6f8fa; }
.grad { background: linear-gradient(92deg, #4fe8b0, #1db27f 70%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lede { color: #9aa3b0; font-weight: 500; line-height: 1.4; letter-spacing: -.01em; }
.pills { display: flex; gap: 14px; }
.pill { display: inline-flex; align-items: center; gap: 10px; height: 54px; padding: 0 26px; border-radius: 999px; font-weight: 700; font-size: 21px; }
.pill.go { background: #22c38a; color: #04130d; box-shadow: 0 12px 40px -10px rgba(34, 195, 138, .6); }
.pill.ghost { color: #d4dae2; box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, .14); background: rgba(255, 255, 255, .03); }
.center { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }

.stat { padding-inline-start: 30px; border-inline-start: 1.5px solid rgba(255, 255, 255, .07); }
.stat:first-child, .stack .stat { padding-inline-start: 0; border: 0; }
.stat .n { font-weight: 800; letter-spacing: -.05em; line-height: 1; color: #f6f8fa; font-variant-numeric: tabular-nums; }
.stat .n.grad { color: transparent; }
.stat .l { margin-top: 14px; font-weight: 700; color: #e2e7ed; }
.stat .s { margin-top: 6px; font-weight: 500; color: #7d8693; }
`;

const win = (name, { x, y, w }) =>
  `<div class="win" style="left:${x}px;top:${y}px;width:${w}px"><div class="bar"><i></i><i></i><i></i></div><img src="${shot(name)}"></div>`;
const device = (name, { x, y, w, dim = false }) =>
  `<div class="phone" style="left:${x}px;top:${y}px;width:${w}px${dim ? ';filter:brightness(.8)' : ''}"><div class="scr"><span class="cam"></span><img src="${shot(name)}"></div></div>`;
const card = (w, h, vars, inner) =>
  `<div class="card" style="width:${w}px;height:${Math.round(h)}px;${vars}">${inner}<div class="rim"></div></div>`;
const brand = (size) =>
  `<div class="brand" style="font-size:${size}px"><img src="${icon}" style="width:${size * 1.45}px;height:${size * 1.45}px">Ethereal</div>`;

/**
 * A browser window with a phone over its lower corner, covering only the page margin, centred as one group. The phone
 * hangs 40 px below the window; if the phone is the taller of the two, the window is centred
 * on it instead. `top` leaves room for a headline above the group.
 */
const group = (screen, handset, opts) => {
  const { side, top = 72, winW = 1180, phoneW = 310, overlap = 80, width = 1600 } = opts;
  const wh = winHeight(screen, winW);
  const ph = phoneHeight(handset, phoneW);
  const left = (width - (winW + phoneW - overlap)) / 2;
  const winX = side === 'right' ? left : left + phoneW - overlap;
  const phoneX = side === 'right' ? left + winW - overlap : left;
  const bottom = Math.max(top + wh + 40, top + ph);
  const winY = top + wh + 40 >= top + ph ? top : top + (ph - wh) / 2;
  return {
    html:
      win(screen, { x: winX, y: winY, w: winW }) +
      device(handset, { x: phoneX, y: bottom - ph, w: phoneW }),
    bottom,
  };
};
const feature = (screen, handset, side) => {
  const g = group(screen, handset, { side });
  return card(
    1600,
    g.bottom + 72,
    `--gx:${side === 'right' ? '76%' : '24%'};--gy:0%;--ax:${side === 'right' ? '0%' : '100%'}`,
    g.html,
  );
};
/** A portrait scene for phones: two complete handsets side by side. */
const PAIR_W = 336;
const pair = (a, b, top = 56) => ({
  html:
    device(a, { x: 48, y: top, w: PAIR_W }) +
    device(b, { x: 800 - 48 - PAIR_W, y: top, w: PAIR_W }),
  bottom: top + Math.max(phoneHeight(a, PAIR_W), phoneHeight(b, PAIR_W)),
});
const pairCard = (a, b) => {
  const p = pair(a, b);
  return card(800, p.bottom + 56, '--gx:50%;--gy:-4%;--gw:900px;--gh:560px', p.html);
};

const stats = [
  ['1,444', 'Foods', 'searchable offline'],
  ['66', 'Recipes', 'high in protein'],
  ['155', 'Restaurant dishes', 'at 20 chains, ranked'],
  ['18', 'Guides', 'with the evidence'],
  ['8', 'Calculators', 'free, no sign-up'],
  ['0', 'Ads or trackers', 'and no account'],
];
const stat = ([n, l, s], { n: ns, l: ls, s: ss, accent }) =>
  `<div class="stat"><div class="n${accent ? ' grad' : ''}" style="font-size:${ns}px">${n}</div><div class="l" style="font-size:${ls}px">${l}</div><div class="s" style="font-size:${ss}px">${s}</div></div>`;

const heroGroup = group('d-today', 'm-plan', {
  side: 'right',
  top: 456,
  winW: 1080,
  phoneW: 300,
  overlap: 70,
});
const heroPair = pair('m-plan', 'm-today', 560);
const scenes = {
  hero: card(
    1600,
    heroGroup.bottom + 72,
    '--gx:50%;--gy:-12%;--gw:1400px;--gh:760px',
    `<div class="center" style="top:72px">${brand(30)}
      <h1 style="margin-top:44px;font-size:100px">Weight loss, <span class="grad">done properly.</span></h1>
      <p class="lede" style="margin-top:26px;font-size:29px">The complete weight-loss app that runs in your browser. Free, private, no account.</p>
      <div class="pills" style="margin-top:36px"><span class="pill go">Open the app →</span><span class="pill ghost">Works on any phone or computer</span></div></div>` +
      heroGroup.html,
  ),
  'hero-mobile': card(
    800,
    heroPair.bottom + 56,
    '--gx:50%;--gy:-6%;--gw:900px;--gh:700px',
    `<div class="center" style="top:64px">${brand(30)}
      <h1 style="margin-top:44px;font-size:86px">Weight loss,<br><span class="grad">done properly.</span></h1>
      <p class="lede" style="margin-top:26px;font-size:30px;max-width:640px">The complete weight-loss app that runs in your browser. Free, private, no account.</p></div>` +
      heroPair.html,
  ),
  diary: feature('d-search', 'm-today', 'right'),
  'diary-mobile': pairCard('m-today', 'm-search'),
  plan: feature('d-plan', 'm-planner', 'left'),
  'plan-mobile': pairCard('m-plan', 'm-planner'),
  track: feature('d-review', 'm-track', 'right'),
  'track-mobile': pairCard('m-track', 'm-review'),
  food: feature('d-eatout', 'm-recipe', 'left'),
  'food-mobile': pairCard('m-recipe', 'm-eatout'),
  numbers: card(
    1600,
    360,
    '--gx:50%;--gy:-40%;--gw:1400px;--gh:420px',
    `<div style="position:absolute;inset:0 72px;display:grid;grid-template-columns:1.2fr 1fr 1.35fr 1fr 1.1fr 1.2fr;column-gap:30px;align-items:center">${stats
      .map((s, i) => stat(s, { n: 70, l: 21, s: 17, accent: i === stats.length - 1 }))
      .join('')}</div>`,
  ),
  'numbers-mobile': card(
    800,
    760,
    '--gx:50%;--gy:-10%;--gw:900px;--gh:600px',
    `<div class="stack" style="position:absolute;inset:72px;display:grid;grid-template-columns:1fr 1fr;align-content:space-between">${stats
      .map((s, i) => stat(s, { n: 84, l: 26, s: 21, accent: i === stats.length - 1 }))
      .join('')}</div>`,
  ),
};

const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
for (const [name, html] of Object.entries(scenes)) {
  if (only && !only.includes(name)) continue;
  const width = Number(html.match(/width:(\d+)px/)[1]);
  const height = Number(html.match(/height:(\d+)px/)[1]);
  // Wide scenes render at 1600 px for GitHub's 1012 px column (sharp on 2× screens); portrait
  // scenes at 1.35× so they stay crisp on a 3× phone.
  const scale = width < 1000 ? 1.35 : 1;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(
    `<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const png = await page.locator('.card').screenshot({ omitBackground: true, type: 'png' });
  const out = `${OUT}/${name}.webp`;
  await sharp(png)
    .webp({ quality: 88, alphaQuality: 90, effort: 6, smartSubsample: true })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(
    name,
    `${meta.width}×${meta.height}`,
    `${Math.round(readFileSync(out).length / 1024)} KB`,
  );
  await page.close();
}
await browser.close();
