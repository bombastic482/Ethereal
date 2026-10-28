import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

test.describe('plan and tracker', () => {
  test('onboarding builds a plan, dashboard and tracker reflect it', async ({ page }) => {
    await ready(page, '/plan/');
    await expect(page.getByText(/don't have a plan yet/i)).toBeVisible();
    await page.getByRole('link', { name: /build my plan/i }).click();
    await expect(page).toHaveURL(/\/start\/$/);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);

    // Step 1: about you
    await page.getByRole('radio', { name: 'Male', exact: true }).check();
    await page.getByLabel('Age', { exact: true }).fill('32');
    await page.getByLabel('Height', { exact: true }).fill('180');
    await page.getByLabel('Weight', { exact: true }).fill('92');
    await page.getByLabel('Typical activity').selectOption('light');
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2: goal
    await page.getByRole('radio', { name: 'Lose fat' }).check();
    await page.getByLabel('Goal weight', { exact: true }).fill('82');
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 3: plan preview
    await expect(page.getByText('Eat per day')).toBeVisible();
    await page.getByRole('button', { name: /start my plan/i }).click();

    // Dashboard
    await expect(page).toHaveURL(/\/plan\/$/);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(page.getByText(/to go/)).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByText(/Logged .* today/)).toBeVisible();
    await expect(page.getByText(/more days of data needed/)).toBeVisible();

    // Header CTA now shows the calorie target (inside the menu on small screens)
    if ((page.viewportSize()?.width ?? 1280) < 768)
      await page.getByRole('button', { name: /open menu/i }).click();
    await expect(page.getByRole('link', { name: /open my plan/i }).first()).toContainText('kcal');

    // Tracker shows the entry and accepts another
    await ready(page, '/track/');
    await expect(page.getByText('Trend weight')).toBeVisible();
    await page.locator('#tr-date').fill('2026-01-02');
    await page.getByLabel('Weight', { exact: true }).fill('91.5');
    await page.getByRole('button', { name: /save entry/i }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await expect(page.getByRole('heading', { name: 'Weekly averages' })).toBeVisible();
  });

  test('settings exports a backup and share link round-trips', async ({ page, context }) => {
    await ready(page, '/settings/');
    await expect(page.getByText(/No active plan/)).toBeVisible();
    await page.getByLabel('Weight', { exact: true }).fill('70');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export backup/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/ethereal-backup-.*\.json/);

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /share plan/i }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/start\/#import=/);

    // A fresh profile importing the link sees the shared weight
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(link);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(page.getByText(/Plan imported from your link/)).toBeVisible();
    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('70');
  });
});
