import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, path: string) {
  await page.addInitScript(() => localStorage.setItem('ethereal:tour:v1', '1'));
  await page.goto(path);
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
}

test.describe('training', () => {
  test('sets up a plan, runs part of a session, resumes it and logs it to the diary', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page, '/train/');
    await page.getByRole('button', { name: /A sturdy chair/ }).click();
    await page.getByRole('button', { name: /build my plan/i }).click();
    await expect(page.getByRole('heading', { name: /Session A/ }).first()).toBeVisible();

    await page.getByRole('button', { name: /start workout|train anyway/i }).click();
    const player = page.getByRole('dialog', { name: 'Workout' });
    await expect(player).toBeVisible();
    await player.getByRole('button', { name: /^start$/i }).click();

    // Skip the two warm-up moves, then log the first working set.
    for (let i = 0; i < 2; i++) {
      await expect(player.getByText(/Warm-up \d of 2/)).toBeVisible();
      await player
        .getByRole('button', { name: /skip|done/i })
        .last()
        .click();
    }
    await expect(player.getByText(/Exercise 1 of \d · Set 1 of 2/)).toBeVisible();
    await player.getByRole('button', { name: 'One more rep' }).click();
    await player.getByRole('button', { name: /^done, \d+ reps$/i }).click();
    await expect(player.getByText('Up next')).toBeVisible();
    await expect(player.getByRole('timer')).toBeVisible();

    // Leave and come back: progress is kept.
    await player.getByRole('button', { name: 'Leave workout' }).click();
    await page.getByRole('button', { name: /pause and come back later/i }).click();
    await expect(player).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: /pick up where you left off/i })).toBeVisible();
    await page.getByRole('button', { name: /^resume$/i }).click();
    await player.getByRole('button', { name: /^resume$/i }).click();
    await expect(player.getByText('Up next')).toBeVisible();

    // Finish early and save.
    await player.getByRole('button', { name: 'Leave workout' }).click();
    await page.getByRole('button', { name: /finish now and save/i }).click();
    const done = page.getByRole('dialog', { name: /session done/i });
    await expect(done).toBeVisible();
    await done.getByRole('button', { name: 'About right' }).click();
    await done.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Done for today' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent sessions' })).toBeVisible();

    await ready(page, '/today/');
    await expect(page.getByText(/Bodyweight workout/).first()).toBeVisible();
  });

  test('exercise library filters, and each exercise has a page with a demo', async ({ page }) => {
    await ready(page, '/train/exercises/');
    const cards = page.getByRole('main').getByRole('listitem');
    const all = await cards.count();
    expect(all).toBeGreaterThan(30);
    await page.getByRole('button', { name: 'Pull', exact: true }).click();
    await expect.poll(() => cards.count()).toBeLessThan(all);
    await page.getByRole('link', { name: /Towel row/ }).click();
    await expect(page).toHaveURL(/\/train\/exercises\/towel-row\/$/);
    await expect(page.locator('h1')).toHaveText('Towel row');
    await expect(page.getByRole('img', { name: /animated demonstration/ })).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    expect(ld).toContain('"HowTo"');
  });
});

test('the profile saves as you type and shows prayer times for a city', async ({ page }) => {
  await ready(page, '/you/');
  await page.getByLabel('What should we call you?').fill('Ali');
  await page.getByRole('button', { name: /Get stronger/ }).click();
  await page.getByRole('button', { name: 'Knee pain' }).click();
  await page.getByLabel('Show prayer times in my day').check();
  await page.getByLabel('City').selectOption('Kuwait City');
  await expect(page.getByLabel('Calculation method')).toHaveValue('kuwait');
  await expect(page.getByRole('list', { name: "Today's prayer times" })).toContainText('Maghrib');
  await page.reload();
  await expect(page.getByLabel('What should we call you?')).toHaveValue('Ali');
  await expect(page.getByRole('button', { name: 'Knee pain' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('the old plan page forwards to Progress, and its planner link to Eat', async ({ page }) => {
  await page.goto('/plan/');
  await expect(page).toHaveURL(/\/progress\/$/);
  await page.goto('/plan/#dayplan-h');
  await expect(page).toHaveURL(/\/eat\/#dayplan-h$/);
});
