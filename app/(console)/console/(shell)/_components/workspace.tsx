import { EmptyState } from '@bliss/ui/components/feedback';
import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import { type WorkspaceKey, workspaceByKey } from '../_lib/nav';
import { WorkspaceChrome } from './workspace-chrome';

/**
 * A workspace: its title and one sentence from the nav manifest, its views as underline tabs, and
 * the view's content. A workspace that needs a permission refuses the whole of it without one, on
 * the server, rather than hiding a link. docs/19 section 4.5.
 */
export async function Workspace({
  workspace,
  counts = {},
  attention = [],
  actions,
  children,
}: {
  workspace: WorkspaceKey;
  /** A count beside a view: open tabs, lines in review. Keyed by the view's href. */
  counts?: Record<string, number | undefined>;
  /** Views whose count needs attention. */
  attention?: readonly string[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const w = workspaceByKey(workspace);
  const actor = await identity.currentConsoleActor();
  if (w.permission && !identity.can(actor.staffId, w.permission)) {
    return (
      <div className="flex flex-col gap-24">
        <WorkspaceChrome title={w.label} description={w.description} tabs={[]} />
        <EmptyState title={`${w.label} is not part of your role`} body={`${actor.role.name}s do not see ${w.label.toLowerCase()} here. An owner can change what your role can do in People, Roles.`} />
      </div>
    );
  }
  const tabs = w.pages.map((p) => ({ href: p.href, label: p.label, count: counts[p.href] || undefined, attention: attention.includes(p.href) }));
  return (
    <div className="flex flex-col">
      <WorkspaceChrome title={w.label} description={w.description} actions={actions} tabs={tabs} />
      <div className="pt-24">{children}</div>
    </div>
  );
}

/** One line of context above a view, and optionally its action. */
export function TabIntro({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-16 flex flex-wrap items-center justify-between gap-16">
      <p className="measure text-body-sm text-ink-muted">{children}</p>
      {action}
    </div>
  );
}
