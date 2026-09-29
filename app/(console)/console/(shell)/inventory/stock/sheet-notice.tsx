import { ButtonLink } from '@bliss/ui/components/button-link';
import { Callout } from '@bliss/ui/components/console/section';
import { IconClipboardList } from '@tabler/icons-react';

/** A paper stock sheet waiting to be booked: said above the stock it will set. */
export function SheetNotice({ sheets }: { sheets: readonly { id: string; title: string; items: number }[] }) {
  if (sheets.length === 0) return null;
  const first = sheets[0]!;
  return (
    <Callout
      tone="info"
      title={`${first.title} is ready to book`}
      action={
        <ButtonLink href={`/console/inventory/stock/sheets/${first.id}`} variant="outline" icon={IconClipboardList}>
          Review and book
        </ButtonLink>
      }
    >
      {first.items} items counted on paper, with the night&apos;s sales. Until it is booked, the figures below are the ones Bliss had before the count.
    </Callout>
  );
}

/** After booking, the way back to the sheet: to read what was booked, or for the owner to start again from it. */
export function SheetBaselineLink({ sheets }: { sheets: readonly { id: string; title: string }[] }) {
  if (sheets.length === 0) return null;
  const last = sheets[sheets.length - 1]!;
  return (
    <Callout
      tone="info"
      title={`Stock was set from ${last.title}`}
      action={
        <ButtonLink href={`/console/inventory/stock/sheets/${last.id}`} variant="outline" icon={IconClipboardList}>
          Open the sheet
        </ButtonLink>
      }
    >
      If placeholder or trial stock has crept in since, open the sheet and use Start again from this sheet. It clears sales and stock records and sets the shelf back to the sheet.
    </Callout>
  );
}
