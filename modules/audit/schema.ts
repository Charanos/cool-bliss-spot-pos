import 'server-only';
import { dataset } from '../_data/source';

/** Audit owns the append-only audit log. No update and no delete path exists. */
export const auditTables = () => ({ events: dataset().auditEvents });
