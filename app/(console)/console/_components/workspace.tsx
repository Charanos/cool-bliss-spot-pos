import { PageHeader, RouteTabs, type TabLink } from '@bliss/ui/components/console/shell';
import type { ReactNode } from 'react';

/** A workspace: a title, one line of context, route tabs, and the tab's content. docs/06 section 7.4. */
export function Workspace({ title, description, tabs, actions, children }: { title: string; description?: ReactNode; tabs: TabLink[]; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <RouteTabs label={`${title} views`} tabs={tabs} />
      <div className="mt-24">{children}</div>
    </>
  );
}

/** One line of context above a table: a sentence and, optionally, an action. */
export function TabIntro({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-20 flex flex-wrap items-center justify-between gap-16">
      <p className="text-body text-ink-muted">{children}</p>
      {action}
    </div>
  );
}
