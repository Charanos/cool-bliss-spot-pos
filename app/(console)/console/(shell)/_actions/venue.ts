'use server';

import { z } from 'zod';
import * as inventoryManage from '@/modules/inventory/manage';
import * as trade from '@/modules/trade/service';
import * as venue from '@/modules/identity/venue';
import { type ActionResult, id, kes, reason, runAction, wholeNumber } from '../_lib/action';

/** Setting the venue up: the outlet, roles, devices, stock locations and tables. */

const VENUE = ['/console/settings', '/console/people', '/console/inventory'];

export async function updateOutlet(raw: {
  name: string;
  legalName: string;
  address: string;
  businessDayCutover: string;
  taxRatePct: number;
  pricesTaxInclusive: boolean;
  lowStockDefault: number;
  drawerVarianceThreshold: string;
  reason: string;
}): Promise<ActionResult> {
  const schema = z.object({
    name: z.string().max(60),
    legalName: z.string().max(100),
    address: z.string().max(200),
    businessDayCutover: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time, such as 06:00.'),
    taxRatePct: z.number({ error: 'Enter VAT as a percentage.' }).min(0, 'VAT cannot be below zero.').max(50, 'VAT is at most 50 per cent.'),
    pricesTaxInclusive: z.boolean(),
    lowStockDefault: wholeNumber('The low stock line', 1000),
    drawerVarianceThreshold: kes('the drawer threshold'),
    reason,
  });
  return runAction(
    schema,
    raw,
    (input, actor) =>
      void venue.updateOutlet({ ...input, taxRateBps: Math.round(input.taxRatePct * 100), drawerVarianceThresholdCents: input.drawerVarianceThreshold, actor }),
    { revalidate: ['/console'] },
  );
}

export async function createRole(raw: { name: string; basedOnRoleId: string }): Promise<ActionResult<{ id: string }>> {
  return runAction(z.object({ name: z.string().max(30), basedOnRoleId: id('role') }), raw, (input, actor) => ({ id: venue.createRole({ ...input, actor }).id }), { revalidate: VENUE });
}

export async function renameRole(raw: { roleId: string; name: string }): Promise<ActionResult> {
  return runAction(z.object({ roleId: id('role'), name: z.string().max(30) }), raw, (input, actor) => venue.renameRole({ ...input, actor }), { revalidate: VENUE });
}

export async function deleteRole(raw: { roleId: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ roleId: id('role'), reason }), raw, (input, actor) => venue.deleteRole({ ...input, actor }), { revalidate: VENUE });
}

const deviceKind = z.enum(['floor', 'counter', 'bar'], { error: 'Choose the kind of device.' });

export async function registerDevice(raw: { label: string; kind: 'floor' | 'counter' | 'bar' }): Promise<ActionResult<{ id: string; pairingCode: string }>> {
  return runAction(
    z.object({ label: z.string().max(30), kind: deviceKind }),
    raw,
    (input, actor) => {
      const { device, pairingCode } = venue.registerDevice({ ...input, actor });
      return { id: device.id, pairingCode };
    },
    { revalidate: VENUE },
  );
}

export async function renameDevice(raw: { deviceId: string; label: string }): Promise<ActionResult> {
  return runAction(z.object({ deviceId: id('device'), label: z.string().max(30) }), raw, (input, actor) => venue.renameDevice({ ...input, actor }), { revalidate: VENUE });
}

export async function reinstateDevice(raw: { deviceId: string; reason: string }): Promise<ActionResult<{ pairingCode: string }>> {
  return runAction(z.object({ deviceId: id('device'), reason }), raw, (input, actor) => venue.reinstateDevice({ ...input, actor }), { revalidate: VENUE });
}

export async function newPairingCode(raw: { deviceId: string }): Promise<ActionResult<{ pairingCode: string }>> {
  return runAction(z.object({ deviceId: id('device') }), raw, (input, actor) => venue.newPairingCode({ ...input, actor }), { revalidate: VENUE });
}

const locationKind = z.enum(['store', 'service', 'retail'], { error: 'Choose the kind of location.' });

export async function saveLocation(raw: { id?: string | null; name: string; kind: 'store' | 'service' | 'retail' }): Promise<ActionResult<{ id: string }>> {
  return runAction(z.object({ id: id('location').nullable().optional(), name: z.string().max(40), kind: locationKind }), raw, (input, actor) => ({ id: inventoryManage.saveLocation({ ...input, actor }).id }), { revalidate: VENUE });
}

export async function setDefaultLocation(raw: { id: string; use: 'receipt' | 'sale' }): Promise<ActionResult> {
  return runAction(z.object({ id: id('location'), use: z.enum(['receipt', 'sale']) }), raw, (input, actor) => inventoryManage.setDefaultLocation({ ...input, actor }), { revalidate: VENUE });
}

export async function setLocationStatus(raw: { id: string; status: 'active' | 'archived'; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('location'), status: z.enum(['active', 'archived']), reason }), raw, (input, actor) => inventoryManage.setLocationStatus({ ...input, actor }), { revalidate: VENUE });
}

export async function removeServiceTable(raw: { tableId: string }): Promise<ActionResult> {
  return runAction(z.object({ tableId: id('table') }), raw, (input, actor) => trade.removeServiceTable({ ...input, actor }), { revalidate: VENUE });
}
