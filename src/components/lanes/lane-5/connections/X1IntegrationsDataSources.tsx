import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, cn, ContextPanel, DataBoundary, Tag } from "@/components/bylda";
import { mocksForced, useConnectSource, useDataSources, useDeliveryChannels } from "@/lib/data";
import {
  ConnectionsAccess,
  ConnectionsEmpty,
  ConnectionsHeader,
  FeatureNotice,
  InsetNote,
  Monogram,
} from "./ConnectionsLayout";
import { groups, health, sourceRows, type SourceRow } from "./demo";

/** X1 · Figma 31:1464 · Lane 5 — Mayur. */
export function X1IntegrationsDataSources() {
  const sources = useDataSources();
  const channels = useDeliveryChannels();
  const connect = useConnectSource();
  const [notice, setNotice] = useState("");
  function connectSource(row: SourceRow) {
    connect.mutate(row.key, {
      onSuccess: () => {
        if (mocksForced())
          setNotice(
            `${row.name} connection preview complete. Demo mode doesn’t change your integrations.`,
          );
      },
      onError: (error) => setNotice(error.message),
    });
  }
  return (
    <ConnectionsAccess>
      <div className="flex flex-col gap-5 px-9 py-7 text-by-text-primary">
        <ConnectionsHeader
          active="sources"
          sources={
            sources.data
              ? sourceRows(sources.data).filter(
                  (s) => s.category !== "files" && s.category !== "calendar",
                ).length
              : undefined
          }
          channels={channels.data?.length}
        />
        {notice && <FeatureNotice message={notice} onClose={() => setNotice("")} />}
        <DataBoundary query={sources} empty={<ConnectionsEmpty />}>
          {(data) => (
            <>
              {groups.map((group) => {
                const rows = sourceRows(data).filter((row) =>
                  group.categories.includes(row.category),
                );
                return rows.length ? (
                  <section key={group.label} className="flex flex-col gap-5">
                    <h2 className="type-ui-label text-by-text-secondary">{group.label}</h2>
                    <div className="overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
                      {rows.map((row) => (
                        <div
                          key={row.key}
                          className="flex flex-wrap items-center gap-3.5 border-b border-by-border-engraved px-4 py-3 last:border-b-0"
                        >
                          <Monogram name={row.name} />
                          <div className="min-w-0 flex-1">
                            <p className="type-ui-body-strong">{row.name}</p>
                            <p
                              className={cn(
                                "type-ui-small text-by-text-secondary",
                                row.status === "error" && "text-by-signal-regress",
                              )}
                            >
                              {row.description}
                              {row.detail ? ` · ${row.detail}` : ""}
                            </p>
                          </div>
                          <Tag
                            tone={
                              row.status === "connected"
                                ? "improve"
                                : row.status === "syncing"
                                  ? "info"
                                  : row.status === "error" || row.status === "disconnected"
                                    ? "regress"
                                    : "neutral"
                            }
                          >
                            {(
                              {
                                connected: "Connected",
                                syncing: "Syncing",
                                error: "Reconnect required",
                                disconnected: "Disconnected",
                                available: "Available",
                                not_connected: "Not connected",
                              } as Record<string, string>
                            )[row.status] ?? row.status}
                          </Tag>
                          {row.key === "hubspot" ? (
                            <Button variant="ghost" asChild>
                              <Link to="/app/connections/hubspot">Manage</Link>
                            </Button>
                          ) : row.key === "manual_upload" ? (
                            <Button variant="ghost" asChild>
                              <Link to="/app/calls/upload">Upload</Link>
                            </Button>
                          ) : row.status === "not_connected" ||
                            row.status === "error" ||
                            row.status === "disconnected" ? (
                            <Button
                              variant={row.status === "error" ? "primary" : "secondary"}
                              disabled={connect.isPending}
                              onClick={() => connectSource(row)}
                            >
                              {connect.isPending && connect.variables === row.key
                                ? "Connecting…"
                                : row.status === "not_connected"
                                  ? "Connect"
                                  : "Reconnect"}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setNotice(
                                  row.key === "csv_import"
                                    ? "CSV import isn’t available yet."
                                    : `${row.name} management isn’t available yet. Your current connection is unchanged.`,
                                )
                              }
                            >
                              {row.key === "csv_import" ? "Import" : "Manage"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null;
              })}
              <ContextPanel>
                <h2 className="type-ui-label text-by-text-primary">HEALTH</h2>
                {mocksForced() ? (
                  <dl>
                    {health.map(([label, value]) => (
                      <div
                        key={label}
                        className="flex gap-3 border-b border-by-border-engraved py-2"
                      >
                        <dt className="type-mono-micro w-[88px] shrink-0 text-by-text-tertiary">
                          {label}
                        </dt>
                        <dd className="type-ui-small">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="type-ui-small text-by-text-secondary">
                    Connection health metrics aren’t available yet.
                  </p>
                )}
                <InsetNote title="WHAT BYLDA READS">
                  Audio, transcripts, participants, timestamps; CRM opportunity stage, amount and
                  outcome. Bylda never writes to your CRM in V1.
                </InsetNote>
              </ContextPanel>
            </>
          )}
        </DataBoundary>
      </div>
    </ConnectionsAccess>
  );
}
