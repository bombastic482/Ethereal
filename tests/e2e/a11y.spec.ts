import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/today/',
  '/review/',
  '/compare/',
  '/tools/',
  '/tools/calories/',
  '/tools/timeline/',
  '/guides/',
  '/guides/calorie-deficit-explained/',
  '/recipes/',
  '/recipes/shakshuka-with-feta/',
  '/start/',
  '/plan/',
  '/track/',
  '/settings/',
  '/about/',
  '/changelog/',
  '/eating-out/',
  '/privacy/',
];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    // Entrance animations leave text at partial opacity for a moment; sample the settled page.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('ethereal:tour:v1', '1'));
    await page.goto(path);
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious,
      serious
        .map(
          (v) =>
            `${v.id}: ${v.help} (${v.nodes.length} nodes)\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
        )
        .join('\n'),
    ).toEqual([]);
  });
}

// Dark mode uses a different palette, so contrast has to be checked there too.
for (const path of ['/', '/today/', '/plan/', '/review/', '/recipes/', '/settings/']) {
  test(`no serious accessibility violations on ${path} in dark mode`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.addInitScript(() => {
      localStorage.setItem('ethereal:tour:v1', '1');
      localStorage.setItem('ethereal:theme', 'dark');
    });
    await page.goto(path);
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious,
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`).join('\n'),
    ).toEqual([]);
  });
}
