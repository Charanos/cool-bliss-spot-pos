import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORKSPACES, crumbsFor, destinations, isRecordPath, pageFor, workspaceFor } from './nav';

/**
 * The nav manifest is the Console's map: the rail, the tabs, the crumbs and the command menu read
 * it. These tests hold it to the routes that exist on disk, so a renamed page cannot leave a link
 * pointing nowhere, and a new page cannot ship without an entry.
 */

const SHELL = join(__dirname, '..');
const routeDir = (href: string) => join(SHELL, href.replace(/^\/console\/?/, ''));

function listPages(dir: string, base = '/console'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory() || name.startsWith('_') || name.startsWith('(') || name.startsWith('[')) continue;
    const href = `${base}/${name}`;
    if (existsSync(join(path, 'page.tsx'))) out.push(href);
    out.push(...listPages(path, href));
  }
  return out;
}

describe('the nav manifest', () => {
  it('points every workspace and page at a route that exists', () => {
    for (const w of WORKSPACES) {
      expect(existsSync(join(routeDir(w.href), 'page.tsx')), w.href).toBe(true);
      for (const p of w.pages) expect(existsSync(join(routeDir(p.href), 'page.tsx')), p.href).toBe(true);
    }
  });

  it('names every list page on disk, except the ones that only redirect or create', () => {
    const named = new Set(WORKSPACES.flatMap((w) => [w.href, ...w.pages.map((p) => p.href)]));
    // Record and create pages, and old addresses kept as redirects, are reached from a list, not the rail.
    const unlisted = listPages(SHELL).filter((href) => !named.has(href) && !/\/(new|dynamics)$/.test(href));
    expect(unlisted).toEqual([]);
  });

  it('has one destination per page, with no duplicate addresses', () => {
    const hrefs = destinations().map((d) => d.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('finds the workspace and page for a path, preferring the longest match', () => {
    expect(workspaceFor('/console/trade/bills')?.key).toBe('trade');
    expect(pageFor('/console/trade/bills/abc')?.page?.href).toBe('/console/trade/bills');
    expect(workspaceFor('/console/nowhere')).toBeNull();
  });

  it('tells a record page from a list page', () => {
    expect(isRecordPath('/console/trade/bills')).toBe(false);
    expect(isRecordPath('/console/trade/bills/abc')).toBe(true);
    expect(isRecordPath('/console/purchasing/receipts/new')).toBe(true);
    expect(isRecordPath('/console/trade')).toBe(false);
  });

  it('builds crumbs that end, unlinked, on where you are', () => {
    expect(crumbsFor('/console/trade/bills')).toEqual([
      { label: 'Trade', href: '/console/trade/open' },
      { label: 'Bills', href: null },
    ]);
    const record = crumbsFor('/console/trade/bills/abc', 'Bill 142');
    expect(record.at(-1)).toEqual({ label: 'Bill 142', href: null });
    expect(record[1]).toEqual({ label: 'Bills', href: '/console/trade/bills' });
  });
});
