'use client';

import { TableError } from './_components/table-states';

export default function ConsoleError({ reset }: { error: Error; reset: () => void }) {
  return <TableError reset={reset} what="This view" />;
}
