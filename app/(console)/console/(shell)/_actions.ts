'use server';

import type { CountKind, EmploymentStatus, PermissionKey } from '@bliss/shared/domain';
import { type Cents, parseKes } from '@bliss/shared/money';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { withWrite } from '@/modules/_data/store';
import { redirect } from 'next/navigation';
import * as identity from '@/modules/identity/service';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import * as sync from '@/modules/sync/service';

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Console server actions. Each one runs as the signed-in actor, and every permission guard and
 * reason rule is enforced in the module service, not here and not in the interface.
 */
async function attempt(paths: string[], work: () => void): Promise<ActionResult> {
  try {
    await withWrite(work);
    for (const p of paths) revalidatePath(p, 'layout');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'That did not go through. Nothing was changed.' };
  }
}

export async function placeHold(input: { variantId: string; reason: string; expectedBack: string | null }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    inventory.placeHold({ variantId: input.variantId, reason: input.reason, expectedBack: input.expectedBack || null, actor });
  });
}

export async function releaseHold(input: { holdId: string; note: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    inventory.releaseHold({ holdId: input.holdId, note: input.note, actor });
  });
}

export async function writeOff(input: { variantId: string; locationId: string; qty: number; category: inventory.WriteOffCategory; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    inventory.writeOff({ ...input, actor });
  });
}

export async function openCount(formData: FormData): Promise<void> {
  const actor = await identity.currentConsoleActor();
  const locationId = String(formData.get('locationId') ?? '');
  const kind = String(formData.get('kind') ?? 'full') as CountKind;
  const categoryId = String(formData.get('categoryId') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const count = await withWrite(() => inventory.openCount({ locationId, kind, categoryIds: categoryId ? [categoryId] : [], notes: notes || null, actor }));
  revalidatePath('/console/inventory/counts');
  redirect(`/console/inventory/counts/${count.id}`);
}

export async function recordCounted(input: { countLineId: string; countedQty: number | null }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  try {
    inventory.recordCounted({ ...input, actor });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'That figure did not save.' };
  }
}

export async function submitForReview(input: { countId: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt([`/console/inventory/counts`], () => inventory.submitForReview({ countId: input.countId, actor }));
}

export async function recountLine(input: { countLineId: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt([`/console/inventory/counts`], () => inventory.returnLineToCounting({ countLineId: input.countLineId, actor }));
}

export async function commitCount(input: { countId: string; reasons: Record<string, string>; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    inventory.commitCount({ ...input, actor });
  });
}

export async function cancelCount(input: { countId: string; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console/inventory/counts'], () => inventory.cancelCount({ ...input, actor }));
}

export async function withdrawDevice(input: { deviceId: string; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    identity.withdrawDevice({ ...input, actor });
  });
}

export async function resolveDeadLetter(input: { id: string; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    sync.resolve({ ...input, actor });
  });
}

export async function setTheme(theme: 'light' | 'dark'): Promise<void> {
  (await cookies()).set('bliss-console-theme', theme, { path: '/console', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/console', 'layout');
}

/** Money crosses the wire as a string and becomes Cents here, never as a float. */
function amount(input: string, what: string): Cents {
  try {
    return parseKes(input);
  } catch {
    throw new Error(`Enter ${what} in shillings, such as 1,250 or 1250.50.`);
  }
}

export async function setPrice(input: { listId: string; variantId: string; price: string | null; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    pricing.setPrice({ listId: input.listId, variantId: input.variantId, priceCents: input.price === null ? null : amount(input.price, 'the price'), reason: input.reason, actor });
  });
}

export async function updateStockSettings(input: { productId: string; lowStockThreshold: number | null; reorderPoint: number; reorderQty: number; leadTimeDays: number }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    catalogue.updateStockSettings({ ...input, actor });
  });
}

export async function setStaffRole(input: { staffId: string; roleId: string; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console/people'], () => {
    identity.setStaffRole({ ...input, actor });
  });
}

export async function setEmploymentStatus(input: { staffId: string; status: EmploymentStatus; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console/people'], () => {
    identity.setEmploymentStatus({ ...input, actor });
  });
}

export async function setRolePermission(input: { roleId: string; permission: PermissionKey; granted: boolean; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console/people'], () => {
    identity.setRolePermission({ ...input, actor });
  });
}

export async function raisePurchaseOrder(input: { supplierId: string; lines: { variantId: string; qty: number; unitCost: string }[]; expectedAt: string | null; notes: string | null }): Promise<ActionResult & { id?: string }> {
  const actor = await identity.currentConsoleActor();
  let id: string | undefined;
  const result = await attempt(['/console/purchasing'], () => {
    const order = procurement.raisePurchaseOrder({
      supplierId: input.supplierId,
      lines: input.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitCostCents: amount(l.unitCost, 'each unit cost') })),
      expectedAt: input.expectedAt ? Date.parse(`${input.expectedAt}T12:00:00+03:00`) : null,
      notes: input.notes,
      actor,
    });
    id = order.id;
  });
  return result.ok ? { ok: true, id } : result;
}

export async function receiveAgainstOrder(input: { purchaseOrderId: string; deliveryNoteRef: string; lines: procurement.ReceiveLine[]; varianceNote: string | null }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console'], () => {
    procurement.receiveAgainstOrder({ ...input, actor });
  });
}

export async function cancelPurchaseOrder(input: { purchaseOrderId: string; reason: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console/purchasing'], () => {
    procurement.cancelPurchaseOrder({ ...input, actor });
  });
}

export async function approvePurchaseOrder(input: { purchaseOrderId: string }): Promise<ActionResult> {
  const actor = await identity.currentConsoleActor();
  return attempt(['/console/purchasing'], () => {
    procurement.approvePurchaseOrder({ ...input, actor });
  });
}

export async function recordGoodsReceipt(input: {
  purchaseOrderId?: string | null;
  supplierId: string;
  deliveryNoteRef: string;
  invoiceNumber?: string | null;
  etimsInvoiceRef?: string | null;
  mediaUrls?: string[];
  lines: procurement.IntakeLineInput[];
  varianceNote?: string | null;
  gpsLocation?: string | null;
}): Promise<ActionResult & { id?: string; grnNumber?: number }> {
  const actor = await identity.currentConsoleActor();
  let id: string | undefined;
  let grnNumber: number | undefined;
  const result = await attempt(['/console/purchasing', '/console/purchasing/receipts', '/console/inventory', '/console/inventory/stock'], () => {
    const receipt = procurement.recordGoodsReceipt({
      ...input,
      actor,
    });
    id = receipt.id;
    grnNumber = receipt.grnNumber;
  });
  return result.ok ? { ok: true, id, grnNumber } : result;
}

