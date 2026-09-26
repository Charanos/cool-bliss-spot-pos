'use client';

import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconArrowRight,
  IconCash,
  IconClipboardList,
  IconFileInvoice,
  IconHistory,
  IconLogout,
  IconMoon,
  IconPackageImport,
  IconReceipt2,
  IconRefresh,
  IconSearch,
  IconShoppingCart,
  IconTag,
  IconUser,
  IconUserPlus,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { signOutFromConsole } from '../../../sign-in/actions';
import { type SearchHit, searchConsole } from '../../_actions/search';
import { setTheme } from '../../_actions/settings';
import { destinations } from '../../_lib/nav';
import { COMMAND_EVENT } from './command-events';

type Icon = typeof IconSearch;

interface Entry {
  id: string;
  group: 'Recent' | 'Go to' | 'Do' | 'Find';
  label: string;
  detail?: string;
  icon: Icon;
  run: () => void;
  keywords?: string;
}

const RECENT_KEY = 'bliss.command.recent';
const HIT_ICON: Record<SearchHit['kind'], Icon> = { tab: IconReceipt2, bill: IconFileInvoice, product: IconTag, person: IconUser, delivery: IconPackageImport, order: IconShoppingCart };

function readRecent(): { href: string; label: string; detail: string }[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as { href: string; label: string; detail: string }[]) : [];
    return Array.isArray(list) ? list.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function remember(entry: { href: string; label: string; detail: string }) {
  try {
    const next = [entry, ...readRecent().filter((r) => r.href !== entry.href)].slice(0, 5);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // A private window, or storage turned off: recents are a convenience, not a record.
  }
}

/**
 * Search or jump to anything. docs/19 section 4.4. Command K (Control K), or the rail's search button.
 * Go to any page, find a tab, bill, delivery, order, product or person by number or name, or do one
 * of the common things. The combobox pattern: arrow keys move, Enter runs, Escape closes.
 */
export function CommandMenu({ theme }: { theme: 'light' | 'dark' | 'system' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<{ href: string; label: string; detail: string }[]>([]);
  const [searching, startSearch] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener(COMMAND_EVENT, onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(COMMAND_EVENT, onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHits([]);
    setActive(0);
    setRecent(readRecent());
  }, [open]);

  // Records are searched on the server, a moment after typing stops.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 && !/^\d+$/.test(q)) {
      setHits([]);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      startSearch(async () => {
        try {
          setHits(await searchConsole(q));
        } catch {
          setHits([]);
        }
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const go = useCallback(
    (href: string, label: string, detail: string) => {
      remember({ href, label, detail });
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (e: { label: string; keywords?: string; detail?: string }) => !q || `${e.label} ${e.detail ?? ''} ${e.keywords ?? ''}`.toLowerCase().includes(q);

    const actions: Entry[] = [
      { id: 'do-receive', group: 'Do', label: 'Receive a delivery', icon: IconPackageImport, keywords: 'goods grn supplier', run: () => go('/console/purchasing/receipts/new', 'Receive a delivery', 'Purchasing') },
      { id: 'do-count', group: 'Do', label: 'Start a stock count', icon: IconClipboardList, keywords: 'stock take', run: () => go('/console/inventory/counts/new', 'Start a stock count', 'Inventory') },
      { id: 'do-person', group: 'Do', label: 'Add a person', icon: IconUserPlus, keywords: 'staff waiter new', run: () => go('/console/people/staff?new=1', 'Add a person', 'People') },
      { id: 'do-open', group: 'Do', label: 'See open tabs', icon: IconCash, keywords: 'floor tables', run: () => go('/console/trade/open', 'Open tabs', 'Trade') },
      {
        id: 'do-theme',
        group: 'Do',
        label: theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme',
        icon: IconMoon,
        keywords: 'appearance mode',
        run: () => {
          const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
          document.documentElement.dataset.theme = next;
          setOpen(false);
          void setTheme(next);
        },
      },
      {
        id: 'do-refresh',
        group: 'Do',
        label: 'Refresh the data',
        icon: IconRefresh,
        keywords: 'reload update',
        run: () => {
          setOpen(false);
          router.refresh();
        },
      },
      {
        id: 'do-signout',
        group: 'Do',
        label: 'Sign out',
        icon: IconLogout,
        keywords: 'log out exit',
        run: () => {
          setOpen(false);
          void signOutFromConsole();
        },
      },
    ];

    const pages: Entry[] = destinations().map((d) => ({ id: `go-${d.href}`, group: 'Go to', label: d.label, detail: d.context, icon: IconArrowRight, keywords: d.keywords, run: () => go(d.href, d.label, d.context) }));
    const found: Entry[] = hits.map((h) => ({ id: `find-${h.kind}-${h.href}`, group: 'Find', label: h.label, detail: h.detail, icon: HIT_ICON[h.kind], run: () => go(h.href, h.label, h.detail) }));
    const recents: Entry[] = q ? [] : recent.map((r) => ({ id: `recent-${r.href}`, group: 'Recent', label: r.label, detail: r.detail, icon: IconHistory, run: () => go(r.href, r.label, r.detail) }));

    return [...recents, ...found, ...pages.filter(match).slice(0, q ? 8 : 6), ...actions.filter(match)];
  }, [query, hits, recent, go, router, theme]);

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, entries.length - 1)));
  }, [entries.length]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') setActive((i) => (i >= entries.length - 1 ? 0 : i + 1));
    else if (event.key === 'ArrowUp') setActive((i) => (i <= 0 ? entries.length - 1 : i - 1));
    else if (event.key === 'Enter') entries[active]?.run();
    else return;
    event.preventDefault();
  };

  const groups = (['Recent', 'Find', 'Go to', 'Do'] as const).map((g) => ({ group: g, items: entries.map((e, index) => ({ e, index })).filter(({ e }) => e.group === g) })).filter((g) => g.items.length > 0);

  return (
    <ConsoleOverlay open={open} onClose={() => setOpen(false)} title="Search or jump to" hideTitle width="md">
      <div className="-mx-24 -mt-24 flex flex-col">
        <div className="flex h-control-lg items-center gap-12 border-b border-edge px-20">
          <IconSearch size={18} stroke={1.5} aria-hidden="true" className="shrink-0 text-ink-subtle" />
          <input
            ref={inputRef}
            data-autofocus=""
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={entries[active] ? `${listId}-${entries[active].id}` : undefined}
            aria-autocomplete="list"
            aria-label="Search or jump to"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search tabs, bills, products, people, or a page"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-ui text-ink outline-none placeholder:text-ink-subtle"
          />
          {searching ? <span className="text-body-sm text-ink-subtle">Searching</span> : null}
        </div>
        <div id={listId} role="listbox" aria-label="Results" className="max-h-popover overflow-y-auto p-8">
          {entries.length === 0 ? (
            <p className="px-12 py-24 text-center text-body-sm text-ink-muted">{searching ? 'Searching' : `Nothing called "${query.trim()}". Try a tab or bill number, or a name.`}</p>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group} role="group" aria-label={group} className="pb-4">
                <p aria-hidden="true" className="label-caps px-12 pb-4 pt-8 text-ink-subtle">
                  {group}
                </p>
                {items.map(({ e, index }) => (
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keys are handled by the combobox input, which keeps focus
                  <div
                    key={e.id}
                    id={`${listId}-${e.id}`}
                    role="option"
                    aria-selected={index === active}
                    tabIndex={-1}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => e.run()}
                    className={cx('flex cursor-pointer items-center gap-12 rounded-sm px-12 py-8', index === active ? 'bg-control' : null)}
                  >
                    <e.icon size={16} stroke={1.5} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                    <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{e.label}</span>
                    {e.detail ? <span className="shrink-0 truncate text-body-sm text-ink-subtle">{e.detail}</span> : null}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </ConsoleOverlay>
  );
}
