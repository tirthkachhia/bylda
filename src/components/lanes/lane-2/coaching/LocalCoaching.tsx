import type { ReactNode } from "react";
import { StateError, SystemState, systemStates } from "@/components/bylda";
import { ForbiddenForRoleError } from "@/lib/data";
export function LocalCoachingError({ error, retry }: { error: unknown; retry?: () => void }) {
  return error instanceof ForbiddenForRoleError ? (
    <LocalCoachingDenied />
  ) : (
    <StateError
      title="Coaching couldn’t load or save."
      body={error instanceof Error ? error.message : "Try again."}
      onRetry={retry}
    />
  );
}
export function LocalMissing({ children }: { children: ReactNode }) {
  return (
    <p className="type-ui-small rounded-by-control border border-by-border-engraved bg-by-surface-inset p-3 text-by-text-secondary">
      {children}
    </p>
  );
}
export function LocalCoachingDenied() {
  return (
    <SystemState
      {...systemStates.permissionDenied()}
      title="You don’t have access to this coaching view."
      body="Reps can view only their own coaching. Assignment is available to managers and coaches."
      actions={[]}
    />
  );
}
