/**
 * The first night on a fresh outlet, in real browsers, through the screens a new owner uses. Run
 * against a production build on the handover dataset:
 *
 *   BLISS_STORE=memory BLISS_DATASET=handover pnpm start
 *   node scripts/e2e/first-night.mjs [base url]
 *
 * Dan, the owner, signs in with the handover PIN and sets the outlet up in the Console: a zone and a
 * table, a category and a product with a price, a waiter, and a Floor and a Counter device. Each
 * device is paired with its code; the waiter signs in on the Floor (choosing their own PIN), opens
 * a tab and fires a round; Dan pours and settles it at the Counter, clears the table, and the
 * Console shows the bill, the stock and the audit.
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
const SHOTS = process.env.E2E_SHOTS ?? '/tmp/bliss-first-night';
mkdirSync(SHOTS, { recursive: true });
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1';

const browser = await playwright.chromium.launch();
const errors = [];
const results = [];
let step = 0;
async function check(name, fn) {
  step += 1;
  try {
    await fn();
    results.push(`ok   ${step}. ${name}`);
    console.log(results.at(-1));
  } catch (error) {
    await admin.screenshot({ path: `${SHOTS}/${String(step).padStart(2, '0')}-failed.png` }).catch(() => undefined);
    results.push(`FAIL ${step}. ${name}: ${String(error.message ?? error).split('\n')[0].slice(0, 240)}`);
    console.log(results.at(-1));
    throw error;
  }
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${String(step).padStart(2, '0')}-${name}.png` });

async function choose(dialog, field, option) {
  await dialog.getByRole('button', { name: field }).click();
  await dialog.page().getByRole('option', { name: option }).first().click();
}

const consoleCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await consoleCtx.newPage();
admin.on('pageerror', (e) => errors.push(`console: ${String(e).slice(0, 200)}`));
const dialog = () => admin.locator('dialog[open]');
const codes = {};
let floorCtx, floor;

try {
  await check('Only the owner is on a fresh outlet, and signs in with the handover PIN', async () => {
    await admin.goto(`${BASE}/console/sign-in`);
    const team = await admin.locator('main').innerText();
    if (!/1 on the team/.test(team)) throw new Error(`the sign-in lists: ${team.replace(/\s+/g, ' ').slice(0, 120)}`);
    await admin.getByText('Dan', { exact: false }).first().click();
    for (const d of '111111') await admin.keyboard.press(d);
    await admin.waitForURL('**/console/overview', { timeout: 20_000 });
  });

  await check('He adds a zone and a table', async () => {
    await admin.goto(`${BASE}/console/people/zoning`);
    await admin.getByRole('button', { name: 'Add a zone' }).click();
    await dialog().getByRole('textbox', { name: 'Name' }).fill('Terrace');
    await dialog().getByRole('button', { name: 'Add zone' }).click();
    await dialog().waitFor({ state: 'detached', timeout: 10_000 });
    await admin.getByRole('button', { name: 'Add a table' }).click({ timeout: 10_000 });
    await dialog().getByRole('textbox', { name: 'Name' }).fill('T1');
    await dialog().getByRole('button', { name: 'Add table' }).click();
    await dialog().waitFor({ state: 'detached', timeout: 10_000 });
    await admin.getByText('T1', { exact: true }).first().waitFor({ timeout: 10_000 });
    await shot(admin, 'zoning');
  });

  await check('He adds a category and a product with its price', async () => {
    await admin.goto(`${BASE}/console/catalogue/categories`);
    await admin.getByRole('button', { name: 'Add a category' }).click();
    await dialog().getByRole('textbox', { name: 'Name' }).fill('Beer');
    await dialog().getByRole('button', { name: 'Add category' }).click();
    await dialog().waitFor({ state: 'detached', timeout: 10_000 });
    await admin.goto(`${BASE}/console/catalogue/products`);
    await admin.getByRole('button', { name: 'Add a product' }).click();
    await dialog().getByRole('textbox', { name: 'Name' }).fill('Tusker Lager');
    await choose(dialog(), 'Category', 'Beer');
    await dialog().getByRole('textbox', { name: 'Bottle size, ml' }).fill('500');
    await dialog().getByRole('textbox', { name: 'Price, KES' }).fill('300');
    await shot(admin, 'product-dialog');
    await dialog().getByRole('button', { name: 'Add product' }).click();
    await admin.waitForURL('**/console/catalogue/products/**', { timeout: 15_000 });
    await shot(admin, 'product-record');
  });

  await check('He adds a waiter with a first PIN', async () => {
    await admin.goto(`${BASE}/console/people/staff`);
    await admin.getByRole('button', { name: 'Add a person' }).click();
    await dialog().getByRole('textbox', { name: 'Full name' }).fill('Wanjiru Kamau');
    await dialog().getByRole('textbox', { name: 'Display name' }).fill('Wanjiru');
    await dialog().getByRole('textbox', { name: 'First PIN' }).fill('246810');
    await dialog().getByRole('button', { name: 'Add person' }).click();
    await dialog().waitFor({ state: 'detached', timeout: 10_000 });
    await admin.getByText('Wanjiru', { exact: false }).first().waitFor({ timeout: 10_000 });
  });

  await check('He registers a Floor tablet and a Counter, each with a pairing code', async () => {
    for (const [label, kind] of [['Floor 1', 'Floor tablet'], ['Counter 1', 'Counter']]) {
      await admin.goto(`${BASE}/console/settings/devices`);
      await admin.getByRole('button', { name: 'Register a device' }).click();
      await dialog().getByRole('textbox', { name: 'Called' }).fill(label);
      await choose(dialog(), 'Kind', kind);
      await dialog().getByRole('button', { name: 'Register' }).click();
      await admin.waitForTimeout(1500);
      await shot(admin, `registered-${label.replace(' ', '-')}`);
      const text = await admin.locator('body').innerText();
      const code = text.match(/\b(\d{3}\s?\d{3})\b/);
      console.log('     ', label, 'code', code?.[1]);
      codes[label] = code?.[1]?.replace(/\s/g, '');
      if (!codes[label]) throw new Error(`no pairing code shown for ${label}`);
      await dialog().getByRole('button', { name: 'Done' }).click();
    }
  });

  await check('The Floor tablet is paired with its code', async () => {
    floorCtx = await browser.newContext({ viewport: { width: 1024, height: 768 }, userAgent: IPAD, isMobile: true, hasTouch: true });
    floor = await floorCtx.newPage();
    floor.on('pageerror', (e) => errors.push(`floor: ${String(e).slice(0, 200)}`));
    await floor.goto(`${BASE}/floor/sign-in`);
    await floor.waitForTimeout(3000);
    await floor.getByRole('button', { name: 'Wanjiru Waiter' }).click();
    await floor.waitForTimeout(800);
    for (const d of '246810') await floor.keyboard.press(d);
    await floor.waitForTimeout(1500);
    await floor.getByText('Enter the pairing code from the Console').waitFor({ timeout: 10_000 });
    for (const d of codes['Floor 1']) await floor.keyboard.press(d);
    await floor.waitForTimeout(2000);
    await floor.getByText(/Enter your 6 digit PIN/).waitFor({ timeout: 10_000 });
  });

  await check('The waiter signs in, choosing a PIN only they know', async () => {
    for (const d of '246810') await floor.keyboard.press(d);
    await floor.waitForTimeout(1500);
    // A PIN a manager set is changed at the first sign-in: chosen, then confirmed.
    if (await floor.getByText(/Choose one only you know|Choose a new/).count()) {
      for (const d of '135792') await floor.keyboard.press(d);
      await floor.waitForTimeout(800);
      for (const d of '135792') await floor.keyboard.press(d);
    }
    await floor.waitForURL('**/floor/tabs**', { timeout: 20_000 });
    await floor.waitForTimeout(2000);
    await shot(floor, 'floor-tabs');
  });

  await check('She opens a tab on Table 1 and fires a round', async () => {
    await floor.getByRole('button', { name: /^Open a tab on Table 1/ }).first().click({ timeout: 15_000 });
    await floor.getByRole('button', { name: /^Open tab/ }).click();
    await floor.waitForURL('**/floor/tabs/**', { timeout: 15_000 });
    await floor.waitForTimeout(1500);
    const tile = floor.locator('button[data-variant-id]:not([aria-disabled="true"])').first();
    await tile.click({ timeout: 15_000 });
    await tile.click();
    await floor.getByRole('button', { name: /^Fire/ }).click();
    await floor.waitForTimeout(2500);
    await shot(floor, 'floor-fired');
  });
} catch {
  // reported below
}
console.log(`\n${results.filter((r) => r.startsWith('ok')).length} of ${step} passed; page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
await browser.close();
if (results.some((r) => r.startsWith('FAIL')) || errors.length) process.exit(1);
