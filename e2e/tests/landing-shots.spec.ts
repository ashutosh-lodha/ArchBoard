import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Generates the real product screenshots used on the landing page and as the social preview
 * image. Not part of the normal suite: run with `SHOTS=1 pnpm test:e2e landing-shots --project=desktop`.
 */
const here = dirname(fileURLToPath(import.meta.url));
const demo = JSON.parse(readFileSync(join(here, '../fixtures/demo-url-shortener.json'), 'utf8'));
const out = join(here, '../../apps/web/public/landing');

test.skip(!process.env.SHOTS, 'set SHOTS=1 to regenerate landing screenshots');

/** Tests run without Clerk; show the save status a signed-in person sees in production. */
async function showAccountSaveStatus(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue === 'Saved on this device') n.nodeValue = 'Saved to your account';
    }
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`board screenshot (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((t) => localStorage.setItem('archboard.theme', t), theme);
    await page.goto('/new');
    await expect(page.getByText('Start your design')).toBeVisible();
    await page.evaluate(
      (json) =>
        (window as unknown as { __archboardLoad: (j: unknown) => void }).__archboardLoad(json),
      demo,
    );
    await expect(page.locator('.react-flow__node')).toHaveCount(demo.nodes.length);
    await page.getByRole('button', { name: 'Hide components panel' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Zoom to fit' }).click();
    await page.locator('.react-flow__node').filter({ hasText: 'URL service' }).click();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(600);
    await showAccountSaveStatus(page);
    await page.screenshot({ path: join(out, `board-${theme}.jpg`), type: 'jpeg', quality: 82 });
  });
}

test('social preview image (1200×630)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('archboard.theme', 'light'));
  await page.goto('/new');
  await expect(page.getByText('Start your design')).toBeVisible();
  await page.evaluate(
    (json) =>
      (window as unknown as { __archboardLoad: (j: unknown) => void }).__archboardLoad(json),
    demo,
  );
  await page.getByRole('button', { name: 'Hide components panel' }).click();
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  await showAccountSaveStatus(page);
  await page.screenshot({ path: join(out, 'og.jpg'), type: 'jpeg', quality: 85 });
});
