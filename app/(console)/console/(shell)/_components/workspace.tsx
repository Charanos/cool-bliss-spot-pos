import { PageHeader } from '@bliss/ui/components/console/shell';
import { EmptyState } from '@bliss/ui/components/feedback';
import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import { type WorkspaceKey, pageByHref, workspaceByKey } from '../_lib/nav';

/**
 * A workspace. Its views are tabs in the sheet's header, so here it only guards: a workspace that
 * needs a permission refuses the whole of it without one, on the server, rather than hiding a
 * link. docs/19 section 4.5.
 */
export async function Workspace({ workspace, children }: { workspace: WorkspaceKey; children: ReactNode }) {
  const w = workspaceByKey(workspace);
  const actor = await identity.currentConsoleActor();
  if (w.permission && !identity.can(actor.staffId, w.permission)) {
    return (
      <div className="flex flex-col gap-24">
        <PageHeader title={w.label} description={w.description} />
        <EmptyState title={`${w.label} is not part of your role`} body={`${actor.role.name}s do not see ${w.label.toLowerCase()} here. An owner can change what your role can do in People, Roles.`} />
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * A view's header: its name and one sentence from the nav manifest, so the tab, the breadcrumb,
 * the command menu and the page all call it the same thing. The page adds its actions and, at
 * most, the one figure it is about.
 */
export function ViewHeader({ page, actions, aside, badge }: { page: string; actions?: ReactNode; aside?: ReactNode; badge?: ReactNode }) {
  const { page: p } = pageByHref(page);
  return <PageHeader title={p.label} description={p.description} actions={actions} aside={aside} badge={badge} />;
}
