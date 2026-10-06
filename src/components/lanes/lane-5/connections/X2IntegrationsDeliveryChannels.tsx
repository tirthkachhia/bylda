import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ContextPanel, DataBoundary, Tag } from "@/components/bylda";
import { mocksForced, useDataSources, useDeliveryChannels } from "@/lib/data";
import {
  ConnectionsAccess,
  ConnectionsEmpty,
  ConnectionsHeader,
  FeatureNotice,
  InsetNote,
  Monogram,
} from "./ConnectionsLayout";
import { channelRows, preview, routing, sourceRows } from "./demo";
import switchOn from "./assets/switch-on.svg";
import switchOff from "./assets/switch-off.svg";

/** X2 · Figma 31:1688 · Sources and delivery stay independent. */
export function X2IntegrationsDeliveryChannels() {
  const query = useDeliveryChannels();
  const sources = useDataSources();
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(routing);
  function toggle(name: string, column: "email" | "inApp" | "push") {
    setDraft((rows) =>
      rows.map((row) => (row.name === name ? { ...row, [column]: !row[column] } : row)),
    );
    setNotice("Routing preview only. Saving delivery preferences isn’t available yet.");
  }
  return (
    <ConnectionsAccess>
      <div className="flex flex-col gap-5 px-9 py-7 text-by-text-primary">
        <ConnectionsHeader
          active="channels"
          sources={
            sources.data
              ? sourceRows(sources.data).filter(
                  (s) => s.category !== "files" && s.category !== "calendar",
                ).length
              : undefined
          }
          channels={query.data?.length}
        />
        {notice && <FeatureNotice message={notice} onClose={() => setNotice("")} />}
        <DataBoundary query={query} empty={<ConnectionsEmpty channels />}>
          {(channels) => (
            <>
              <section
                aria-label="Delivery channels"
                className="overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised"
              >
                {channelRows(channels).map((channel) => (
                  <div
                    key={channel.key}
                    className="flex flex-wrap items-center gap-3.5 border-b border-by-border-engraved px-4 py-3 last:border-b-0"
                  >
                    <Monogram name={channel.name} />
                    <div className="min-w-0 flex-1">
                      <p className="type-ui-body-strong">{channel.name}</p>
                      <p className="type-ui-small text-by-text-secondary">
                        {channel.description}
                        {channel.destination ? ` · ${channel.destination}` : ""}
                      </p>
                    </div>
                    {channel.key !== "push" && (
                      <>
                        <Tag tone={channel.status === "connected" ? "improve" : "neutral"}>
                          {channel.status === "connected"
                            ? channel.key === "email"
                              ? "On"
                              : "Connected"
                            : "Not connected"}
                        </Tag>
                        <Button
                          variant={channel.status === "connected" ? "ghost" : "secondary"}
                          onClick={() =>
                            setNotice(
                              `${channel.name} ${channel.status === "connected" ? "management" : "connection"} isn’t available yet. Your existing delivery settings are unchanged.`,
                            )
                          }
                        >
                          {channel.status === "connected" ? "Manage" : "Connect"}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </section>
              <section className="overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
                <h2 className="type-ui-label px-4 py-3">ROUTING</h2>
                {mocksForced() ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left">
                      <thead className="type-mono-micro border-y border-by-border-engraved bg-by-surface-inset text-by-text-tertiary">
                        <tr>
                          {["WHAT", "EMAIL", "SLACK", "IN-APP", "PUSH"].map((label) => (
                            <th key={label} className="px-4 py-2 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {draft.map((row) => (
                          <tr
                            key={row.name}
                            className="border-b border-by-border-engraved last:border-b-0"
                          >
                            <td className="type-ui-small px-4 py-2.5">{row.name}</td>
                            <td className="px-4 py-2.5">
                              <RoutingSwitch
                                label={`${row.name}: email`}
                                checked={row.email}
                                onChange={() => toggle(row.name, "email")}
                              />
                            </td>
                            <td className="type-ui-small px-4 py-2.5">{row.slack}</td>
                            <td className="px-4 py-2.5">
                              <RoutingSwitch
                                label={`${row.name}: in-app`}
                                checked={row.inApp}
                                onChange={() => toggle(row.name, "inApp")}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <RoutingSwitch
                                label={`${row.name}: push`}
                                checked={row.push}
                                onChange={() => toggle(row.name, "push")}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="type-ui-small px-4 pb-4 text-by-text-secondary">
                    Routing preferences aren’t available yet.
                  </p>
                )}
              </section>
              <ContextPanel>
                <h2 className="type-ui-label text-by-text-primary">SLACK PREVIEW</h2>
                {mocksForced() ? (
                  <InsetNote title={preview.timestamp}>
                    <p className="type-ui-body-strong mb-2">{preview.title}</p>
                    <p className="text-by-text-secondary">{preview.body}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button variant="secondary" asChild>
                        <Link to="/app/reports/daily">Open brief</Link>
                      </Button>
                      <Button variant="secondary" asChild>
                        <Link to="/app/coaching/assign">Assign coaching</Link>
                      </Button>
                    </div>
                  </InsetNote>
                ) : (
                  <p className="type-ui-small text-by-text-secondary">
                    No delivery preview is available yet.
                  </p>
                )}
                <InsetNote title="WHY SEPARATE">
                  A team can use Gong as the source and Slack as the channel. Disconnecting a
                  channel never stops analysis.
                </InsetNote>
              </ContextPanel>
            </>
          )}
        </DataBoundary>
      </div>
    </ConnectionsAccess>
  );
}
function RoutingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      className="block h-[18px] w-8 rounded-by-pill focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <img alt="" src={checked ? switchOn : switchOff} />
    </button>
  );
}
