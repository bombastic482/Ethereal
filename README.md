# Ethereal — Weight loss, done properly.

Free, science-backed weight-loss planning that runs entirely in your browser. Live at **https://bombastic482.github.io/Ethereal/**.

- **A food diary** (`/today/`): calorie ring, macro bars, four meals, a 1,500+ item offline food database (generic foods, world cuisines, brands and chains), Open Food Facts search and barcode scanning, "type what you ate" natural-language entry, quick add, custom foods, saved meals, exercise (MET-based), steps, water, copy-yesterday, favourites and "what to eat next" suggestions.
- **A day planner** (on `/plan/`): four recipes chosen so the day lands on your calorie target with the protein covered; swap or lock any slot, log the whole day to today or tomorrow, save the recipes as your own meals, copy a 1, 3 or 7-day shopping list.
- **68 starter recipes** (`/recipes/`): high-protein meals and snacks built from database foods, with calories and macros computed from the same rows as the diary. Filter by meal, time and diet, see what fits the calories you have left, log in one tap or save as your own meal.
- **A personal plan** (`/start/` → `/plan/`): calories, protein, macros and a realistic goal date from your stats, in three steps; a measured expenditure estimate once you have logged a few weeks; pattern insights (weekend drift, protein hit rate, consistency).
- **A weight tracker** (`/track/`): daily weigh-ins, an exponentially-smoothed trend line, weekly averages, waist, hips, chest, arm and thigh, notes, progress photos (stored in IndexedDB) and a shareable progress card.
- **A weekly review** (`/review/`): the week in numbers, next week's decision applied in one tap, patterns, and a two-line reflection saved per week.
- **A two-week check**: compares your measured trend with the plan and recommends a specific calorie adjustment (capped, never below safe floors), applied with one click.
- **Eight calculators** (calories/TDEE, goal timeline, macros, BMI, body fat, protein, ideal weight, water) sharing one profile.
- **Eighteen evidence-based guides**, a quick launcher (⌘K), a first-run tour, calendar reminders (.ics), installable as an app, works offline, exports/imports full backups (plan, weigh-ins, diary, preferences, reflections), shares a plan between devices via a link.
- **An identity of its own**: warm paper and ink, moss and apricot, serif numerals, paper grain, warm-charcoal dark mode.
- **No account, no server, no tracking.** Nothing you enter ever leaves your device.

**Stack:** [Astro](https://astro.build) (static output) · [Preact](https://preactjs.com) islands · [Tailwind CSS v4](https://tailwindcss.com) · TypeScript strict · Vitest · Playwright · Lighthouse CI.

## Why this stack

- **Fast.** Static HTML; the diary page ships about 25 KB of gzipped JavaScript in total and loads the food database lazily in six 10–13 KB chunks. Fonts are self-hosted and subset; no third-party requests at all.
- **Free to run.** No server, no database. Deploys to GitHub Pages, Cloudflare Pages, Vercel or Netlify on their free tiers.
- **Private.** Inputs are saved in `localStorage` so every calculator pre-fills. Nothing is ever sent anywhere.
- **Correct.** Every calculation lives in `src/lib/calc/` as pure functions with unit tests, separate from the UI.
- **Findable.** Canonical URLs, Open Graph image, sitemap, and JSON-LD (`WebApplication`, `FAQPage`, `Article`, `BreadcrumbList`) on every page.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run verify     # data validators + astro check + unit tests + production build
npm run test:e2e   # Playwright against the built site (run `npm run build` first)
npm run format     # Prettier
npm run og         # regenerate public/og.png and icons from scripts/og.mjs
```

Requires Node 22+ (see `.nvmrc`).

## Deploy

The site is live on GitHub Pages at **https://bombastic482.github.io/Ethereal/** once Pages is switched on for the repository (one-time, see below). Every push to `main` rebuilds and redeploys it automatically.

### Going live on GitHub Pages (one time)

1. Repository **Settings → Pages → Build and deployment → Source**: choose **GitHub Actions**.
2. GitHub Pages on the free plan requires a **public** repository: **Settings → General → Danger Zone → Change visibility → Public**. (The code contains no secrets; everything runs in the visitor's browser.)
3. Open the **Actions** tab and re-run "Deploy to GitHub Pages" if it ran before the switch was flipped. The deployment URL is printed in the run summary.

The build is base-path aware: under GitHub project pages it serves from `/Ethereal/`; on a custom domain or any other host it serves from `/`. Set `SITE_URL` (and `BASE_PATH` when not at the root) for canonical URLs, the sitemap and Open Graph. See `.env.example`.

### Custom domain

Add the domain under **Settings → Pages → Custom domain**, set the `SITE_URL` repository variable to it, and the next deploy builds with base `/`.

| Host             | Setup                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| GitHub Pages     | Settings → Pages → Source: _GitHub Actions_. `.github/workflows/deploy-pages.yml` handles it.     |
| Cloudflare Pages | Connect repo · build `npm run build` · output `dist` · env `SITE_URL`. `public/_headers` applies. |
| Vercel           | Import repo · framework Astro · env `SITE_URL`. `vercel.json` sets security headers.              |
| Netlify          | Build `npm run build` · publish `dist` · env `SITE_URL`. `public/_headers` applies.               |

## Project layout

```
src/
  lib/calc/          pure calculation engine + tests
  lib/profile.ts     shared localStorage profile (one entry, every tool)
  lib/store.ts       tiny persistent store factory (subscribe + hook)
  lib/plan.ts        plan model and derived daily targets
  lib/log.ts         weigh-in log
  lib/backup.ts      export / import / share-link
  lib/calc/trend.ts  smoothed trend, slope, progress assessment and adjustment
  lib/calc/nutrition.ts, exercise.ts, streaks.ts, expenditure.ts, insights.ts  diary maths
  lib/food-store.ts  food/exercise diary; lib/foods.ts local DB search; lib/off.ts Open Food Facts client
  lib/recipes.ts     starter recipes resolved against the database; lib/day-plan.ts whole-day planner + shopping list
  lib/quick-parse.ts natural-language entry
  data/foods-*.json  built-in food database (six lazy chunks); data/recipes.json starter recipes
  scripts/validate-foods.mjs, validate-recipes.mjs  data validators, run in CI
  lib/tools.ts       tool registry (nav, cards, sitemap)
  components/ui/     Preact primitives (inputs, gauge, charts, callouts)
  components/calculators/  one island per tool, plus Onboarding, PlanDashboard, WeightTracker, DataManager
  layouts/           Base (SEO, theme, header/footer) and ToolLayout (breadcrumbs, FAQ, related)
  pages/             routes; tools/*.astro hold the SEO copy for each calculator
  content/guides/    Markdown articles validated by src/content.config.ts
tests/e2e/           Playwright smoke, app-flow and axe accessibility tests
public/sw.js         service worker (offline-first assets, network-first pages)
scripts/og.mjs       generates OG image + icons with sharp (run once, commit output)
```

## Methodology

See `/about/` on the site. In short: Mifflin-St Jeor by default (Harris-Benedict and Katch-McArdle available), deficits capped at 25 % of TDEE (the standard 550 kcal always allowed) with 1,200/1,500 kcal floors, adaptive week-by-week timeline, U.S. Navy body-fat method, protein ranges from recent meta-analyses.

## Licence

MIT.
