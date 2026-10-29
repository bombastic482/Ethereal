import { expect, test } from '@playwright/test';

test.describe('phone tab bar', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'mobile', 'The tab bar only shows on phones');
  });

  test('stays the same element across navigations and moves its highlight on tap', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('ethereal:tour:v1', '1'));
    await page.goto('/today/');
    const bar = page.locator('[data-tabbar]');
    await expect(bar).toBeVisible();
    await bar.evaluate((el) => ((el as HTMLElement & { marker?: number }).marker = 7));
    for (const [i, path] of [
      [1, '/plan/'],
      [2, '/track/'],
      [0, '/today/'],
    ] as const) {
      await page.locator(`[data-tab="${i}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator(`[data-tab="${i}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[data-tab][aria-current="page"]')).toHaveCount(1);
      // Persisted, not re-rendered: the marker set on the first page survives.
      expect(await bar.evaluate((el) => (el as HTMLElement & { marker?: number }).marker)).toBe(7);
      await expect(page.locator('[data-tabbar]')).toHaveCount(1);
    }
  });

  test('touch screens skip view transitions and drop the costly blurs', async ({ page }) => {
    await page.goto('/today/');
    expect(await page.evaluate(() => typeof document.startViewTransition)).toBe('undefined');
    expect(
      await page.evaluate(
        () => getComputedStyle(document.querySelector('.site-header')!).backdropFilter,
      ),
    ).toBe('none');
    expect(
      await page.evaluate(
        () => getComputedStyle(document.querySelector('[data-tabbar]')!).backdropFilter,
      ),
    ).toBe('none');
  });
});
