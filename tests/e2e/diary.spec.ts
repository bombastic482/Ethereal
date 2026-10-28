import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, path: string) {
  // Count-up animations settle instantly under reduced motion, so numbers can be compared.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('ethereal:tour:v1', '1'));
  await page.goto(path);
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
}

test.describe('food diary', () => {
  test('logs a built-in food, edits the portion, and the ring updates', async ({ page }) => {
    await ready(page, '/today/');
    await expect(page.getByText('kcal left')).toBeVisible();
    const eaten = async () =>
      Number(
        (await page.getByRole('img', { name: /of [\d,]+ kcal$/ }).getAttribute('aria-label'))!
          .split(' of ')[0]!
          .replace(/,/g, ''),
      );
    const before = await eaten();

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
    expect(await eaten()).toBeGreaterThan(before);

    // Edit portion inline
    await row.click();
    await page.getByLabel('Portion').fill('236');
    await expect(page.getByRole('region', { name: 'Breakfast' }).getByText('236 g')).toBeVisible();

    // Persisted across reload
    await page.reload();
    await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
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
    await expect(
      page.getByRole('region', { name: 'Dinner' }).getByText('520').first(),
    ).toBeVisible();
  });
});

test.describe('saved meals and sharing', () => {
  test('a logged meal can be saved and re-logged from the Meals tab', async ({ page }) => {
    await ready(page, '/today/');
    page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('My usual breakfast') : d.accept()));
    await page
      .getByRole('region', { name: 'Breakfast' })
      .getByRole('button', { name: 'Add' })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox').fill('oats');
    await dialog.getByRole('button', { name: /^Oats/ }).first().click();
    await dialog.getByRole('button', { name: /^Add \d+ g$/ }).click();
    await page.getByRole('button', { name: /save breakfast as a meal/i }).click();

    await page.getByRole('region', { name: 'Lunch' }).getByRole('button', { name: 'Add' }).click();
    await dialog.getByRole('radio', { name: 'Meals' }).check();
    await expect(dialog.getByText('My usual breakfast')).toBeVisible();
    await dialog.getByRole('radio', { name: 'Double' }).check();
    await dialog.getByRole('button', { name: 'Log' }).click();
    await expect(page.getByRole('region', { name: 'Lunch' }).getByText(/^Oats/)).toBeVisible();
  });

  test('tracker offers a share card once there is a trend', async ({ page }) => {
    await ready(page, '/track/');
    await page.locator('#tr-date').fill('2026-01-01');
    await page.getByLabel('Weight', { exact: true }).fill('90');
    await page.getByRole('button', { name: /save entry/i }).click();
    await page.locator('#tr-date').fill('2026-01-02');
    await page.getByLabel('Weight', { exact: true }).fill('89.6');
    await page.getByRole('button', { name: /save entry/i }).click();
    await page.getByRole('region', { name: 'Share progress' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: /create card/i })).toBeVisible();
  });
});

test.describe('quick entry', () => {
  test('free text is parsed and logged in one tap', async ({ page }) => {
    await ready(page, '/today/');
    const box = page.getByLabel('Type what you ate');
    await expect(box).toBeVisible();
    await box.fill('2 eggs and 150g greek yogurt');
    await page.getByRole('button', { name: /parse/i }).click();
    await expect(page.getByRole('button', { name: /log all/i })).toBeVisible();
    await expect(page.getByText(/2 item/)).toBeVisible();
    await page.getByRole('button', { name: /log all/i }).click();
    await expect(page.getByText(/egg/i).first()).toBeVisible();
    await expect(page.getByText(/yogurt/i).first()).toBeVisible();
  });
});
