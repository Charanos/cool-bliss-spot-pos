import 'server-only';

import { type Actor, checkReason } from '@bliss/shared/reason';
import { applyClearTrade, planClearTrade, type ClearPlan } from '../_data/clear-trade';
import { DomainError } from '../_data/errors';
import { dataset } from '../_data/source';
import { clearTradeStored, storeEnabled, withWrite } from '../_data/store';
import * as audit from '../audit/service';
import * as identity from '../identity/service';
import '../notify/triggers';

/**
 * Clear trade, for the end of a trial run with the staff: every tab, order, bill, shift and drawer
 * goes, and the stock those sales took goes back on the shelf, while the outlet as set up stays
 * (tables, staff, devices, menu, prices, suppliers, deliveries and counts). Owners only, with a
 * reason; the audit trail keeps who did it and what went. Every station starts clean at its next pull.
 */
export async function clearTrade(input: { actor: Actor; reason: string }): Promise<ClearPlan['summary']> {
  const role = identity.roleFor(input.actor.staffId);
  if (role?.key !== 'owner') throw new DomainError('Only an owner can clear trade.');
  const check = checkReason(input.reason);
  if (!check.ok) throw new DomainError(check.message);
  const epoch = `cleared:${Date.now().toString(36)}`;
  let summary: ClearPlan['summary'];
  if (storeEnabled()) summary = await clearTradeStored(epoch);
  else {
    const data = dataset();
    const plan = planClearTrade(data);
    applyClearTrade(data, plan, epoch);
    summary = plan.summary;
  }
  const outlet = identity.outlet();
  await withWrite(() =>
    audit.record({ outletId: outlet.id, actorStaffId: input.actor.staffId, actorDeviceId: null, action: 'trade.cleared', entityType: 'outlet', entityId: outlet.id, before: summary, after: null, reason: check.reason, severity: 'sensitive' }),
  );
  return summary;
}
