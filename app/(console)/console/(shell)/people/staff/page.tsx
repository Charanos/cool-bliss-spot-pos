import { addDays } from '@bliss/shared/time';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { ViewHeader } from '../../_components/workspace';
import { staffRow } from './staff-row';
import { type StaffRow, StaffTable } from './staff-table';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const actor = await identity.currentConsoleActor();
  const clock = reporting.clock();
  const shifts = trade.shiftsBetween(addDays(clock.current, -27), clock.current);
  const devices = identity.devices();

  const rows: StaffRow[] = identity.staffList().map((s) => staffRow(s, shifts, devices, actor.staffId));

  return (
    <>
      <ViewHeader page="/console/people/staff" />
      <StaffTable rows={rows} roles={identity.roles().map((r) => ({ value: r.id, label: r.name }))} canManage={identity.can(actor.staffId, 'staff.manage')} timezone={identity.outlet().timezone} />
    </>
  );
}
