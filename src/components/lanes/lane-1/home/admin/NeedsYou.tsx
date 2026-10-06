import { Link } from "@tanstack/react-router";
import { Button, Icon, SkeletonBlock } from "@/components/bylda";
import { useDataSources, type WorkspaceHealth } from "@/lib/data";
import { needsYou } from "./summary";

/**
 * Things that need the owner (Figma 31:10035). Alert text comes from the health alerts; a broken
 * source with no alert still gets a card (see `needsYou`). The Figma's "Notify Rob" has no
 * mutation behind it — LANE_REQUESTS #52 — so only the reconnect action is built.
 */
export function NeedsYou({ health }: { health: WorkspaceHealth }) {
  const sources = useDataSources();
  if (sources.isLoading) return <SkeletonBlock height={110} className="rounded-by-card" />;
  const items = needsYou(health, sources.data ?? []);
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => (
        <section
          key={item.id}
          className="flex w-full flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4"
        >
          <p className="type-mono-micro flex items-center gap-2 text-by-text-secondary">
            <Icon name="alert" size={11} />
            {item.source ? "NEEDS YOU · INTEGRATION" : "NEEDS YOU"}
          </p>
          <p className="type-editorial-insight text-by-text-primary">{item.title}</p>
          {item.source ? (
            <div className="flex gap-2">
              <Button asChild variant="primary">
                <Link to="/app/connections">Reconnect {item.source.name}</Link>
              </Button>
            </div>
          ) : null}
        </section>
      ))}
    </>
  );
}
