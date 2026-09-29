'use client';

import { Button } from '@bliss/ui/components/button';
import { IconClipboardCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { applyStockSheet } from '../../../../_actions/inventory';
import { ReasonDialog } from '../../../../_components/forms';

/** Book the sheet, once, with a reason: the counts, the night's bill and the menu it needs. */
export function BookSheet({ sheetId, title, items, sales }: { sheetId: string; title: string; items: number; sales: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" icon={IconClipboardCheck} onClick={() => setOpen(true)}>
        Book the sheet
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Book the ${title.toLowerCase()}`}
        description={`${items} items are counted as they opened and closed that night, and the night's sales of ${sales} go in as one settled bill on that day. The menu gains what the sheet sells. It is booked once, and every line is on the record with your reason.`}
        confirmLabel="Book the sheet"
        destructive={false}
        quickReasons={['The first full stock take, from the paper sheet', 'Stock and sales from the paper sheet']}
        run={(reason) => applyStockSheet({ sheetId, reason })}
        toast={(r) => ({ title: 'Stock sheet booked', body: `${(r as { items?: number }).items ?? items} items counted, and the night's sales are bill ${(r as { billNumber?: number }).billNumber ?? ''}.` })}
      />
    </>
  );
}
