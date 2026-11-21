import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Every route must render without hitting an error boundary. (This test exists because the
 * home page crashed in Phase 1 while the gallery, the only page under test, was fine.)
 */
const pages = [
  { path: '/', heading: /Whiteboard system design/ },
  { path: '/this-page-does-not-exist', heading: 'Page not found' },
] as const;

for (const { path, heading } of pages) {
  test(`${path} renders without errors or a11y violations`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText('Something went wrong')).toHaveCount(0);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious.map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('home page "Start a board" opens a fresh board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /design system/i })).toHaveCount(0);
  await page.getByRole('link', { name: 'Start a board' }).click();
  await expect(page).toHaveURL(/\/b\/local-[a-z0-9]{12}$/);
  await expect(page.getByText('Start your design')).toBeVisible();
});
