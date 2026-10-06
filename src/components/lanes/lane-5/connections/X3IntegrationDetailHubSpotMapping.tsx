import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ContextPanel, DataBoundary, StateEmpty, Tag } from "@/components/bylda";
import { mocksForced, useIntegrationDetail } from "@/lib/data";
import { ConnectionsAccess, FeatureNotice, InsetNote } from "./ConnectionsLayout";
import { connection, metrics, stages, unmatched, mappingRows } from "./demo";

/** X3 · Figma 31:1915 · CRM direction is always read-only. */
export function X3IntegrationDetailHubSpotMapping() {
  const query = useIntegrationDetail("hubspot");
  const [notice, setNotice] = useState("");
  return (
    <ConnectionsAccess>
      <div className="flex flex-col gap-5 px-9 py-7 text-by-text-primary">
        <nav aria-label="Breadcrumb" className="type-mono-micro flex gap-3 text-by-text-tertiary">
          <Link to="/app/connections">INTEGRATIONS</Link>
          <span>/</span>
          <Link to="/app/connections">DATA SOURCES</Link>
          <span>/</span>
        </nav>
        <DataBoundary
          query={query}
          empty={
            <StateEmpty
              title="HubSpot isn’t connected yet."
              body="Connect HubSpot from Data sources to view its mapping."
            />
          }
        >
          {(detail) =>
            detail && (
              <>
                <header className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <h1 className="type-editorial-h1">{detail.source.name}</h1>
                    <p className="type-ui-small text-by-text-secondary">
                      {mocksForced()
                        ? connection
                        : `${detail.source.status === "connected" ? "Connected" : "Not connected"} · read-only${detail.source.lastSyncAt ? ` · last synced ${new Date(detail.source.lastSyncAt).toLocaleString()}` : ""}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setNotice(
                          "Manual sync isn’t available yet. HubSpot continues to use its existing sync schedule.",
                        )
                      }
                    >
                      Sync now
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        setNotice(
                          "Disconnect isn’t available here yet. Your HubSpot connection is unchanged.",
                        )
                      }
                    >
                      Disconnect
                    </Button>
                  </div>
                </header>
                {notice && <FeatureNotice message={notice} onClose={() => setNotice("")} />}
                {mocksForced() ? (
                  <dl className="grid grid-cols-2 overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised lg:grid-cols-4">
                    {metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="border-r border-by-border-engraved px-4 py-3 last:border-r-0"
                      >
                        <dt className="type-mono-micro text-by-text-tertiary">{metric.label}</dt>
                        <dd className="type-ui-title mt-1">{metric.value}</dd>
                        {metric.detail && (
                          <p className="type-mono-micro mt-1 text-by-text-secondary">
                            {metric.detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="type-ui-small text-by-text-secondary">
                    Sync totals aren’t available yet.
                  </p>
                )}
                <section className="overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
                  <h2 className="type-ui-label px-4 py-3">FIELD MAPPING</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left">
                      <thead className="type-mono-micro border-y border-by-border-engraved bg-by-surface-inset text-by-text-tertiary">
                        <tr>
                          {["BYLDA FIELD", "HUBSPOT PROPERTY", "EXAMPLE", "STATUS"].map((label) => (
                            <th key={label} className="px-4 py-2 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mappingRows(detail.mappings).map((mapping) => (
                          <tr
                            key={mapping.field}
                            className="border-b border-by-border-engraved last:border-b-0"
                          >
                            <td className="type-ui-small px-4 py-2.5">{mapping.field}</td>
                            <td className="type-mono-data px-4 py-2.5 text-by-text-secondary">
                              {mapping.property}
                            </td>
                            <td className="type-ui-small px-4 py-2.5">{mapping.example}</td>
                            <td className="px-4 py-2.5">
                              {mapping.status === "Pick field" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNotice(
                                      "Field mapping edits aren’t available yet. Bylda only reads your CRM.",
                                    )
                                  }
                                >
                                  <Tag tone="attention">{mapping.status}</Tag>
                                </button>
                              ) : (
                                <Tag tone="improve">{mapping.status}</Tag>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <ContextPanel>
                  <h2 className="type-ui-label text-by-text-primary">STAGE MAPPING</h2>
                  {mocksForced() ? (
                    <>
                      <dl>
                        {stages.map(([stage, property]) => (
                          <div
                            key={stage}
                            className="flex gap-2.5 border-b border-by-border-engraved py-2"
                          >
                            <dt className="type-mono-micro w-24 shrink-0 text-by-text-tertiary">
                              {stage}
                            </dt>
                            <dd className="type-ui-small break-all">{property}</dd>
                          </div>
                        ))}
                      </dl>
                      <InsetNote title="UNMATCHED CALLS">{unmatched}</InsetNote>
                    </>
                  ) : (
                    <p className="type-ui-small text-by-text-secondary">
                      Stage mapping and unmatched call counts aren’t available yet.
                    </p>
                  )}
                </ContextPanel>
              </>
            )
          }
        </DataBoundary>
      </div>
    </ConnectionsAccess>
  );
}
