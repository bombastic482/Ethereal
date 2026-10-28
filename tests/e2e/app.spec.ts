import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, path: string) {
  await page.addInitScript(() => localStorage.setItem('ethereal:tour:v1', '1'));
  await page.goto(path);
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
}

test.describe('plan and tracker', () => {
  test('onboarding builds a plan, dashboard and tracker reflect it', async ({ page }) => {
    await ready(page, '/plan/');
    await expect(page.getByText(/don't have a plan yet/i)).toBeVisible();
    await page.getByRole('link', { name: /build my plan/i }).click();
    await expect(page).toHaveURL(/\/start\/$/);
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);

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
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
    await expect(page.getByText(/to go/)).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByText(/Logged .* today/)).toBeVisible();
    await expect(page.getByText(/more days of data needed/)).toBeVisible();

    // Header CTA now shows the calorie target (inside the menu on small screens)
    if ((page.viewportSize()?.width ?? 1280) < 768)
      await page.getByRole('button', { name: /open menu/i }).click();
    await expect(page.getByRole('link', { name: /kcal (left|over)/i }).first()).toBeVisible();

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
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
    await expect(page.getByText(/Plan imported from your link/)).toBeVisible();
    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('70');
  });
});

test.describe('day planner', () => {
  test('plans four recipes on target, swaps a slot, logs the day and copies a list', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
    await ready(page, '/plan/');
    const planner = page.getByRole('region', { name: /plan a day that hits your numbers/i });
    await planner.scrollIntoViewIfNeeded();
    await expect(planner.getByRole('heading', { level: 2 })).toBeVisible({ timeout: 15_000 });
    const items = planner.getByRole('listitem');
    await expect(items).toHaveCount(4);
    const totals = planner.getByRole('status').first();
    await expect(totals).toContainText(/vs target/);
    await expect(totals).toContainText(/target met/);

    // Swap lunch; the other three stay.
    const names = async () =>
      Promise.all((await items.all()).map((li) => li.getByRole('link').textContent()));
    const before = await names();
    await planner.getByRole('button', { name: 'Another lunch' }).click();
    const after = await names();
    expect(after[1]).not.toBe(before[1]);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);

    // No snack → three slots.
    await planner.getByRole('button', { name: 'No snack' }).click();
    await expect(items).toHaveCount(3);

    await planner.getByRole('button', { name: 'Copy shopping list' }).click();
    await expect(planner.getByRole('status').last()).toContainText(/Shopping list/);

    // Week mode: seven dated days, each loggable, with a merged list.
    await planner.getByRole('radio', { name: 'Week' }).check();
    const weekRows = planner.getByRole('button', { name: /^Log (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/ });
    await expect(weekRows).toHaveCount(7);
    await expect(planner.getByRole('list', { name: 'Planned week' })).toContainText(/Breakfast:/);
    await planner.getByRole('button', { name: 'Copy week shopping list' }).click();
    await expect(planner.getByRole('status').last()).toContainText(/Shopping list for 7 days/);
    await planner.getByRole('radio', { name: 'One day' }).check();

    await planner.getByRole('button', { name: 'Log the day to Today' }).click();
    await expect(planner.getByRole('status').last()).toContainText(/Logged \d+ items to today/);
    await ready(page, '/today/');
    await expect(
      page
        .getByRole('region', { name: 'Breakfast' })
        .getByRole('button', { name: /^Delete / })
        .first(),
    ).toBeVisible();
  });
});

test.describe('weekly review', () => {
  test('shows the week, a twelve-week consistency grid and saves a reflection', async ({
    page,
  }) => {
    // Log something today so the grid and the week have data.
    await ready(page, '/today/');
    await page.getByRole('region', { name: 'Lunch' }).getByRole('button', { name: 'Add' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox').fill('banana');
    await dialog
      .getByRole('button', { name: /^Banana/ })
      .first()
      .click();
    await dialog.getByRole('button', { name: /^Add \d+ g$/ }).click();

    await ready(page, '/review/');
    const grid = page.getByRole('region', { name: 'Consistency' });
    await expect(grid).toBeVisible();
    await expect(grid.getByText('Days logged')).toBeVisible();
    await expect(grid.getByText(/^1 \/ 84$/)).toBeVisible();
    await expect(grid.getByRole('img', { name: /meals logged per day/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /plan next week's meals/i })).toBeVisible();

    const reflection = page.getByRole('region', { name: 'Reflection' });
    await reflection.getByRole('textbox').first().fill('Walked every day');
    await reflection.getByRole('button', { name: /save/i }).click();
    await ready(page, '/review/');
    await expect(
      page.getByRole('region', { name: 'Reflection' }).getByRole('textbox').first(),
    ).toHaveValue('Walked every day');
  });
});

test.describe('switching from another app', () => {
  test('imports a MyFitnessPal-style CSV after a preview', async ({ page }) => {
    await ready(page, '/settings/');
    const csv = [
      'Date,Meal,Calories,Fat (g),Saturated Fat,Polyunsaturated Fat,Carbohydrates (g),Fiber,Sugar,Protein (g)',
      '2026-01-05,Breakfast,412,9,3,1,48,6,12,30',
      '2026-01-05,Dinner,640,22,6,2,60,7,6,45',
      '2026-01-06,Lunch,586,18,5,1,55,8,9,42',
    ].join('\n');
    await page
      .getByRole('region', { name: 'Switch from another app' })
      .locator('input[type=file]')
      .setInputFiles({ name: 'mfp.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    const preview = page.getByRole('group', { name: 'Import preview' });
    await expect(preview).toContainText(/MyFitnessPal/);
    await expect(preview).toContainText(/3 food entries/);
    await preview.getByRole('button', { name: /Import 3 rows/ }).click();
    await expect(page.getByText(/Imported 3 food entries and 0 weigh-ins/)).toBeVisible();
    await expect(page.getByText(/3 food entries stored on this device/)).toBeVisible();
  });
});

test.describe('goal reached', () => {
  test('offers a one-tap switch to maintenance once the trend crosses the goal', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ethereal:tour:v1', '1');
      const today = new Date();
      const iso = (d: Date) =>
        new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const entries = [];
      for (let i = 20; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        entries.push({ date: iso(d), weightKg: 80.5 - (20 - i) * 0.1 }); // ends ~78.5
      }
      localStorage.setItem('ethereal:log:v1', JSON.stringify({ entries }));
      localStorage.setItem(
        'ethereal:plan:v1',
        JSON.stringify({
          active: true,
          goal: 'lose',
          goalWeightKg: 80,
          rateKgPerWeek: 0.5,
          formula: 'mifflin',
          macroPreset: 'high-protein',
          startedOn: iso(new Date(today.getTime() - 20 * 86400000)),
          startWeightKg: 85,
          calorieOverride: null,
          lastAdjustedOn: null,
        }),
      );
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/plan/');
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
    const card = page.getByRole('region', { name: 'Goal reached' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Switch to maintenance' }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Holding steady' })).toBeVisible();
  });
});
