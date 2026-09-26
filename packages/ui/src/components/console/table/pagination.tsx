'use client';

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Button } from '../../button';

/** Page through a long table: where you are, and one step either way. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-16 border-t border-edge px-20 py-12">
      <span className="text-body-sm text-ink-muted tabular">
        Page {page} of {pages}
      </span>
      <div className="flex items-center gap-8">
        <Button size="xs" variant="outline" icon={IconChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="xs" variant="outline" icon={IconChevronRight} iconPosition="end" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
