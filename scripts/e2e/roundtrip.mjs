/**
 * The round trip, end to end, in real browsers: a waiter on the Floor (an iPad mini 4 shape) orders
 * for two seats and sends it, the Counter (a 1366 laptop) pours it, the Floor marks it served and asks
 * for the bill, the Counter opens its drawer if the night has none and settles it in cash, and the Console shows the bill. Then the Floor goes
 * offline, sends an order, comes back, and the Counter sees it exactly once. docs/16 section 8.
 *
 * Needs a running server with the development data (BLISS_STORE=memory BLISS_DEV_DATA=1 pnpm start)
 * and Playwright. Run: node scripts/e2e/roundtrip.mjs [base url]. Screenshots land in $E2E_SHOTS.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = createRequire('/opt/node22/lib/node_modules/')('playwright');
}
const BASE = process.argv[2] ?? 'http://localhost:3000';
const SHOTS = process.env.E2E_SHOTS ?? '/tmp/bliss-e2e';
mkdirSync(SHOTS, { recursive: true });
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1';

const browser = await playwright.chromium.launch();
const errors = [];
let step = 0;
const results = [];

async function check(name, fn) {
  step += 1;
  try {
    await fn();
    results.push(`ok   ${step}. ${name}`);
  } catch (error) {
    results.push(`FAIL ${step}. ${name}: ${String(error.message ?? error).split('\n')[0].slice(0, 200)}`);
    throw error;
  }
}

async function station(surface, viewport, ua, who, pin) {
  const ctx = await browser.newContext({ viewport, ...(ua ? { userAgent: ua, isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${surface}: ${String(e).slice(0, 200)}`));
  await page.goto(`${BASE}/${surface}/sign-in`);
  await page.getByText(who, { exact: false }).first().click({ timeout: 20_000 });
  for (const d of pin) await page.keyboard.press(d);
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 30_000 });
  return { ctx, page };
}

const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${String(step).padStart(2, '0')}-${name}.png` });

let floor, counter, table;
try {
  await check('A waiter signs in on the Floor', async () => {
    floor = await station('floor', { width: 768, height: 1024 }, IPAD, 'Amina', '111111');
  });

  await check('She opens a tab on a free table for two', async () => {
    const { page } = floor;
    await page.goto(`${BASE}/floor/tabs`);
    await page.getByRole('radio', { name: /Free tables/ }).click();
    const first = page.locator('section[aria-labelledby=free-tables-heading] button').first();
    const label = await first.getAttribute('aria-label');
    table = label.replace(/^Open a tab on /, '').replace(/, .*$/, '');
    console.log(`     at ${table}`);
    // By its own name: a table offered for a moment and then taken would fail here, not open elsewhere.
    await page.getByRole('button', { name: label, exact: true }).click({ timeout: 5_000 }).catch(async (error) => {
      const now = await page.locator('section[aria-labelledby=free-tables-heading] button').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')));
      await shot(page, 'floor-table-gone');
      throw new Error(`${table} was offered, then not clickable; free now: ${now.slice(0, 3).join('; ')}. ${error.message.split('\n')[0]}`);
    });
    await page.getByRole('button', { name: 'One more guest' }).click();
    await page.getByRole('button', { name: /^Open tab/ }).click();
    await page.waitForURL('**/floor/tabs/**', { timeout: 15_000 });
    await shot(page, 'floor-tab-opened');
  });

  await check('She adds two drinks for seat 1 and one for seat 2, and sends them', async () => {
    const { page } = floor;
    const tiles = page.locator('button[data-variant-id]:not([aria-disabled="true"])');
    await tiles.nth(0).click();
    await tiles.nth(0).click();
    await page.getByRole('button', { name: /^Seat 2|^2\b/ }).first().click();
    await tiles.nth(1).click();
    await page.getByRole('button', { name: /^Fire/ }).click();
    await page.waitForTimeout(2500);
    await shot(page, 'floor-fired');
  });

  await check('The Counter signs in and sees the ticket', async () => {
    counter = await station('counter', { width: 1366, height: 768 }, null, 'Grace', '444444');
    await counter.page.goto(`${BASE}/counter/orders`);
    await counter.page.getByText(table, { exact: true }).first().waitFor({ timeout: 20_000 });
    await shot(counter.page, 'counter-ticket');
  });

  await check('The Counter pours it with the keyboard', async () => {
    const { page } = counter;
    // P pours the oldest ticket. On a server that has run this before, older tickets may wait ahead
    // of this one, so it presses until this table's ticket has nothing left to pour.
    const ours = page.getByRole('article', { name: table, exact: true }).getByRole('button', { name: 'Pour all' });
    for (let i = 0; i < 8 && (await ours.count()) > 0; i += 1) {
      await page.keyboard.press('p');
      await page.waitForTimeout(1500);
    }
    if ((await ours.count()) > 0) throw new Error(`${table} still has lines to pour`);
    await shot(page, 'counter-poured');
  });

  await check('The Floor marks it served and asks for the bill', async () => {
    const { page } = floor;
    await page.getByRole('button', { name: /Mark served/ }).first().click({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /Ask for the bill/ }).first().click({ timeout: 20_000 });
    await page.waitForTimeout(2500);
    await shot(page, 'floor-bill-asked');
  });

  await check('The Counter opens the drawer with a float, if the night has none', async () => {
    const { page } = counter;
    await page.goto(`${BASE}/counter/drawer`);
    await page.getByRole('heading', { name: 'Drawer', level: 1 }).waitFor({ timeout: 15_000 });
    const open = page.getByRole('button', { name: /^Open with KES/ });
    if (await open.waitFor({ timeout: 5_000 }).then(() => true, () => false)) {
      await page.getByLabel('How many 1,000 notes').fill('2');
      await page.getByRole('button', { name: 'Open with KES 2,000' }).click();
      await page.getByText('Drawer open', { exact: true }).first().waitFor({ timeout: 15_000 });
    }
    await shot(page, 'counter-drawer');
  });

  await check('The Counter settles it in cash, exactly', async () => {
    const { page } = counter;
    await page.goto(`${BASE}/counter/tabs`);
    // The tab's own Settle button, not a notice that happens to name the same table.
    await page.getByRole('button', { name: `Settle ${table}`, exact: true }).click({ timeout: 20_000 });
    await page.waitForURL('**/counter/tabs/**');
    await shot(page, 'counter-settle-screen');
    // Exact records the cash at once; then the dock's Settle takes the bill.
    await page.getByRole('button', { name: /^Exact/ }).first().click({ timeout: 15_000 });
    await page.getByRole('button', { name: /^Settle KES/ }).click({ timeout: 15_000 });
    await page.getByText(/Print Final Receipt|No change to give|Change/).first().waitFor({ timeout: 20_000 });
    await shot(page, 'counter-settled');
  });

  await check('The Console shows the bill', async () => {
    const console = await station('console', { width: 1440, height: 900 }, null, 'Dan', '555555');
    // The current business day, whatever the clock: after the cutover the default range is last night.
    await console.page.goto(`${BASE}/console/trade/bills?view=table&range=tonight`);
    await console.page.getByText(table, { exact: false }).first().waitFor({ timeout: 20_000 });
    await shot(console.page, 'console-bill');
    await console.ctx.close();
  });

  await check('Offline, the Floor still sends an order, exactly once, when it is back', async () => {
    const { page, ctx } = floor;
    await page.goto(`${BASE}/floor/tabs`);
    await page.getByRole('radio', { name: /Free tables/ }).click();
    const free = page.locator('section[aria-labelledby=free-tables-heading] button').first();
    const second = (await free.getAttribute('aria-label')).replace(/^Open a tab on /, '').replace(/, .*$/, '');
    await free.click();
    await page.getByRole('button', { name: /^Open tab/ }).click();
    await page.waitForURL('**/floor/tabs/**', { timeout: 15_000 });
    await ctx.setOffline(true);
    await page.locator('button[data-variant-id]:not([aria-disabled="true"])').nth(2).click();
    await page.getByRole('button', { name: /^Fire/ }).click();
    await page.waitForTimeout(2000);
    await shot(page, 'floor-offline-fired');
    await ctx.setOffline(false);
    await page.waitForTimeout(8000);
    await counter.page.goto(`${BASE}/counter/orders`);
    await counter.page.getByText(second, { exact: true }).first().waitFor({ timeout: 20_000 });
    const count = await counter.page.getByText(second, { exact: true }).count();
    if (count !== 1) throw new Error(`${second} shows ${count} times on the Counter`);
    await shot(counter.page, 'counter-offline-order');
  });
} catch {
  // The failing step is recorded; the summary below says which.
} finally {
  console.log(results.join('\n'));
  console.log(errors.length ? `page errors:\n  ${errors.join('\n  ')}` : 'page errors: none');
  await browser.close();
  process.exitCode = results.some((r) => r.startsWith('FAIL')) || errors.length ? 1 : 0;
}
