import { expect, test } from '@playwright/test';

test.describe('today plan', () => {
  test.use({ timezoneId: 'Asia/Kuwait' });

  test('shows what to do now, ticks it off, and opens the right meal sheet', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-01T13:50:00+03:00'));
    await page.addInitScript(() => {
      localStorage.setItem('ethereal:tour:v1', '1');
      localStorage.setItem(
        'ethereal:life:v1',
        JSON.stringify({
          name: 'Ali',
          goals: ['get-stronger'],
          wake: '07:00',
          sleep: '23:30',
          meals: { breakfast: '08:00', lunch: '14:00', dinner: '20:00' },
          ready: true,
        }),
      );
    });
    await page.goto('/today/');
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Good afternoon, Ali' })).toBeVisible();
    const now = page.getByRole('region', { name: "What's next" });
    await expect(now.getByRole('heading', { name: 'Lunch' })).toBeVisible();
    await expect(now).toContainText(/in 10 min/i);

    // Catch-up lists what slipped past this morning (breakfast); ticking it clears the list.
    await page.getByRole('button', { name: /catch me up/i }).click();
    await page.getByRole('button', { name: 'Breakfast: mark done' }).click();
    await expect(page.getByRole('button', { name: 'Breakfast: done' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /catch me up/i })).toHaveCount(0);
    await expect(page.getByRole('group', { name: /Your day: 1 of \d+ done/ })).toBeVisible();

    // The day dial: tap dinner's marker, mark it done from the centre.
    const dial = page.getByRole('group', { name: /Your day: \d+ of \d+ done/ });
    await dial.getByRole('button', { name: /Dinner$/ }).click();
    await page.getByRole('button', { name: 'Mark done', exact: true }).click();
    await expect(dial.getByRole('button', { name: /Dinner, done$/ })).toBeVisible();

    // Log lunch from the Now card: the diary's sheet opens on Lunch.
    await now.getByRole('button', { name: 'Log lunch' }).click();
    const sheet = page.getByRole('dialog').filter({ hasText: /lunch/i });
    await expect(sheet).toBeVisible();
  });

  test('the whole day lists prayers when they are on', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-01T09:00:00+03:00'));
    await page.addInitScript(() => {
      localStorage.setItem('ethereal:tour:v1', '1');
      localStorage.setItem(
        'ethereal:life:v1',
        JSON.stringify({
          prayer: { on: true, city: 'Kuwait City', lat: 29.3759, lon: 47.9774, method: 'kuwait' },
        }),
      );
    });
    await page.goto('/today/');
    await page.getByRole('button', { name: /see the whole day/i }).click();
    const day = page.locator('.timeline');
    for (const p of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) await expect(day).toContainText(p);
    await expect(day).toContainText('Lights out');

    // The strip under the sky lifts out the next prayer.
    const strip = page.getByRole('list', { name: 'Prayer times today' });
    await expect(strip.locator('[aria-current="time"]')).toContainText('Dhuhr');

    // Swiping a row to the right ticks it off.
    const row = day.locator('li', { hasText: 'Dhuhr' }).first();
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 30, y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 9, y);
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Dhuhr: done' })).toBeVisible();
  });
});
