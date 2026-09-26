import { ButtonLink } from '@bliss/ui/components/button-link';
import { EmptyState } from '@bliss/ui/components/feedback';

/** A record that does not exist, or no longer does: say so, and offer the way back. */
export default function ConsoleNotFound() {
  return (
    <EmptyState
      title="This page does not exist"
      body="The record may have been removed, or the link is from somewhere else. Everything else in the Console is where it was."
      action={
        <ButtonLink href="/console/overview" variant="outline">
          Back to the overview
        </ButtonLink>
      }
    />
  );
}
