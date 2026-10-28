import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

test.describe('food diary', () => {
  test('logs a built-in food, edits the portion, and the ring updates', async ({ page }) => {
    await ready(page, '/today/');
    await expect(page.getByText('kcal left')).toBeVisible();
    const before = await page
      .getByText(/kcal left/)
      .locator('..')
      .locator('p')
      .first()
      .textContent();

    await page
      .getByRole('region', { name: 'Breakfast' })
      .getByRole('button', { name: 'Add' })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox').fill('banana');
    await dialog
      .getByRole('button', { name: /^Banana/ })
      .first()
      .click();
    await expect(dialog.getByRole('heading', { name: /Banana/ })).toBeVisible();
    await dialog.getByRole('button', { name: /^Add \d+ g$/ }).click();
    await expect(dialog).toHaveCount(0);

    const row = page
      .getByRole('region', { name: 'Breakfast' })
      .getByText(/^Banana/)
      .first();
    await expect(row).toBeVisible();
    const after = await page
      .getByText(/kcal left/)
      .locator('..')
      .locator('p')
      .first()
      .textContent();
    expect(Number(after!.replace(/,/g, ''))).toBeLessThan(Number(before!.replace(/,/g, '')));

    // Edit portion inline
    await row.click();
    await page.getByLabel('Portion').fill('236');
    await expect(page.getByRole('region', { name: 'Breakfast' }).getByText('236 g')).toBeVisible();

    // Persisted across reload
    await page.reload();
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Breakfast' }).getByText(/^Banana/),
    ).toBeVisible();
  });

  test('quick add, exercise and water work', async ({ page }) => {
    await ready(page, '/today/');
    await page.getByRole('region', { name: 'Snacks' }).getByRole('button', { name: 'Add' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Quick add' }).check();
    await dialog.getByLabel('Calories').fill('250');
    await dialog.getByRole('button', { name: /Add 250 kcal/ }).click();
    await expect(page.getByRole('region', { name: 'Snacks' }).getByText('Quick add')).toBeVisible();

    await page
      .getByRole('region', { name: 'Exercise' })
      .getByRole('button', { name: 'Add' })
      .click();
    await page.getByLabel('Minutes').fill('45');
    await page.getByRole('button', { name: /Log 45 min/ }).click();
    await expect(page.getByRole('region', { name: 'Exercise' }).getByText('45 min')).toBeVisible();

    await page.getByRole('button', { name: 'Add a glass' }).click();
    await page.getByRole('button', { name: 'Add a glass' }).click();
    await expect(page.getByText(/2 of \d+ glasses/)).toBeVisible();
  });

  test('custom food is saved and reusable', async ({ page }) => {
    await ready(page, '/today/');
    await page.getByRole('region', { name: 'Dinner' }).getByRole('button', { name: 'Add' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'My foods' }).check();
    await dialog.getByLabel('Name').fill('Lasagne');
    await dialog.getByLabel('Serving').fill('350');
    await dialog.getByLabel('Calories').fill('520');
    await dialog.getByLabel('Protein').fill('28');
    await dialog.getByRole('button', { name: /Save and use/ }).click();
    await expect(dialog.getByRole('heading', { name: 'Lasagne' })).toBeVisible();
    await dialog.getByRole('button', { name: /^Add 350 g$/ }).click();
    await expect(page.getByRole('region', { name: 'Dinner' }).getByText('Lasagne')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Dinner' }).getByText('520')).toBeVisible();
  });
});
