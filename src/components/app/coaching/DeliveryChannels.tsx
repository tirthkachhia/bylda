import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
import { coachingManagerPermissionQuery } from "@/lib/queries";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Channel = { id: string; kind: string; label: string; enabled: boolean };
type Delivery = {
  id: string;
  channel_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
};
export function DeliveryChannels() {
  const { currentOrgId, user } = useAuth(),
    org = currentOrgId ?? "";
  const permission = useQuery(coachingManagerPermissionQuery(org, user?.id ?? ""));
  const q = useQuery({
      queryKey: ["coaching-delivery-channels", org],
      enabled: !!org,
      queryFn: async (): Promise<Channel[]> => {
        const { data, error } = await db
          .from("coaching_delivery_channels")
          .select("id,kind,label,enabled")
          .eq("organization_id", org)
          .order("created_at");
        if (error) throw error;
        return data ?? [];
      },
    }),
    log = useQuery({
      queryKey: ["coaching-delivery-log", org],
      enabled: !!org,
      queryFn: async (): Promise<Delivery[]> => {
        const { data, error } = await db
          .from("coaching_report_deliveries")
          .select("id,channel_id,status,error_message,created_at")
          .eq("organization_id", org)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return data ?? [];
      },
    });
  const [kind, setKind] = useState("slack"),
    [label, setLabel] = useState(""),
    [value, setValue] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function action(fields: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await invokeEdge(
        "coaching-delivery-channels",
        { organization_id: org, ...fields },
        { retries: 0 },
      );
      setValue("");
      await q.refetch();
      await log.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delivery configuration failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border p-4 space-y-4" aria-label="Report delivery channels">
      <h2>Report delivery</h2>
      <p className="text-xs">
        New reports queue a private workspace link for each enabled destination. Webhook URLs and
        email destinations are encrypted on the server. A provider acceptance is not confirmation
        that a recipient read the report.
      </p>
      {permission.data && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action({ action: "save", kind, label, value });
          }}
        >
          <label className="figma-field">
            Channel
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {["slack", "teams", "email", "webhook"].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="figma-field">
            Label
            <input value={label} maxLength={150} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="figma-field">
            {kind === "email" ? "Recipient email" : "Incoming webhook URL"}
            <input
              type={kind === "email" ? "email" : "password"}
              value={value}
              maxLength={4000}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className="text-xs">
            Saving enables delivery of newly generated reports to this destination. Email requires a
            configured SendGrid sender. Generic webhook hosts must be approved in the server
            allowlist. Slack and Teams use their incoming webhook / workflow URLs.
          </p>
          <button
            className="figma-button"
            disabled={busy || !label.trim() || !value.trim() || !!q.error}
          >
            Save and enable destination
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {q.error ? (
        <p role="alert">
          Delivery destinations could not load.{" "}
          <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : (
        q.data?.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded border p-3 text-sm">
            <span>
              {c.label} · {c.kind} · {c.enabled ? "Enabled" : "Paused"}
            </span>
            {permission.data && (
              <button
                className="figma-button"
                disabled={busy}
                onClick={() => void action({ action: "toggle", id: c.id, enabled: !c.enabled })}
              >
                {c.enabled ? "Pause" : "Enable"}
              </button>
            )}
          </div>
        ))
      )}
      <h3>Recent delivery attempts</h3>
      {log.error ? (
        <p role="alert">
          Delivery history could not load. <button onClick={() => void log.refetch()}>Retry</button>
        </p>
      ) : (
        log.data?.map((d) => (
          <article key={d.id} className="rounded border p-3 text-xs">
            <p>
              {q.data?.find((c) => c.id === d.channel_id)?.label ?? "Destination"} · {d.status} ·{" "}
              {new Date(d.created_at).toLocaleString()}
            </p>
            {d.error_message && <p className="my-2">{d.error_message}</p>}
            {permission.data && d.status === "failed" && (
              <button
                className="figma-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Retry this delivery? If the provider accepted an earlier interrupted request, this can send a duplicate.",
                    )
                  )
                    void action({ action: "retry", id: d.id });
                }}
              >
                Retry delivery
              </button>
            )}
          </article>
        ))
      )}
      <button className="figma-button" onClick={() => void log.refetch()}>
        Refresh delivery status
      </button>
    </section>
  );
}
