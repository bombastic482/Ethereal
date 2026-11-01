import { expect, test } from '@playwright/test';

test.describe('mind and momentum', () => {
  test('a low check-in turns the day gentle and offers a short session and breathing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ethereal:tour:v1', '1');
      localStorage.setItem(
        'ethereal:train:v1',
        JSON.stringify({
          setup: {
            equipment: ['towel'],
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            minutes: 30,
            level: 1,
            easyOnLegs: false,
            startedOn: '2026-01-01',
            rungs: {},
          },
          log: [],
          voice: false,
          sound: true,
          current: null,
        }),
      );
    });
    await page.goto('/today/');
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
    const check = page.getByRole('region', { name: 'How are you, really?' });
    await check.getByRole('button', { name: 'Low' }).click();
    await check
      .locator('fieldset')
      .filter({ hasText: 'Energy' })
      .getByRole('button', { name: 'Empty' })
      .click();
    const card = page.getByRole('region', { name: "Today's check-in" });
    await expect(card).toContainText('A gentle day');
    await expect(card.getByRole('link', { name: '10-minute session' })).toBeVisible();

    await card.getByRole('button', { name: 'Breathe' }).click();
    const breathe = page.getByRole('dialog', { name: 'Breathe' });
    await expect(breathe).toBeVisible();
    await breathe.getByRole('radio', { name: 'Box' }).click();
    await breathe.getByRole('button', { name: 'Begin' }).click();
    await expect(breathe.getByText(/Breathe in|Hold|Breathe out/)).toBeVisible();
    await breathe.getByRole('button', { name: 'Close' }).click();

    // The short session is three moves at two sets.
    await card.getByRole('link', { name: '10-minute session' }).click();
    const player = page.getByRole('dialog', { name: 'Workout' });
    await expect(player).toBeVisible();
    await expect(player.getByRole('listitem')).toHaveCount(2 + 3 + 2);
  });

  test('after days away, Today welcomes you back without catching up', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ethereal:tour:v1', '1');
      const d = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
      localStorage.setItem(
        'ethereal:log:v1',
        JSON.stringify({ entries: [{ date: d, weightKg: 90 }] }),
      );
    });
    await page.goto('/today/');
    const back = page.getByRole('region', { name: 'No catching up needed.' });
    await expect(back).toContainText('6 days off');
    await back.getByRole('button', { name: 'Dismiss' }).click();
    await expect(back).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'No catching up needed.' })).toHaveCount(0);
  });
});
