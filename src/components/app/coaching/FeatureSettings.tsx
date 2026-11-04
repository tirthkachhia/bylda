import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { coachingManagerPermissionQuery } from "@/lib/queries";
import {
  coachingPreferencesQuery,
  saveCoachingPreferences,
  notificationPreferencesQuery,
  saveNotificationPreferences,
  DEFAULT_COACHING_PREFERENCES,
} from "@/lib/coaching/preferences";
import { csvText, downloadFile } from "@/lib/download";
import { WorkspaceTeams } from "./WorkspaceTeams";
import { ApiKeysSettings } from "./ApiKeysSettings";
import { PrivacySettings } from "./PrivacySettings";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export function FeatureSettings({ tab }: { tab: string }) {
  if (tab === "teams") return <WorkspaceTeams />;
  if (tab === "api") return <ApiKeysSettings />;
  if (tab === "privacy") return <PrivacySettings />;
  if (tab === "notifications") return <NotificationSettings />;
  if (tab === "rules" || tab === "objections" || tab === "success")
    return <PolicyLibrary key={tab} category={tab} />;
  if (tab === "audit") return <CoachingAudit />;
  return <AnalysisPreferences />;
}
export function AnalysisPreferences() {
  const { currentOrgId, user } = useAuth(),
    org = currentOrgId ?? "";
  const q = useQuery(coachingPreferencesQuery(org)),
    permission = useQuery(coachingManagerPermissionQuery(org, user?.id ?? "")),
    qc = useQueryClient();
  const [value, setValue] = useState(DEFAULT_COACHING_PREFERENCES),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    if (q.data) setValue(q.data);
  }, [q.data]);
  async function save() {
    setBusy(true);
    setStatus("");
    try {
      await saveCoachingPreferences(org, value);
      await qc.invalidateQueries({ queryKey: ["coaching-preferences", org] });
      setStatus(
        "Preferences saved. Coaching language applies to new analyses; retained results keep their original wording.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Preferences could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3">
      <h1>Workspace & analysis preferences</h1>
      <p className="text-xs">
        Managers can adjust the workspace’s coaching language, history window and recommendation
        confidence floor. A lower threshold cannot bypass source-evidence checks.
      </p>
      {q.error ? (
        <p role="alert">
          Preferences could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : (
        <>
          <label className="figma-field">
            Time zone
            <input
              value={value.time_zone}
              onChange={(e) => setValue((v) => ({ ...v, time_zone: e.target.value }))}
              placeholder="America/New_York"
            />
          </label>
          <label className="figma-field">
            Week starts on
            <select
              value={value.week_starts_on}
              onChange={(e) => setValue((v) => ({ ...v, week_starts_on: Number(e.target.value) }))}
            >
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                (d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="figma-field">
            Coaching language
            <select
              value={value.analysis_language}
              onChange={(e) => setValue((v) => ({ ...v, analysis_language: e.target.value }))}
            >
              {["English", "Spanish", "French", "German", "Portuguese", "Hindi"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="figma-field">
            Minimum confidence for coaching
            <select
              value={value.confidence_floor}
              onChange={(e) =>
                setValue((v) => ({ ...v, confidence_floor: e.target.value as "medium" | "high" }))
              }
            >
              <option value="medium">Medium or high</option>
              <option value="high">High only</option>
            </select>
          </label>
          <label className="figma-field">
            History window (days)
            <input
              type="number"
              min={30}
              max={180}
              value={value.history_days}
              onChange={(e) => setValue((v) => ({ ...v, history_days: Number(e.target.value) }))}
            />
          </label>
          <div className="flex gap-2">
            <button
              className="figma-button"
              disabled={busy || q.isPending || !permission.data}
              onClick={() => void save()}
            >
              Save preferences
            </button>
            <button
              className="figma-button"
              disabled={!permission.data || busy}
              onClick={() => setValue(DEFAULT_COACHING_PREFERENCES)}
            >
              Reset form to defaults
            </button>
          </div>
        </>
      )}
      {status && (
        <p role="status" className="text-xs">
          {status}
        </p>
      )}
    </section>
  );
}
export function NotificationSettings() {
  const { user } = useAuth();
  const q = useQuery(notificationPreferencesQuery(user?.id ?? "")),
    qc = useQueryClient();
  const [muted, setMuted] = useState<string[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (q.data) setMuted(q.data);
  }, [q.data]);
  const types = [
    ["*", "All in-app notifications"],
    ["coaching_report", "Report ready"],
    ["coaching_assignment", "Coaching assignment / check-in"],
    ["tool_output", "Other workspace activity"],
  ];
  return (
    <section className="space-y-4">
      <h1>Notification preferences</h1>
      <p className="text-xs">
        These settings control new in-app notifications. Existing notification history is retained.
        External delivery channels are managed through your connected providers.
      </p>
      {q.error ? (
        <p role="alert">
          Preferences could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : (
        types.map(([type, label]) => (
          <label className="flex gap-3 text-sm" key={type}>
            <input
              type="checkbox"
              checked={!muted.includes(type)}
              onChange={(e) =>
                setMuted((v) => (e.target.checked ? v.filter((t) => t !== type) : [...v, type]))
              }
            />
            {label}
          </label>
        ))
      )}
      <button
        className="figma-button"
        disabled={!user || q.isPending || !!q.error}
        onClick={() =>
          void saveNotificationPreferences(user!.id, muted)
            .then(async () => {
              await qc.invalidateQueries({ queryKey: ["notification-preferences", user!.id] });
              setMessage("Notification preferences saved.");
            })
            .catch((e) => setMessage(e.message))
        }
      >
        Save preferences
      </button>
      {message && <p role="status">{message}</p>}
      <Link className="figma-button" to="/app/integrations" search={{ tab: "delivery" } as never}>
        Manage delivery connections
      </Link>
    </section>
  );
}
function PolicyLibrary({ category }: { category: string }) {
  const { currentOrgId, user } = useAuth(),
    org = currentOrgId ?? "";
  const permission = useQuery(coachingManagerPermissionQuery(org, user?.id ?? "")),
    qc = useQueryClient();
  const prefix =
    category === "objections"
      ? "Objection"
      : category === "success"
        ? "Success criteria"
        : "Behavior rule";
  const q = useQuery({
    queryKey: ["policy-library", org],
    enabled: !!org,
    queryFn: async (): Promise<
      { id: string; title: string; version: number; content: string; source_url: string | null }[]
    > => {
      const { data, error } = await db
        .from("coaching_policy_versions")
        .select("id,title,version,content,source_url")
        .eq("organization_id", org)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const latest = [
    ...new Map(
      [...(q.data ?? [])]
        .reverse()
        .filter((p) => p.title.startsWith(`${prefix}: `))
        .map((p) => [p.title, p]),
    ).values(),
  ];
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const name = `${prefix}: ${title.trim()}`;
      const version =
        Math.max(0, ...(q.data ?? []).filter((p) => p.title === name).map((p) => p.version)) + 1;
      if (url && new URL(url).protocol !== "https:") throw new Error("Source URL must use HTTPS.");
      const { error } = await db.from("coaching_policy_versions").insert({
        organization_id: org,
        title: name,
        version,
        content: content.trim(),
        source_url: url.trim() || null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["policy-library", org] });
      setMessage(
        "Approved version saved. New analyses can cite this source; prior analyses keep their original source snapshot.",
      );
      setTitle("");
      setContent("");
      setUrl("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Source could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h1>{prefix} library</h1>
      <p className="text-xs">
        Company-approved coaching guidance. Each edit creates a new immutable version. Success
        criteria are objectives, not proof of an externally verified outcome.
      </p>
      {q.error ? (
        <p role="alert">
          Sources could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : (
        latest.map((p) => (
          <article key={p.id} className="rounded border p-3">
            <h2>
              {p.title} · v{p.version}
            </h2>
            <p className="my-2 whitespace-pre-wrap text-sm">{p.content}</p>
            {permission.data && (
              <button
                className="figma-button"
                onClick={() => {
                  setTitle(p.title.slice(prefix.length + 2));
                  setContent(p.content);
                  setUrl(p.source_url ?? "");
                }}
              >
                Create next version
              </button>
            )}
          </article>
        ))
      )}
      {permission.data && (
        <div className="rounded border p-4 space-y-3">
          <label className="figma-field">
            Title
            <input maxLength={170} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="figma-field">
            Guidance
            <textarea
              rows={5}
              minLength={8}
              maxLength={12000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <label className="figma-field">
            Source URL (optional)
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button
            className="figma-button"
            disabled={busy || !title.trim() || content.trim().length < 8 || !!q.error}
            onClick={() => void save()}
          >
            Approve and save version
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
function CoachingAudit() {
  const { currentOrgId } = useAuth();
  const q = useQuery({
    queryKey: ["coaching-audit", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async (): Promise<
      {
        id: string;
        actor_id: string | null;
        entity_type: string;
        entity_id: string;
        action: string;
        created_at: string;
      }[]
    > => {
      const { data, error } = await db
        .from("coaching_audit_log")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <section className="space-y-4">
      <h1>Coaching audit log</h1>
      <p className="text-xs">
        Latest 1,000 changes to notes, assignments, teams, rooms and preferences. Audit entries
        retain identifiers, not note bodies or credentials.
      </p>
      <button
        className="figma-button"
        disabled={!q.data?.length || !!q.error}
        onClick={() =>
          downloadFile(
            "coaching-audit.csv",
            csvText([
              ["Time", "Actor", "Entity", "ID", "Action"],
              ...(q.data ?? []).map((r) => [
                r.created_at,
                r.actor_id,
                r.entity_type,
                r.entity_id,
                r.action,
              ]),
            ]),
          )
        }
      >
        Export audit log
      </button>
      {q.error ? (
        <p role="alert">
          Audit log could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : (
        q.data?.map((r) => (
          <p key={r.id} className="text-xs">
            {new Date(r.created_at).toLocaleString()} · {r.entity_type} · {r.action} · {r.entity_id}
          </p>
        ))
      )}
    </section>
  );
}
