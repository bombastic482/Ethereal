import { expect, test, type Page } from '@playwright/test';

/** Astro removes the `ssr` attribute from an island once it has hydrated. */
async function ready(page: Page, path: string) {
  await page.addInitScript(() => localStorage.setItem('ethereal:tour:v1', '1'));
  await page.goto(path);
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
}

const TOOLS = [
  'calories',
  'timeline',
  'macros',
  'bmi',
  'body-fat',
  'protein',
  'ideal-weight',
  'water',
];

test.describe('site', () => {
  test('home page renders and links to tools', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Ethereal/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Weight loss');
    await page.getByRole('link', { name: /build my plan/i }).click();
    await expect(page).toHaveURL(/\/start\/$/);
  });

  test('every tool page has one H1, a canonical and JSON-LD', async ({ page }) => {
    for (const slug of TOOLS) {
      await page.goto(`/tools/${slug}/`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
        'href',
        new RegExp(`/tools/${slug}/$`),
      );
      const ld = await page.locator('script[type="application/ld+json"]').textContent();
      expect(ld).toContain('"WebApplication"');
      expect(ld).toContain('"FAQPage"');
    }
  });

  test('theme toggle persists', async ({ page }) => {
    await page.goto('/');
    await page.emulateMedia({ colorScheme: 'light' });
    const html = page.locator('html');
    await page.getByRole('button', { name: /toggle dark mode/i }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('404 page is served with noindex', async ({ page }) => {
    const res = await page.goto('/does-not-exist/');
    expect(res?.status()).toBe(404);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  });
});

test.describe('calculators', () => {
  test('BMI reacts to input and shows category', async ({ page }) => {
    await ready(page, '/tools/bmi/');
    await page.getByLabel('Height', { exact: true }).fill('175');
    await page.getByLabel('Weight', { exact: true }).fill('70');
    await expect(page.getByText('22.9', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Healthy weight', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Weight', { exact: true }).fill('95');
    await expect(page.getByText('31', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Obesity class I', { exact: true }).first()).toBeVisible();
  });

  test('calorie calculator computes TDEE and target', async ({ page }) => {
    await ready(page, '/tools/calories/');
    await page.getByRole('radio', { name: 'Male', exact: true }).check();
    await page.getByLabel('Age', { exact: true }).fill('30');
    await page.getByLabel('Height', { exact: true }).fill('180');
    await page.getByLabel('Weight', { exact: true }).fill('80');
    await page.getByLabel('Activity level', { exact: true }).selectOption('moderate');
    await expect(page.getByText('2,759').first()).toBeVisible(); // TDEE
    await expect(page.getByText('2,209').first()).toBeVisible(); // 0.5 kg/week target
  });

  test('profile is shared between tools', async ({ page }) => {
    await ready(page, '/tools/bmi/');
    await page.getByLabel('Height', { exact: true }).fill('190');
    await page.getByLabel('Weight', { exact: true }).fill('99');
    await ready(page, '/tools/calories/');
    await expect(page.getByLabel('Height', { exact: true })).toHaveValue('190');
    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('99');
  });

  test('imperial units convert height and weight', async ({ page }) => {
    await ready(page, '/tools/bmi/');
    await page.getByLabel('Height', { exact: true }).fill('177.8');
    await page.getByLabel('Weight', { exact: true }).fill('80');
    await page.getByRole('radio', { name: /imperial/i }).check();
    await expect(page.locator('#bmi-ft')).toHaveValue('5');
    await expect(page.locator('#bmi-in')).toHaveValue('10');
    await expect(page.locator('#bmi-weight')).toHaveValue('176.4');
  });

  test('timeline renders a chart and a goal date', async ({ page }) => {
    await ready(page, '/tools/timeline/');
    await page.getByRole('radio', { name: 'Male', exact: true }).check();
    await page.getByLabel('Age', { exact: true }).fill('30');
    await page.getByLabel('Height', { exact: true }).fill('180');
    await page.getByLabel('Weight', { exact: true }).fill('90');
    await page.getByLabel('Goal weight', { exact: true }).fill('80');
    await expect(page.getByText(/You reach your goal in/i)).toBeVisible();
    await expect(page.locator('svg[aria-label="Projected weight over time"]')).toBeVisible();
  });

  test('macro calculator sums to the calorie target', async ({ page }) => {
    await ready(page, '/tools/macros/');
    await page.getByRole('radio', { name: /I know my target/i }).check();
    await page.getByLabel('Calories per day', { exact: true }).fill('2000');
    await page.getByLabel('Weight', { exact: true }).fill('80');
    await page.getByLabel('Preset', { exact: true }).selectOption('balanced');
    const results = page.getByRole('region', { name: 'Results' });
    await expect(results.getByText(/^150\s*g$/).first()).toBeVisible(); // protein g
    await expect(results.getByText(/^200\s*g$/).first()).toBeVisible(); // carbs g
    await expect(results.getByText(/^67\s*g$/).first()).toBeVisible(); // fat g
  });
});

test('first-run tour shows once on Today and can be completed', async ({ page }) => {
  await page.goto('/today/');
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0, {
    timeout: 15000,
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /log in seconds/i })).toBeVisible();
  await dialog.getByRole('button', { name: /next/i }).click();
  await expect(dialog.getByRole('heading', { name: /never wonder what to cook/i })).toBeVisible();
  await dialog.getByRole('button', { name: /next/i }).click();
  await dialog.getByRole('button', { name: /next/i }).click();
  await expect(dialog.getByRole('link', { name: /build my plan/i })).toBeVisible();
  await dialog.getByRole('button', { name: /skip tour/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('command palette jumps to pages and logs a food', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ethereal:tour:v1', '1'));
  await page.goto('/plan/');
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
  const dialog = page.getByRole('dialog', { name: /quick launcher/i });
  // The island's hydration marker clears a tick before its key listener mounts, so retry the shortcut.
  await expect(async () => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await dialog.getByRole('combobox').fill('plateau');
  await expect(dialog.getByRole('option', { name: /plateaus/i })).toBeVisible();
  await dialog.getByRole('combobox').fill('banana');
  await expect(dialog.getByRole('option').first()).toContainText(/Log Banana/i);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/today\/$/);
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
  await expect(page.getByText(/^Banana/).first()).toBeVisible();
});

test('recipes page filters by diet and time without a framework', async ({ page }) => {
  await page.goto('/recipes/');
  const filters = page.getByRole('group', { name: 'Filter recipes' });
  await expect(filters).toContainText(/68 of 68 recipes/);
  await filters.getByRole('button', { name: 'Vegan' }).click();
  await expect(filters.locator('[data-count]')).not.toHaveText(/68 of 68/);
  await expect(filters.locator('[data-count]')).toHaveText(/\d+ of 68 recipes/);
  const visible = page.locator('li[data-diet]:not([hidden])');
  expect(await visible.count()).toBeGreaterThan(8);
  for (const d of await visible.evaluateAll((els) => els.map((e) => e.getAttribute('data-diet'))))
    expect(d).toBe('vegan');
  await filters.getByRole('button', { name: '15 minutes or less' }).click();
  for (const m of await visible.evaluateAll((els) =>
    els.map((e) => Number(e.getAttribute('data-minutes'))),
  ))
    expect(m).toBeLessThanOrEqual(15);
  await filters.getByRole('button', { name: 'Everything' }).click();
  await filters.getByRole('button', { name: '15 minutes or less' }).click();
  await expect(filters).toContainText(/68 of 68 recipes/);
});

test('each recipe has its own page with structured data and a log link', async ({ page }) => {
  await page.goto('/recipes/shakshuka-with-feta/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shakshuka with feta');
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nutrition per serving' })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join(' ')).toContain('"@type":"Recipe"');
  expect(ld.join(' ')).toContain('"recipeIngredient"');
  await expect(
    page.getByRole('link', { name: /Log it to Today: Shakshuka with feta/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /More breakfasts like this/ })).toBeVisible();
  // Serving scaler doubles the ingredient weights.
  const first = page.locator('[data-grams]').first();
  const base = Number(await first.textContent());
  await page.getByRole('group', { name: 'Servings' }).getByRole('button', { name: '2' }).click();
  await expect(first).toHaveText(String(base * 2));
  await expect(page.getByText(/Scaled for 2 servings/)).toBeVisible();
});
