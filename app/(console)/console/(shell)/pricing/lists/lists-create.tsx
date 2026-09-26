'use client';

import { useCreateParam, useDialog } from '../../_components/forms';
import { PriceListDialog } from '../_parts/list-dialogs';

/** The create dialog for price lists, opened by ?new=1 from the header's button or the command menu. */
export function ListsCreate({ canEdit }: { canEdit: boolean }) {
  const dialog = useDialog<'new'>();
  useCreateParam(() => dialog.open('new', null), canEdit);
  return <PriceListDialog open={dialog.is('new')} onClose={dialog.close} target={null} />;
}
