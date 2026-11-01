import { expect, test } from '@playwright/test';

test.describe('body composition', () => {
  test('a guided tape session gives a Navy estimate and a physique target', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'ethereal:profile:v1',
        JSON.stringify({
          units: 'metric',
          sex: 'male',
          age: 32,
          heightCm: 178,
          weightKg: 92,
          activity: 'light',
        }),
      );
    });
    await page.goto('/progress/body/');
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
    await page.getByRole('button', { name: 'Measure now' }).click();

    await expect(page.getByRole('heading', { name: 'Neck' })).toBeVisible();
    await page.getByLabel('Neck (cm)').fill('40');
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByRole('heading', { name: 'Waist at the navel' })).toBeVisible();
    await page.getByLabel('Waist at the navel (cm)').fill('103');
    await page.getByRole('button', { name: /next/i }).click();
    // The rest are optional: skip them all.
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /skip this one/i }).click();

    const result = page.getByRole('status').filter({ hasText: 'Saved today’s measurements' });
    await expect(result).toContainText(/About (2[6-9]|3[0-2])\.\d% body fat/);
    await expect(page.getByRole('heading', { name: 'What your weight is made of' })).toBeVisible();

    await page.getByRole('radio', { name: /Fit · 17%/ }).check({ force: true });
    await expect(page.getByText(/to go$/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('cell', { name: '103' })).toBeVisible();
  });

  test('progress shows milestones reached and the next ones', async ({ page }) => {
    await page.addInitScript(() => {
      const d = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
      localStorage.setItem(
        'ethereal:train:v1',
        JSON.stringify({
          setup: null,
          log: [1, 0].map((n, i) => ({
            id: String(i),
            date: d(n),
            session: 'A',
            week: 1,
            minutes: 25,
            kcal: 120,
            sets: [{ exerciseId: 'knee-push-up', value: 12 }],
          })),
          voice: false,
          sound: true,
          current: null,
        }),
      );
    });
    await page.goto('/progress/');
    const ms = page.getByRole('region', { name: 'Milestones' });
    await ms.scrollIntoViewIfNeeded();
    await expect(ms).toContainText('First workout');
    await expect(ms).toContainText('Ten workouts');
    // The fresh one is celebrated once.
    await expect(page.getByRole('status').filter({ hasText: 'Milestone' })).toBeVisible();
    await page.reload();
    await ms.scrollIntoViewIfNeeded();
    await expect(ms).toContainText('First workout');
    await expect(page.getByRole('status').filter({ hasText: 'Milestone' })).toHaveCount(0);
  });
});
