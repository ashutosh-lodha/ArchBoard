import { expect, test, type Page } from '@playwright/test';

/** Groups, properties, drawing tools (pen, shapes, text) and provider icons. Desktop paths. */

const node = (page: Page, label: string | RegExp) =>
  page.locator('.react-flow__node').filter({ hasText: label });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Properties' });

test.beforeEach(async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'desktop editing paths');
  await page.goto('/new');
  await expect(page.getByText('Start your design')).toBeVisible();
  // Below 1280px the properties panel starts closed; open it like a user would.
  const show = page.getByRole('button', { name: 'Show properties panel' });
  if (await show.isVisible()) await show.click();
  await expect(panel(page)).toBeVisible();
});

async function addTwo(page: Page) {
  const hint = page.getByRole('group', { name: 'Start your design' });
  await hint.getByRole('button', { name: 'Service' }).click();
  await expect(node(page, 'Service 1')).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search components' });
  await search.fill('postgres');
  await search.press('Enter');
  await expect(node(page, 'SQL Database 1')).toBeVisible();
  // Narrow canvases (laptop with both panels) may have panned; bring everything into view.
  await page.getByRole('button', { name: 'Zoom to fit' }).click();
  await page.waitForTimeout(300);
}

async function select(page: Page, label: string, add = false) {
  await node(page, label).click(add ? { modifiers: ['Shift'] } : {});
  await expect(node(page, label)).toHaveClass(/selected/);
}

test('group with G and a number key, then ungroup with Shift+G — each one undo step', async ({
  page,
}) => {
  await addTwo(page);
  await select(page, 'Service 1');
  await select(page, 'SQL Database 1', true);
  await expect(panel(page).getByRole('heading', { name: '2 selected' })).toBeVisible();

  await page.keyboard.press('g');
  await expect(page.getByRole('dialog', { name: 'Group selection into' })).toBeVisible();
  await page.keyboard.press('3'); // VPC
  const vpc = page.locator('.react-flow__node-group');
  await expect(vpc).toHaveCount(1);
  await expect(vpc).toContainText('VPC');
  await expect(panel(page).getByRole('heading', { name: 'Group' })).toBeVisible();

  await page.keyboard.press('Shift+G');
  await expect(vpc).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z'); // undo ungroup
  await expect(vpc).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+z'); // undo group
  await expect(vpc).toHaveCount(0);
  await expect(node(page, 'Service 1')).toBeVisible();
});

test('drag a component into a group and back out', async ({ page }) => {
  await addTwo(page);
  await select(page, 'Service 1');
  await panel(page).getByRole('button', { name: 'Boundary' }).click();
  const group = page.locator('.react-flow__node-group');
  await expect(group).toHaveCount(1);

  // Drag the database onto the middle of the group.
  const db = await node(page, 'SQL Database 1').boundingBox();
  const g = await group.boundingBox();
  if (!db || !g) throw new Error('missing boxes');
  await page.mouse.move(db.x + 30, db.y + db.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height - 20, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByText(/Moved into Boundary/)).toBeVisible();
  await select(page, 'SQL Database 1');
  await expect(panel(page).getByRole('heading', { name: 'Inside' })).toBeVisible();

  // Drag it far outside again.
  const db2 = await node(page, 'SQL Database 1').boundingBox();
  if (!db2) throw new Error('missing box');
  await page.mouse.move(db2.x + 30, db2.y + db2.height / 2);
  await page.mouse.down();
  await page.mouse.move(db2.x + 30, db2.y - 300, { steps: 15 });
  await page.mouse.up();
  await select(page, 'SQL Database 1');
  await expect(panel(page).getByRole('heading', { name: 'Inside' })).toHaveCount(0);
});

test('properties: rename, replicas with validation, region; tradeoff hints shown', async ({
  page,
}) => {
  await addTwo(page);
  await select(page, 'Service 1');
  const p = panel(page);
  await expect(p.getByRole('heading', { name: 'Things to consider' })).toBeVisible();

  const label = p.getByRole('textbox', { name: 'Label' });
  await label.fill('URL service');
  await label.press('Enter');
  await expect(node(page, 'URL service')).toBeVisible();

  const replicas = p.getByRole('textbox', { name: 'Replicas' });
  await replicas.fill('0');
  await replicas.press('Enter');
  await expect(p.getByText('Use a whole number from 1 to 10,000.')).toBeVisible();
  await replicas.fill('3');
  await replicas.press('Enter');
  const region = p.getByRole('textbox', { name: 'Region' });
  await region.fill('ap-south-1');
  await region.press('Enter');
  await expect(node(page, 'URL service')).toContainText('×3 · ap-south-1');
});

test('connection properties: label, async style and protocol tag', async ({ page }) => {
  await addTwo(page);
  const source = node(page, 'Service 1');
  await source.hover();
  const a = await source.locator('.react-flow__handle-right').boundingBox();
  const b = await node(page, 'SQL Database 1').locator('.react-flow__handle-left').boundingBox();
  if (!a || !b) throw new Error('handles');
  await page.mouse.move(a.x + 5, a.y + 5);
  await page.mouse.down();
  await page.mouse.move(b.x + 5, b.y + 5, { steps: 10 });
  await page.mouse.up();
  const edge = page.locator('.react-flow__edge');
  await expect(edge).toHaveCount(1);
  await edge.click({ force: true });

  const p = panel(page);
  await expect(p.getByRole('heading', { name: 'Connection' })).toBeVisible();
  const label = p.getByRole('textbox', { name: 'Label' });
  await label.fill('writes');
  await label.press('Enter');
  await p.getByRole('radio', { name: 'Async (dashed)' }).click();
  await p.getByRole('combobox', { name: 'Protocol' }).click();
  await page.getByRole('option', { name: 'gRPC' }).click();
  await expect(page.locator('.react-flow__edge-text')).toHaveText('writes · gRPC');
  await expect(edge).toHaveClass(/ab-edge-async/);
});

test('pen draws strokes and stays active until Esc', async ({ page }) => {
  await page.keyboard.press('d');
  await expect(page.getByRole('toolbar', { name: 'Pen options' })).toBeVisible();
  const area = page.getByRole('application', { name: /Drawing area/ });
  const box = await area.boundingBox();
  if (!box) throw new Error('no area');
  for (const dy of [0, 60]) {
    await page.mouse.move(box.x + 100, box.y + 100 + dy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(box.x + 100 + i * 15, box.y + 100 + dy + Math.sin(i) * 10);
    await page.mouse.up();
  }
  await expect(page.locator('.react-flow__node-drawing')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('toolbar', { name: 'Pen options' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.react-flow__node-drawing')).toHaveCount(2);
});

test('shape tool: drag to draw a diamond, write inside, change fill', async ({ page }) => {
  await page.keyboard.press('r');
  await page
    .getByRole('toolbar', { name: 'Shape options' })
    .getByRole('button', { name: 'Diamond' })
    .click();
  const area = page.getByRole('application', { name: 'Drag to draw a shape' });
  const box = await area.boundingBox();
  if (!box) throw new Error('no area');
  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 220, { steps: 8 });
  await page.mouse.up();
  const shape = page.locator('.react-flow__node-shape');
  await expect(shape).toHaveCount(1);
  await expect(panel(page).getByRole('heading', { name: 'Shape' })).toBeVisible();

  await shape.dblclick();
  const text = page.getByRole('textbox', { name: 'Shape text' });
  await expect(text).toBeFocused();
  await text.fill('Cache hit?');
  await text.press('ControlOrMeta+Enter');
  await expect(shape).toContainText('Cache hit?');
  await panel(page).getByRole('radio', { name: 'yellow' }).click();
  await expect(shape.locator('svg [class*="fill-[#fff4c2]"]')).toHaveCount(1);
});

test('text tool: click to place, the box is focused and typing works', async ({ page }) => {
  await page.keyboard.press('t');
  const area = page.getByRole('application', { name: 'Click to add text' });
  const box = await area.boundingBox();
  if (!box) throw new Error('no area');
  await page.mouse.click(box.x + 150, box.y + 120);
  const input = page.getByRole('textbox', { name: 'Text' });
  await expect(input).toBeFocused();
  await page.keyboard.type('Read path: cache first');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('.react-flow__node-text')).toContainText('Read path: cache first');
});

test('Google Cloud icons are searchable in the GCP tab', async ({ page }) => {
  const components = page.getByRole('complementary', { name: 'Components' });
  await components.getByRole('radio', { name: 'GCP' }).click();
  const search = page.getByRole('searchbox', { name: 'Search components' });
  await search.fill('pubsub');
  const tile = components.getByRole('button', { name: 'Pub/Sub, Google Cloud' });
  await expect(tile).toBeVisible();
  await tile.click();
  await expect(node(page, 'Pub/Sub')).toContainText('gcp');
});

test('pen: the saved stroke matches what was drawn (no snapping on release)', async ({ page }) => {
  await page.keyboard.press('d');
  const ov = page.locator('[aria-label^="Drawing area"]');
  const r = (await ov.boundingBox())!;
  const cx = r.x + 300;
  const cy = r.y + 220;
  await page.mouse.move(cx + 100, cy);
  await page.mouse.down();
  for (let i = 1; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    await page.mouse.move(cx + 100 * Math.cos(a), cy + 60 * Math.sin(a));
  }
  const preview = await ov.locator('svg path').evaluate((el) => {
    const b = el.getBoundingClientRect();
    return [b.x, b.y, b.width, b.height];
  });
  await page.mouse.up();
  const final = await page
    .locator('.react-flow__node-drawing path')
    .nth(1)
    .evaluate((el) => {
      const b = el.getBoundingClientRect();
      return [b.x, b.y, b.width, b.height];
    });
  preview.forEach((v, i) => expect(Math.abs(v - (final[i] ?? 0))).toBeLessThanOrEqual(2));
});

for (const [key, kind, word] of [
  ['r', 'Box', 'Clients'],
  ['o', 'Circle', 'Users'],
] as const) {
  test(`${kind} tool: drag to draw, then type straight away`, async ({ page }) => {
    await page.keyboard.press(key);
    const area = page.getByRole('application', { name: 'Drag to draw a shape' });
    const box = (await area.boundingBox())!;
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 280, box.y + 220, { steps: 8 });
    await page.mouse.up();
    const text = page.getByRole('textbox', { name: 'Shape text' });
    await expect(text).toBeFocused();
    await page.keyboard.type(word);
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.locator('.react-flow__node-shape')).toContainText(word);
  });
}

test('components hold text on the card and can be resized; both survive a reload', async ({
  page,
}) => {
  await page
    .getByRole('group', { name: 'Start your design' })
    .getByRole('button', { name: 'Load Balancer' })
    .click();
  const lb = node(page, 'Load Balancer 1');
  await expect(lb).toHaveClass(/selected/);
  await lb.getByRole('button', { name: '+ Add text' }).click();
  const text = page.getByRole('textbox', { name: 'Component text' });
  await expect(text).toBeFocused();
  await page.keyboard.type('L7, TLS termination');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(lb).toContainText('L7, TLS termination');

  const before = (await lb.boundingBox())!;
  const handle = lb.locator('.react-flow__resize-control.bottom.right');
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 120, h.y + 90, { steps: 10 });
  await page.mouse.up();
  const after = (await lb.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 60);
  expect(after.height).toBeGreaterThan(before.height + 40);

  await page.reload();
  const lb2 = node(page, 'Load Balancer 1');
  await expect(lb2).toContainText('L7, TLS termination');
  const reloaded = (await lb2.boundingBox())!;
  expect(Math.abs(reloaded.width - after.width)).toBeLessThan(4);
});
