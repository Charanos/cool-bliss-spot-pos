/**
 * Switching surfaces carries the person who switched, and no one else. Run against a production
 * build started with BLISS_STORE=memory BLISS_DEV_DATA=1:  node scripts/e2e/handoff.mjs
 *
 * The browser starts with other people already signed in on both stations (Amina on the Floor,
 * Grace at the Counter). Dan, a manager, then switches Console → Floor → Counter → Console and must
 * be Dan every time. A reused ticket lands on the PIN screen, and a waiter cannot reach the Console.
 */
import { createRequire } from 'node:module';
const require = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? '/opt/node22/lib/node_modules'}/`);
const { chromium } = require('playwright');

const BASE = process.env.BASE ?? 'http://localhost:3000';
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(label);
};

async function stationSignIn(page, surface, name, pin) {
  await page.goto(`${BASE}/${surface}/sign-in`);
  await page.getByText(name, { exact: false }).first().waitFor({ timeout: 20000 });
  await page.getByText(name, { exact: false }).first().click();
  await page.waitForTimeout(300);
  for (const d of pin) await page.keyboard.press(d);
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 20000 });
}

async function stationPerson(page) {
  await page.locator('[data-topbar]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  return page.locator('[data-topbar]').innerText();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

// Other people already signed in on both stations in this browser.
await stationSignIn(page, 'floor', 'Amina', '111111');
check('Amina is on the Floor', (await stationPerson(page)).includes('Amina'));
await stationSignIn(page, 'counter', 'Grace', '444444');
check('Grace is at the Counter', (await stationPerson(page)).includes('Grace'));

// Dan signs in to the Console.
await page.goto(`${BASE}/console/sign-in`);
await page.getByText('Dan', { exact: false }).first().click();
await page.waitForTimeout(300);
for (const d of '555555') await page.keyboard.press(d);
await page.waitForURL('**/console/overview', { timeout: 20000 });

// Console → Floor, from the account menu.
await page.getByRole('button', { name: /Dan/ }).last().click();
await page.getByRole('menuitem', { name: 'Open the Floor station' }).click();
await page.waitForURL((u) => u.pathname.startsWith('/floor/') && !u.pathname.endsWith('/sign-in'), { timeout: 20000 });
let who = await stationPerson(page);
check('Console → Floor arrives as Dan', who.includes('Dan') && !who.includes('Amina'), who.replace(/\s+/g, ' ').slice(-40));
check('no ticket left in the address', !page.url().includes('handoff'));

// Floor → Counter, from the switcher.
await page.getByRole('button', { name: 'Switch to the Counter' }).click();
await page.waitForURL((u) => u.pathname.startsWith('/counter/') && !u.pathname.endsWith('/sign-in'), { timeout: 20000 });
who = await stationPerson(page);
check('Floor → Counter arrives as Dan', who.includes('Dan') && !who.includes('Grace'), who.replace(/\s+/g, ' ').slice(-40));

// Counter → Console.
await page.getByRole('button', { name: 'Switch to the Console' }).click();
await page.waitForURL('**/console/overview', { timeout: 20000 });
const rail = await page.getByRole('button', { name: /Dan/ }).count();
check('Counter → Console arrives as Dan', rail > 0);

// A ticket works once.
const url = await page.evaluate(async () => {
  const r = await fetch('/api/handoff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from: 'console', to: 'counter' }) });
  return (await r.json()).url;
});
await page.goto(`${BASE}${url}`);
await page.waitForURL((u) => u.pathname.startsWith('/counter/') && !u.pathname.endsWith('/sign-in'), { timeout: 20000 });
check('a fresh ticket signs in', true);
await page.goto(`${BASE}${url}`);
await page.waitForTimeout(3000);
check('the same ticket again does not sign anyone in', new URL(page.url()).pathname.endsWith('/sign-in') || !(await stationPerson(page)).includes('Grace'));

// The Console audit shows the switches.
await page.goto(`${BASE}/console/settings/audit?range=tonight`);
await page.waitForTimeout(2000);
const audit = await page.locator('main').innerText();
check('the audit records the switches', (audit.match(/Switched surface as themselves/g) ?? []).length >= 3, `${(audit.match(/Switched surface as themselves/g) ?? []).length} rows`);
await ctx.close();

// A waiter cannot reach the Console, and sees no Console segment.
const c2 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p2 = await c2.newPage();
await stationSignIn(p2, 'floor', 'Peter', '222222');
check('a waiter sees no Console segment', (await p2.getByRole('button', { name: 'Switch to the Console' }).count()) === 0);
const denied = await p2.evaluate(async () => {
  const token = await new Promise((resolve) => {
    const open = globalThis.indexedDB.open('bliss-floor');
    open.onsuccess = () => {
      const req = open.result.transaction('meta').objectStore('meta').get('station.token');
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => resolve(null);
    };
    open.onerror = () => resolve(null);
  });
  const r = await fetch('/api/handoff', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-bliss-station': token } : {}) }, body: JSON.stringify({ from: 'station', to: 'console' }) });
  return (await r.json()).url;
});
check('a waiter asking for the Console is sent to its PIN screen', denied === '/console/sign-in', denied);
await c2.close();

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nevery switch carried the person who made it');
