import 'server-only';
import { dataset } from '../_data/source';

/** Settlement owns bills, bill lines, tenders, refunds, drawer sessions and cash movements. */
export const settlementTables = () => {
  const d = dataset();
  return { bills: d.bills, billLines: d.billLines, tenders: d.tenders, drawerSessions: d.drawerSessions, cashMovements: d.cashMovements };
};
