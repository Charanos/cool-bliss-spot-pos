import 'server-only';
import { dataset } from '../_data/source';

/** Identity owns outlets, staff, roles, permissions, devices and sessions. */
export const identityTables = () => {
  const d = dataset();
  return { outlet: d.outlet, staff: d.staff, roles: d.roles, devices: d.devices, presence: d.presence };
};
