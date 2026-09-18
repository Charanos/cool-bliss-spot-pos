import 'server-only';

import { type Actor, requireReasoned } from '@bliss/shared/reason';
import * as audit from '../audit/service';
import * as identity from '../identity/service';
import { syncTables } from './schema';

/**
 * Dead letters: anything a device could not push and the server would not accept, visibly. A dead
 * letter queue nobody looks at is a data loss mechanism with extra steps. docs/04-data-model.md.
 */
export function deadLetters(filter: { resolved?: boolean } = {}) {
  return syncTables()
    .deadLetters.filter((d) => filter.resolved === undefined || (d.resolvedAt !== null) === filter.resolved)
    .sort((a, b) => b.firstSeenAt - a.firstSeenAt);
}

export function unresolvedCount(): number {
  return syncTables().deadLetters.filter((d) => d.resolvedAt === null).length;
}

export function resolve(input: { id: string; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'device.manage', 'resolving unsent orders');
  const letter = syncTables().deadLetters.find((d) => d.id === input.id);
  if (!letter) throw new Error('That item is no longer in the queue.');
  if (letter.resolvedAt) throw new Error('That item was already resolved.');
  letter.resolvedAt = Date.now();
  letter.resolvedBy = actor.staffId;
  letter.resolutionNote = reason;
  audit.record({
    outletId: identity.outlet().id,
    actorStaffId: actor.staffId,
    action: 'sync.dead_letter_resolved',
    entityType: 'outbox_dead_letter',
    entityId: letter.id,
    before: { resolved: false },
    after: { resolved: true },
    reason,
    severity: 'notable',
  });
  return letter;
}
