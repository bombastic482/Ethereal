import { expect, test } from '@playwright/test';

const ready = async (page: import('@playwright/test').Page, path: string) => {
  await page.addInitScript(() => localStorage.setItem('ethereal:tour:v1', '1'));
  await page.goto(path);
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
};

test.describe('health and family food', () => {
  test('rates a symptom, adds a lab result and prepares a doctor summary', async ({ page }) => {
    await ready(page, '/you/health/');
    await page.getByRole('button', { name: /^Leg pain/ }).click();
    await page.getByLabel('Leg pain').fill('6');
    await page.getByLabel('Note').fill('worse after stairs');
    await page.getByRole('button', { name: /save for today/i }).click();
    await expect(page.getByRole('button', { name: /^Leg pain 6/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('img', { name: /Leg pain: 1 of the last 28 days/ })).toBeVisible();

    await page.getByLabel('Test').selectOption('Vitamin D');
    await page.getByLabel(/Value in/).fill('38');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Below range')).toBeVisible();

    await page.getByRole('button', { name: 'Prepare a summary' }).last().click();
    const sheet = page.getByRole('dialog', { name: /Health summary/ });
    await expect(sheet).toContainText('Leg pain');
    await expect(sheet).toContainText('worse after stairs');
    await expect(sheet).toContainText('Vitamin D: 38');
  });

  test('logs a family plate by hand, and warns about foods on the avoid list', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('ethereal:life:v1', JSON.stringify({ avoid: ['Tuna'] })),
    );
    await ready(page, '/today/');
    await page.getByRole('button', { name: /^Add$/ }).first().click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('radio', { name: 'By hand' }).check({ force: true });
    await sheet.getByRole('button', { name: /half a palm more/i }).click();
    await sheet.getByRole('button', { name: /half a palm more/i }).click();
    await sheet
      .getByRole('button', { name: /half a fist more/i })
      .first()
      .click();
    await sheet
      .getByRole('button', { name: /half a fist more/i })
      .first()
      .click();
    await sheet.getByRole('button', { name: /log the plate/i }).click();
    await expect(page.getByRole('region', { name: 'Breakfast' })).toContainText('Chicken, 1 palm');
    await expect(page.getByRole('region', { name: 'Breakfast' })).toContainText('Rice, 1 fist');

    await page.getByRole('button', { name: /^Add$/ }).first().click();
    await page.getByRole('dialog').locator('input[type="search"]').fill('tuna');
    await expect(page.getByText(/On your avoid list: Tuna/).first()).toBeVisible();
    await page.getByRole('dialog').locator('input[type="search"]').fill('machboos');
    await expect(page.getByRole('button', { name: /Machboos \(majboos\), chicken/ })).toBeVisible();
  });
});
