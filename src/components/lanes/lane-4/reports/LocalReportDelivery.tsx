import { Link } from "@tanstack/react-router";
import {
  Button,
  cn,
  DataBoundary,
  InsightCard,
  StateEmpty,
  StateError,
  SystemState,
  Wordmark,
} from "@/components/bylda";
import { ForbiddenForRoleError, useBrief, useViewer, type Brief, type Viewer } from "@/lib/data";
import {
  canReadDelivery,
  deliveryInsightAllowed,
  deliveryKind,
  matchesDelivery,
  type Delivery,
} from "./deliveryModel";
const sections = {
  email: [
    "The short version",
    "Coach today",
    "What changed",
    "Pattern watch",
    "Calls worth your time",
  ],
  print: ["Executive summary", "Team behavior", "Coaching priorities"],
  push: ["Today's focus"],
};
function Denied() {
  return (
    <SystemState
      eyebrow="Y9 · ACCESS RESTRICTED"
      title="This report isn't available to you."
      body="Open a report permitted for your role and subject."
    />
  );
}
function Missing({ title }: { title: string }) {
  return (
    <StateEmpty surface="bare" title={title} body="This brief does not supply this section yet." />
  );
}
function DeliveryBody({
  delivery,
  viewer,
  brief,
}: {
  delivery: Delivery;
  viewer: Viewer;
  brief: Brief | null;
}) {
  if (brief && !matchesDelivery(brief, viewer, delivery)) return <Denied />;
  const insights =
    brief?.sections
      .flatMap((s) => s.insights)
      .filter((i) => deliveryInsightAllowed(i, viewer, delivery)) ?? [];
  return (
    <>
      <header className="flex flex-col gap-3 border-b border-by-border-engraved pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Wordmark />
          <span className="type-mono-micro text-by-text-tertiary">
            {delivery === "push"
              ? "YOUR DAILY BRIEF"
              : delivery === "print"
                ? "CONFIDENTIAL · WEEKLY REPORT"
                : "DAILY MANAGER BRIEF"}
          </span>
        </div>
        <h1 className="type-editorial-h2">
          {delivery === "push"
            ? `Morning, ${viewer.name.split(" ")[0]}.`
            : (brief?.title ??
              (delivery === "print" ? "Weekly Sales Behavior Report" : "Daily Manager Brief"))}
        </h1>
        {brief && (
          <p className="type-ui-small text-by-text-secondary">
            {brief.period} · {viewer.team?.name ?? viewer.workspace?.name} · {brief.readMinutes} min
            read
          </p>
        )}
      </header>
      {!brief && <Missing title="No brief available yet." />}
      <div className="flex flex-col gap-6">
        {sections[delivery].map((heading, index) => (
          <section
            key={heading}
            className={cn(
              "flex flex-col gap-3",
              delivery === "push" && "bg-by-surface-rail px-4 py-3.5 text-by-text-on-dark",
            )}
          >
            <h2 className="type-editorial-insight">
              {delivery === "email" && index > 0 ? `${index}. ` : ""}
              {heading}
            </h2>
            <p
              className={cn(
                "type-ui-small text-by-text-secondary",
                delivery === "push" && "text-by-text-on-dark-muted",
              )}
            >
              {delivery === "push"
                ? "A personal focus and practice prompt haven't been supplied."
                : "The brief doesn't supply the structured summary, metrics or rows for this section."}
            </p>
          </section>
        ))}
      </div>
      {insights.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Supplied observations">
          <h2 className="type-editorial-insight">Supplied observations</h2>
          {insights.map((i) => (
            <InsightCard
              key={i.id}
              kind={i.kind}
              headline={i.headline}
              body={delivery === "push" ? undefined : (i.body ?? undefined)}
              confidence={i.confidence}
              sampleSize={i.sampleSize}
              sampleLabel={delivery === "push" ? undefined : (i.sampleLabel ?? undefined)}
              causalTested={i.causalTested}
            />
          ))}
        </section>
      )}
      {brief && insights.length === 0 && <Missing title="No publishable observations." />}
      <footer
        className={cn(
          "flex flex-col gap-3 border-t border-by-border-engraved pt-5",
          delivery === "print" && "mt-auto",
        )}
      >
        {delivery !== "push" && brief ? (
          <Button asChild className="self-start print:hidden">
            <Link
              to={delivery === "print" ? "/app/reports/weekly" : "/app/reports/daily"}
              search={(previous) => ({ ...previous, reportId: brief.id })}
            >
              Open full report
            </Link>
          </Button>
        ) : (
          <Button disabled className="self-start">
            {delivery === "push" ? "Review a call moment" : "Open full report"}
          </Button>
        )}
        <p className="type-ui-small text-by-text-tertiary">
          {delivery === "print"
            ? "Print view · confidence and sample sizes accompany each supplied observation."
            : "Delivery preview · sending and delivery schedules are not available here."}
        </p>
        {delivery === "push" && (
          <p className="type-ui-small text-by-text-secondary">
            Call ownership and clip duration are required before a moment can be linked.
          </p>
        )}
      </footer>
    </>
  );
}
function LoadedDelivery({ delivery, viewer }: { delivery: Delivery; viewer: Viewer }) {
  const query = useBrief(deliveryKind[delivery]);
  return (
    <DataBoundary
      query={query}
      empty={<DeliveryBody delivery={delivery} viewer={viewer} brief={null} />}
      error={(err) =>
        err instanceof ForbiddenForRoleError ? (
          <Denied />
        ) : (
          <StateError body="The report couldn't be loaded." onRetry={() => void query.refetch()} />
        )
      }
    >
      {(brief) => <DeliveryBody delivery={delivery} viewer={viewer} brief={brief} />}
    </DataBoundary>
  );
}
/** Lane-local email/push/A4 composition from saved references. */
export function LocalReportDelivery({ delivery }: { delivery: Delivery }) {
  const viewer = useViewer();
  return (
    <main
      className={cn(
        "min-h-screen bg-by-surface-canvas px-4 py-8 text-by-text-primary print:bg-by-surface-raised print:p-0",
        delivery === "print" && "px-0 py-0",
        delivery === "push" && "px-0",
      )}
    >
      <article
        className={cn(
          "mx-auto flex w-full flex-col gap-6 border border-by-border-engraved bg-by-surface-raised",
          delivery === "email" && "max-w-[640px] p-10 max-sm:p-6",
          delivery === "push" && "max-w-[420px] gap-3.5 px-8 py-7",
          delivery === "print" && "min-h-[1123px] max-w-[794px] p-16 max-sm:p-6 print:border-0",
        )}
      >
        <DataBoundary
          query={viewer}
          error={() => (
            <StateError
              body="Your access couldn't be checked."
              onRetry={() => void viewer.refetch()}
            />
          )}
          empty={<StateEmpty title="Sign in to view this report." />}
        >
          {(person) =>
            canReadDelivery(person, delivery) ? (
              <LoadedDelivery delivery={delivery} viewer={person} />
            ) : (
              <Denied />
            )
          }
        </DataBoundary>
      </article>
    </main>
  );
}
