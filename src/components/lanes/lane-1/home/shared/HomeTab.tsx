import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
  systemStates,
} from "@/components/bylda";
import { ForbiddenForRoleError, useHomeFeed, type HomeFeed } from "@/lib/data";
import { TodayPanel } from "../feed/TodayPanel";
import { HomeFrame } from "./HomeFrame";

/**
 * One Manager Home tab (H1–H6): greeting + tab bar, the page-17 loading / error / empty /
 * manager-only states around `useHomeFeed`, and the "today" context panel every tab shares
 * (Figma 7:132 · 43:792). The tab body is the render prop.
 */
export function HomeTab({
  eyebrow,
  children,
}: {
  /** Mono eyebrow for the error state, e.g. "HOME · TEAM UPDATES". */
  eyebrow: string;
  children: (feed: HomeFeed) => ReactNode;
}) {
  const feed = useHomeFeed("all");
  const navigate = useNavigate();

  return (
    <HomeFrame>
      <DataBoundary
        query={feed}
        loading={<FeedSkeleton />}
        error={(err) =>
          err instanceof ForbiddenForRoleError ? (
            <SystemState
              eyebrow="HOME · MANAGER VIEW"
              tag={{ tone: "neutral", label: "Restricted" }}
              title="Manager Home is for managers."
              body="Your own calls, focus and progress live on your home."
              actions={[
                {
                  label: "Go to my home",
                  variant: "secondary",
                  onClick: () => void navigate({ to: "/app/rep" }),
                },
              ]}
            />
          ) : (
            <StateError
              eyebrow={eyebrow}
              body="Bylda couldn’t load your feed. Your calls are safe — try again."
              onRetry={() => void feed.refetch()}
            />
          )
        }
        empty={
          <SystemState
            {...systemStates.homeNoCalls({
              onConnect: () => void navigate({ to: "/app/connections" }),
              onUpload: () => void navigate({ to: "/app/calls/upload" }),
            })}
          />
        }
      >
        {(data) => (
          <>
            {children(data)}
            <TodayPanel feed={data} />
          </>
        )}
      </DataBoundary>
    </HomeFrame>
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function FeedSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3.5" aria-busy="true" aria-label="Loading feed">
      <div className="flex w-full flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[22px] py-5">
        <SkeletonBar width={140} height={10} />
        <SkeletonBar width="80%" height={22} />
        <SkeletonBar width="95%" height={12} />
        <SkeletonBar width="60%" height={12} />
      </div>
      {[0, 1, 2].map((i) => (
        <SkeletonBlock key={i} height={58} className="rounded-by-card" />
      ))}
    </div>
  );
}
