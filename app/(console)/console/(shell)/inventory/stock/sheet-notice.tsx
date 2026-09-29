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
