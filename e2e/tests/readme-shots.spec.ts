import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/** README screenshots. Run with `SHOTS=1 pnpm test:e2e readme-shots --project=desktop`. */
const here = dirname(fileURLToPath(import.meta.url));
const demo = JSON.parse(readFileSync(join(here, '../fixtures/demo-url-shortener.json'), 'utf8'));
const out = join(here, '../../docs/images');

test.skip(!process.env.SHOTS, 'set SHOTS=1 to regenerate README screenshots');
test.use({ viewport: { width: 1440, height: 860 }, colorScheme: 'light' });

async function demoBoard(page: Page) {
  await page.addInitScript(() => localStorage.setItem('archboard.theme', 'light'));
  await page.goto('/new');
  await expect(page.getByText('Start your design')).toBeVisible();
  await page.evaluate(
    (json) =>
      (window as unknown as { __archboardLoad: (j: unknown) => void }).__archboardLoad(json),
    demo,
  );
  await expect(page.locator('.react-flow__node')).toHaveCount(demo.nodes.length);
}
const node = (page: Page, label: string) =>
  page.locator('.react-flow__node').filter({ hasText: label });
const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82 });

test('landing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('archboard.theme', 'light'));
  await page.goto('/');
  await page.waitForTimeout(500);
  await shot(page, 'landing');
});

test('editor with properties', async ({ page }) => {
  await demoBoard(page);
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await node(page, 'Redis cache').click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  await shot(page, 'editor');
});

test('component search with aliases', async ({ page }) => {
  await demoBoard(page);
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await page.getByRole('searchbox', { name: 'Search components' }).fill('lb');
  await page.waitForTimeout(400);
  await shot(page, 'search');
});

test('capacity calculator', async ({ page }) => {
  await demoBoard(page);
  await page.getByRole('button', { name: 'Hide components panel' }).click();
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await node(page, 'URL service').click();
  await page.keyboard.press('e');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  await shot(page, 'capacity');
});

test('groups and connection properties', async ({ page }) => {
  await demoBoard(page);
  await page.getByRole('button', { name: 'Hide components panel' }).click();
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await page.locator('.react-flow__edge').filter({ hasText: 'Pub/Sub' }).click({ force: true });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  await shot(page, 'connections');
});

test('pen, shapes and text', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('archboard.theme', 'light'));
  await page.goto('/new');
  await expect(page.getByText('Start your design')).toBeVisible();
  await page.getByRole('button', { name: 'Hide components panel' }).click();
  const area = async () => (await page.locator('.react-flow__pane').boundingBox())!;
  // Shapes with text
  for (const [key, x, label] of [
    ['r', 140, 'Client request'],
    ['o', 460, 'Cache hit?'],
  ] as const) {
    await page.keyboard.press(key);
    const a = await area();
    await page.mouse.move(a.x + x, a.y + 160);
    await page.mouse.down();
    await page.mouse.move(a.x + x + 200, a.y + 270, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByRole('textbox', { name: 'Shape text' })).toBeFocused();
    await page.keyboard.type(label);
    await page.keyboard.press('ControlOrMeta+Enter');
  }
  // Pen arrow between them
  await page.keyboard.press('d');
  const a = await area();
  await page.mouse.move(a.x + 350, a.y + 215);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++)
    await page.mouse.move(a.x + 350 + i * 5, a.y + 215 - Math.sin(i / 3) * 12);
  await page.mouse.up();
  await page.mouse.move(a.x + 440, a.y + 205);
  await page.mouse.down();
  await page.mouse.move(a.x + 452, a.y + 215, { steps: 4 });
  await page.mouse.move(a.x + 440, a.y + 226, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  // A text box
  await page.keyboard.press('t');
  const b = await area();
  await page.mouse.click(b.x + 160, b.y + 340);
  await page.waitForTimeout(300);
  await page.keyboard.type('Sketch freely next to the architecture');
  await page.keyboard.press('ControlOrMeta+Enter');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  await shot(page, 'drawing');
});

test('editor dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('archboard.theme', 'dark'));
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
  await page.waitForTimeout(400);
  await shot(page, 'editor-dark');
});

test('phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demoBoard(page);
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'phone');
});
