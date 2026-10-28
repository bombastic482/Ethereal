<p align="center">
  <a href="https://bombastic482.github.io/Ethereal/">
    <img src="public/icons/icon-192.png" width="88" height="88" alt="Ethereal mark" />
  </a>
</p>

<h1 align="center">Ethereal</h1>

<p align="center"><strong>Weight loss, done properly.</strong><br/>
A complete, private weight-loss app that runs entirely in the browser: plan, diary, tracker, recipes, review. No account, no server, no tracking, free forever.</p>

<p align="center">
  <a href="https://bombastic482.github.io/Ethereal/"><b>Open the app</b></a> ·
  <a href="https://bombastic482.github.io/Ethereal/about/">Methodology</a> ·
  <a href="https://bombastic482.github.io/Ethereal/changelog/">What's new</a> ·
  <a href="https://github.com/bombastic482/Ethereal/issues">Report a problem</a>
</p>

<p align="center">
  <a href="https://github.com/bombastic482/Ethereal/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/bombastic482/Ethereal/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://github.com/bombastic482/Ethereal/actions/workflows/deploy-pages.yml"><img alt="Deploy" src="https://github.com/bombastic482/Ethereal/actions/workflows/deploy-pages.yml/badge.svg" /></a>
  <img alt="Lighthouse 100" src="https://img.shields.io/badge/Lighthouse-100%20%C2%B7%20100%20%C2%B7%20100%20%C2%B7%20100-1f9d6b" />
  <img alt="WCAG 2.1 AA" src="https://img.shields.io/badge/WCAG%202.1-AA%20checked%20in%20CI-1f9d6b" />
  <img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-111827" />
</p>

<p align="center">
  <img src="docs/screenshots/home-light.png" alt="Ethereal home page" width="100%" />
</p>

---

## Why Ethereal

Most weight-loss apps are subscriptions with a database attached. They hold your data, show you ads, and hide the maths. Ethereal is the opposite on every count:

- **The maths is open.** Every formula is documented on the [about page](https://bombastic482.github.io/Ethereal/about/) and lives in [`src/lib/calc`](src/lib/calc) as pure, unit-tested functions.
- **Your data is yours.** Everything is stored in your browser (localStorage and IndexedDB). There is no backend to breach, no account to create, no analytics script. Export a full backup as JSON or CSV at any time.
- **It adapts.** A smoothed weight trend sees through daily water noise, and every two weeks a check compares your real rate with the plan and recommends a specific, capped calorie change.
- **It is fast and free to run.** A static site. Lighthouse scores 100 across performance, accessibility, best practices and SEO on a simulated slow phone, and it deploys to any static host on their free tier.

## What you get

<table>
<tr>
<td width="50%" valign="top">

### Plan

Three steps to a personal plan: calories, protein, macros and a realistic goal date from your stats. Choose Mifflin-St Jeor, Harris-Benedict or Katch-McArdle. Deficits are capped and floored so nothing reckless is ever suggested. Once you have logged a few weeks, Ethereal measures your real expenditure from your own intake and trend.

### Diary

Calorie ring, macro and fibre bars, four meals, water and steps. A built-in database of 1,537 validated foods that works offline (generic foods, world cuisines, chains and brands), Open Food Facts search and barcode scanning for packaged products with Nutri-Score and NOVA shown, natural-language entry ("2 eggs, a slice of toast and 150g greek yogurt"), quick add, custom foods, saved meals, copy yesterday, favourites and "what to eat next" suggestions.

### Track

Daily weigh-ins, an exponentially smoothed trend, weekly averages, waist, hips, chest, arm and thigh, notes, progress photos with a before-and-after slider, and a shareable progress card.

</td>
<td width="50%" valign="top">

### Recipes and planning

68 high-protein starter recipes built from the same database rows as the diary, each with its own page, nutrition table, serving scaler and social card. Plan a day or a whole week that lands on your targets, swap or lock slots, log it in one tap, and share the shopping list.

### Eating out

The leanest order at 20 chains (Chipotle, McDonald's, KFC, Nando's, Subway, Pret, Greggs, Starbucks, Costa and more): 171 menu items ranked by protein per calorie, coffee-shop drinks by calories. Tick items to build an order, or enter the calories you have left and let "Best order" pick the highest-protein combination that fits. Everything logs to Today in one tap.

### Review and insight

A weekly review with a twelve-week consistency grid, where the calories went, and pattern insights that point at the fix: weekend drift, your low-protein meal, fibre, late eating, eating window, takeaway share, consistency.

### Switch from another app

Import your history from MyFitnessPal, Lose It!, Cronometer or any CSV with dates and calories, macros or weight. A preview shows what was recognised; duplicates are skipped.

</td>
</tr>
</table>

Also: eight calculators sharing one profile, eighteen evidence-based guides, a quick launcher (⌘K), keyboard shortcuts, calendar reminders (.ics), a halal option that hides pork, gelatin sweets and alcohol everywhere, installable as an app, works offline, dark mode.

<p align="center">
  <img src="docs/screenshots/today-light.png" alt="Today: the food diary" width="49%" />
  <img src="docs/screenshots/track-light.png" alt="Track: weight trend" width="49%" />
</p>
<p align="center">
  <img src="docs/screenshots/recipes-light.png" alt="Recipes" width="49%" />
  <img src="docs/screenshots/eating-out-light.png" alt="Eating out: the leanest order at 20 chains" width="49%" />
</p>
<p align="center">
  <img src="docs/screenshots/home-dark.png" alt="Home, dark mode" width="66%" />
  <img src="docs/screenshots/plan-phone.png" alt="Plan on a phone" width="22%" />
</p>

## How the numbers work

| Question             | Method                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintenance calories | Mifflin-St Jeor by default; Harris-Benedict and Katch-McArdle (from body fat) available. Activity multipliers 1.2 to 1.9.                                                                                                           |
| Daily target         | Deficit capped at 25 % of TDEE (the standard 550 kcal always allowed), floors of 1,200 kcal (female) and 1,500 kcal (male).                                                                                                         |
| Goal date            | Week-by-week projection that recomputes maintenance as you get lighter, so the date is one you can plan around.                                                                                                                     |
| Trend weight         | Exponential moving average (α = 0.1) over daily weigh-ins, with a 14-day slope.                                                                                                                                                     |
| Two-week check       | Compares the measured trend with the planned rate in a toward-goal frame (works for losing, gaining and maintaining), recommends a change of at most ±250 kcal, never below the floors, with a 14-day cooldown between adjustments. |
| Measured expenditure | Average intake plus the energy implied by the trend change (7,700 kcal per kg), once there are enough logged days.                                                                                                                  |
| Protein              | 1.6 to 2.2 g per kg of body weight (higher per kg of lean mass when body fat is known), spread across meals.                                                                                                                        |
| Body fat             | U.S. Navy circumference method.                                                                                                                                                                                                     |
| Water                | Weight-based baseline adjusted for activity and climate.                                                                                                                                                                            |

Every function is in [`src/lib/calc`](src/lib/calc) with tests beside it. The site's [about page](https://bombastic482.github.io/Ethereal/about/) explains each in plain English with its evidence.

## Privacy, by construction

- Static HTML and JavaScript; no server-side code, no database, no cookies, no analytics, no third-party requests at all. The one optional network call is the Open Food Facts API when you search for a packaged product or scan a barcode.
- All data lives in `localStorage` (plan, diary, weigh-ins, preferences) and IndexedDB (progress photos). Export, import and clear everything from Settings.
- Share links encode your plan in the URL fragment, which never reaches a server.

## Quality

| Check                                                      | What it covers                                                                                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **144 unit tests** (Vitest)                                | Every calculation, the trend and adjustment engine, insights, CSV import, recipe planner, food search, halal filter, data stores and backup.               |
| **120 end-to-end tests** (Playwright, desktop and Pixel 7) | Onboarding, diary, planner, review, import, eating out, deep links, keyboard shortcuts, and an axe accessibility sweep of 25 pages in light and dark mode. |
| **Lighthouse CI**                                          | Desktop budgets at 0.95+ and a simulated-phone performance budget of 0.9+ on the key pages.                                                                |
| **Data validators**                                        | Every food and recipe is checked for shape, plausibility and energy consistency on each build.                                                             |
| **Type check and formatting**                              | `astro check` strict and Prettier on the whole tree.                                                                                                       |

## Stack

[Astro](https://astro.build) static output · [Preact](https://preactjs.com) islands · [Tailwind CSS v4](https://tailwindcss.com) · TypeScript strict · Vitest · Playwright · Lighthouse CI · [sharp](https://sharp.pixelplumbing.com) for build-time social cards.

The diary page ships about 25 KB of gzipped JavaScript in total and loads the food database lazily in six 10 to 13 KB chunks. One self-hosted, subset, preloaded font file. A service worker caches the app shell and the eating-out page for offline use.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run verify     # data validators + astro check + unit tests + production build
npm run build && npm run test:e2e   # Playwright against the built site
npm run format     # Prettier
npm run og         # regenerate public/og.png, icons and favicon from scripts/og.mjs
```

Requires Node 20+ (see `.nvmrc`). In a sandbox with a preinstalled Chromium, set `PW_CHROMIUM_PATH` to its binary before running the end-to-end suite.

## Deploy

Every push to `main` builds and deploys to GitHub Pages via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). The build is base-path aware: under a GitHub project page it serves from `/Ethereal/`; on a custom domain or any other host it serves from `/`. Set `SITE_URL` (and `BASE_PATH` when not at the root) for canonical URLs, the sitemap and social cards; see `.env.example`.

| Host             | Setup                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| GitHub Pages     | Settings → Pages → Source: _GitHub Actions_. The workflow does the rest.                              |
| Cloudflare Pages | Connect the repo · build `npm run build` · output `dist` · env `SITE_URL`. `public/_headers` applies. |
| Vercel           | Import the repo · framework Astro · env `SITE_URL`. `vercel.json` sets security headers.              |
| Netlify          | Build `npm run build` · publish `dist` · env `SITE_URL`. `public/_headers` applies.                   |

## Project layout

```
src/
  lib/calc/            the calculation engine: energy, macros, protein, timeline, trend,
                       expenditure, insights, breakdown, streaks, halal, chains (+ tests)
  lib/store.ts         tiny persistent store factory (localStorage, subscribe + hook)
  lib/profile.ts       one shared profile, every tool pre-fills from it
  lib/plan.ts          plan model and derived daily targets
  lib/log.ts           weigh-in log · lib/food-store.ts diary and preferences
  lib/foods.ts         offline food search · lib/off.ts Open Food Facts client
  lib/recipes.ts       starter recipes · lib/day-plan.ts day/week planner and shopping list
  lib/quick-parse.ts   natural-language entry · lib/import-csv.ts importer for other apps
  lib/*-build.ts       build-time views of recipes and chains for the static pages
  lib/og.ts            social card renderer (SVG → PNG at build time)
  data/                foods-a…f.json (six lazy chunks, 1,537 foods) and recipes.json
  components/          Preact islands (calculators, diary, planner, review) and Astro UI
  pages/               routes, including og/ image endpoints and the web manifest
  content/guides/      eighteen Markdown guides, validated by content.config.ts
tests/e2e/             Playwright smoke, app, diary and accessibility suites
scripts/               data validators, og/icon generator, static server for tests
public/sw.js           service worker: offline-first assets, network-first pages
```

## Design

One typeface ([Manrope](https://fonts.google.com/specimen/Manrope)), white and near-black surfaces with cool neutral greys, a single green accent, generous spacing and no visual noise. The mark is an "E" of three bars that get shorter: a letter and a downward trend in one shape. Tokens live in [`src/styles/global.css`](src/styles/global.css); dark mode follows the system and can be overridden.

## Contributing

Issues and pull requests are welcome. Run `npm run verify` before opening one; CI runs the same checks plus the end-to-end suite and Lighthouse budgets. Food data corrections should cite a source (a manufacturer label, USDA SR Legacy or McCance and Widdowson) in the pull request.

## Licence

[MIT](LICENSE). Ethereal provides general educational information and estimates only; it is not medical advice.
