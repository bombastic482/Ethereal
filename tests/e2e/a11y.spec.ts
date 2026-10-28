import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/tools/',
  '/tools/calories/',
  '/tools/timeline/',
  '/guides/',
  '/guides/calorie-deficit-explained/',
  '/start/',
  '/plan/',
  '/track/',
  '/settings/',
  '/about/',
];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    // Entrance animations leave text at partial opacity for a moment; sample the settled page.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
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
