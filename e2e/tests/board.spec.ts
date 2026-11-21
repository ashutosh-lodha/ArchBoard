import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Journey J1 (UX §3): a first-time visitor builds Load Balancer → Service → Database, connects
 * them, renames one, and finds everything still there after a reload. No sign-in, no docs.
 */

const node = (page: Page, label: string | RegExp) =>
  page.locator('.react-flow__node').filter({ hasText: label });

async function addViaSearch(page: Page, query: string, isDesktop: boolean) {
  if (!isDesktop) await page.getByRole('button', { name: 'Add component' }).click();
  const search = page.getByRole('searchbox', { name: 'Search components' });
  await search.fill(query);
  await search.press('Enter');
}

async function connect(page: Page, from: string, fromSide: string, to: string, toSide: string) {
  const source = node(page, from);
  await source.hover();
  const start = await source.locator(`.react-flow__handle-${fromSide}`).boundingBox();
  const end = await node(page, to).locator(`.react-flow__handle-${toSide}`).boundingBox();
  if (!start || !end) throw new Error('handle not found');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('J1: build, connect, rename, and it survives a reload', async ({ page, isMobile }, info) => {
  const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;
  test.skip(isMobile, 'handle dragging is covered by the desktop and laptop projects');

  await page.goto('/');
  await page.getByRole('link', { name: 'Start a board' }).first().click();
  await expect(page).toHaveURL(/\/b\/local-[a-z0-9]{12}$/);

  // Empty canvas never leaves the user without a hint.
  await expect(page.getByText('Start your design')).toBeVisible();
  await page
    .getByRole('group', { name: 'Start your design' })
    .getByRole('button', { name: 'Load Balancer' })
    .click();
  await expect(node(page, 'Load Balancer 1')).toBeVisible();
  await expect(page.getByText('Start your design')).toHaveCount(0);

  // Aliases work: "postgres" finds SQL Database.
  await addViaSearch(page, 'service', isDesktop);
  await addViaSearch(page, 'postgres', isDesktop);
  await expect(node(page, 'Service 1')).toBeVisible();
  await expect(node(page, 'SQL Database 1')).toBeVisible();

  // Chained placement: each new component lands to the right of the previous one.
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await page.waitForTimeout(300);
  const x = async (label: string) => (await node(page, label).boundingBox())?.x ?? 0;
  expect(await x('Service 1')).toBeGreaterThan(await x('Load Balancer 1'));
  expect(await x('SQL Database 1')).toBeGreaterThan(await x('Service 1'));

  await connect(page, 'Load Balancer 1', 'right', 'Service 1', 'left');
  await connect(page, 'Service 1', 'right', 'SQL Database 1', 'left');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  // Double-click to rename, Enter to confirm.
  await node(page, 'Service 1').dblclick();
  const input = page.getByRole('textbox', { name: 'Component name' });
  await input.fill('URL service');
  await input.press('Enter');
  await expect(node(page, 'URL service')).toBeVisible();

  // Board name is editable inline.
  const title = page.getByRole('textbox', { name: 'Board name' });
  await title.fill('URL shortener');
  await title.press('Enter');

  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.screenshot({ path: `../docs/reviews/phase-2/j1-${info.project.name}.png` });

  await page.reload();
  await expect(node(page, 'URL service')).toBeVisible();
  await expect(node(page, 'SQL Database 1')).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('URL shortener');
});

test('delete is undoable from the keyboard and from the toast', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard path');
  await page.goto('/new');
  await page
    .getByRole('group', { name: 'Start your design' })
    .getByRole('button', { name: 'Service' })
    .click();
  await expect(node(page, 'Service 1')).toBeVisible();

  await node(page, 'Service 1').click();
  // Wait until React Flow has registered the selection before deleting.
  await expect(node(page, 'Service 1')).toHaveClass(/selected/);
  await page.keyboard.press('Delete');
  await expect(node(page, 'Service 1')).toHaveCount(0);
  await expect(page.getByText('Deleted 1 item')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(node(page, 'Service 1')).toBeVisible();

  await node(page, 'Service 1').click();
  // Wait until React Flow has registered the selection before deleting.
  await expect(node(page, 'Service 1')).toHaveClass(/selected/);
  await page.keyboard.press('Delete');
  // The visible (front) toast, i.e. the one for the delete that just happened.
  await page
    .locator('[data-sonner-toast][data-front="true"]')
    .getByRole('button', { name: 'Undo' })
    .click();
  await expect(node(page, 'Service 1')).toBeVisible();
});

test('drag a component from the panel onto the canvas', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'the panel is a drawer on smaller screens');
  await page.goto('/new');
  const tile = page
    .getByRole('complementary', { name: 'Components' })
    .getByRole('button', { name: 'Cache', exact: true });
  await tile.dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: 200, y: 150 } });
  await expect(node(page, 'Cache 1')).toBeVisible();
});

test('phone and tablet: add from the drawer with a tap', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'desktop has a docked panel');
  await page.goto('/new');
  await page.getByRole('button', { name: 'Add component' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a component' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Queue', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(node(page, 'Queue 1')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('board chrome has no serious accessibility violations', async ({ page }) => {
  await page.goto('/new');
  await expect(page.getByText('Start your design')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The canvas itself is covered by the outline view (planned); audit the chrome around it.
    .exclude('.react-flow__renderer')
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});
