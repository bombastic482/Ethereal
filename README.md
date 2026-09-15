# Ethereal — Weight loss, done properly.

Free, science-backed weight-loss calculators and guides. Eight tools (calories/TDEE, goal timeline, macros, BMI, body fat, protein, ideal weight, water), six evidence-based guides, one shared private profile, zero tracking.

**Stack:** [Astro](https://astro.build) (static output) · [Preact](https://preactjs.com) islands · [Tailwind CSS v4](https://tailwindcss.com) · TypeScript strict · Vitest · Playwright · Lighthouse CI.

## Why this stack

- **Fast.** Static HTML with ~20 KB of gzipped JavaScript on the heaviest page. Fonts are self-hosted and subset; no third-party requests at all.
- **Free to run.** No server, no database. Deploys to GitHub Pages, Cloudflare Pages, Vercel or Netlify on their free tiers.
- **Private.** Inputs are saved in `localStorage` so every calculator pre-fills. Nothing is ever sent anywhere.
- **Correct.** Every calculation lives in `src/lib/calc/` as pure functions with unit tests, separate from the UI.
- **Findable.** Canonical URLs, Open Graph image, sitemap, and JSON-LD (`WebApplication`, `FAQPage`, `Article`, `BreadcrumbList`) on every page.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run verify     # astro check + unit tests + production build
npm run test:e2e   # Playwright against the built site (run `npm run build` first)
npm run format     # Prettier
npm run og         # regenerate public/og.png and icons from scripts/og.mjs
```

Requires Node 22+ (see `.nvmrc`).

## Deploy

Set `SITE_URL` to your canonical URL (used for canonicals, sitemap and Open Graph). See `.env.example`.

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
  lib/tools.ts       tool registry (nav, cards, sitemap)
  components/ui/     Preact primitives (inputs, gauge, charts, callouts)
  components/calculators/  one island per tool
  layouts/           Base (SEO, theme, header/footer) and ToolLayout (breadcrumbs, FAQ, related)
  pages/             routes; tools/*.astro hold the SEO copy for each calculator
  content/guides/    Markdown articles validated by src/content.config.ts
tests/e2e/           Playwright smoke tests
scripts/og.mjs       generates OG image + icons with sharp (run once, commit output)
```

## Methodology

See `/about/` on the site. In short: Mifflin-St Jeor by default (Harris-Benedict and Katch-McArdle available), deficits capped at 25 % of TDEE (the standard 550 kcal always allowed) with 1,200/1,500 kcal floors, adaptive week-by-week timeline, U.S. Navy body-fat method, protein ranges from recent meta-analyses.

## Licence

MIT.
