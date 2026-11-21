import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Fail on serious/critical WCAG 2.1 A/AA violations (UX §12). */
async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const summary = serious.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 5)
        .join('\n  ')}`,
  );
  expect(serious, summary.join('\n\n')).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`design system gallery (${colorScheme} system theme)`, () => {
    test.use({ colorScheme });

    test('renders both theme panels without a11y violations or horizontal scroll', async ({
      page,
    }, info) => {
      await page.goto('/dev/ui');
      await expect(page.getByRole('heading', { name: 'ArchBoard design system' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Light theme' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Dark theme' })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yViolations(page);
      await page.screenshot({
        path: `../docs/reviews/phase-1/gallery-${info.project.name}-${colorScheme}.png`,
        fullPage: false,
      });
    });
  });
}

test('command palette opens with ⌘K / Ctrl+K and is keyboard navigable', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'keyboard shortcut is a desktop path; phones use the visible button');
  await page.goto('/dev/ui');
  // The gallery is a lazy route: wait until it has mounted (and its shortcut listener with it).
  await expect(page.getByRole('heading', { name: 'ArchBoard design system' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  await page.keyboard.type('zoom');
  await expect(dialog.getByRole('option', { name: /Zoom to fit/ })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Zoomed to fit')).toBeVisible();
});

test('dialogs trap focus and close with Escape, returning focus to the trigger', async ({
  page,
}) => {
  await page.goto('/dev/ui');
  const trigger = page
    .getByRole('region', { name: 'Light theme' })
    .getByRole('button', { name: 'Share dialog' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Share "Rate limiter"' });
  await expect(dialog).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('disabled icon buttons explain why on focus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'tooltips on focus are a keyboard path');
  await page.goto('/dev/ui');
  const noteButton = page
    .getByRole('region', { name: 'Light theme' })
    .getByRole('button', { name: 'Add sticky note' });
  await expect(noteButton).toHaveAttribute('aria-disabled', 'true');
  await noteButton.focus();
  await expect(page.getByRole('tooltip').first()).toContainText('Only the presenter can edit');
});

test('theme toggle switches the root theme and persists across reloads', async ({ page }) => {
  await page.goto('/dev/ui');
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).not.toBe(before);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(after);
});
