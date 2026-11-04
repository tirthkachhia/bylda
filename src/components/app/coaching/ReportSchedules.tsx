import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { repsQuery, coachingManagerPermissionQuery } from "@/lib/queries";
type Schedule = {
  id: string;
  rep_id: string;
  days: number;
  cadence: "daily" | "weekly";
  next_run_at: string;
  enabled: boolean;
  last_error: string | null;
  last_report_id: string | null;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export function ReportSchedules() {
  const { currentOrgId, user } = useAuth(),
    org = currentOrgId ?? "";
  const qc = useQueryClient(),
    reps = useQuery(repsQuery(org)),
    permission = useQuery(coachingManagerPermissionQuery(org, user?.id ?? "")),
    q = useQuery({
      queryKey: ["report-schedules", org],
      enabled: !!org,
      queryFn: async (): Promise<Schedule[]> => {
        const { data, error } = await db
          .from("coaching_report_schedules")
          .select("id,rep_id,days,cadence,next_run_at,enabled,last_error,last_report_id")
          .eq("organization_id", org)
          .order("next_run_at");
        if (error) throw error;
        return data ?? [];
      },
    });
  const [rep, setRep] = useState(""),
    [days, setDays] = useState(14),
    [cadence, setCadence] = useState("weekly"),
    [date, setDate] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function add() {
    setBusy(true);
    setError("");
    try {
      const time = new Date(date);
      if (!Number.isFinite(time.getTime()) || time.getTime() < Date.now())
        throw new Error("Choose a future first-run time.");
      const { error } = await db.from("coaching_report_schedules").insert({
        organization_id: org,
        rep_id: rep,
        days,
        cadence,
        next_run_at: time.toISOString(),
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["report-schedules", org] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border p-4 space-y-3" aria-label="Report schedules">
      <h2>Report schedules</h2>
      <p className="text-xs">
        Reports are saved in this workspace and appear in Notifications. Daily/weekly recurrence
        keeps the selected UTC time. The deployed scheduler checks every minute and processes queued
        work in order; busy workspaces may wait longer.
      </p>
      {permission.data && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <label className="figma-field">
            Rep
            <select value={rep} onChange={(e) => setRep(e.target.value)}>
              <option value="">Select a rep</option>
              {reps.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="figma-field">
            Cadence
            <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="figma-field">
            Days covered
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <label className="figma-field">
            First run (your local time)
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button className="figma-button" disabled={busy || !rep || !date}>
            Save schedule
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
          Schedules could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : q.isPending ? (
        <p>Loading schedules…</p>
      ) : (
        q.data?.map((s) => (
          <div key={s.id} className="rounded border p-3 text-xs">
            <p>
              {reps.data?.find((r) => r.id === s.rep_id)?.name ?? "Rep"} · {s.cadence} · {s.days}{" "}
              days · next {new Date(s.next_run_at).toLocaleString()}
            </p>
            {s.last_error && <p className="mt-2 text-red-700">Last attempt: {s.last_error}</p>}
            {s.last_report_id && (
              <Link
                className="underline mr-3"
                to="/app/crm/calls"
                search={{ view: "report", repId: s.rep_id, reportId: s.last_report_id }}
              >
                Latest report
              </Link>
            )}
            {permission.data && (
              <button
                className="figma-button mt-2"
                onClick={() => {
                  void db
                    .from("coaching_report_schedules")
                    .update({ enabled: !s.enabled })
                    .eq("id", s.id)
                    .eq("organization_id", org)
                    .select("id")
                    .maybeSingle()
                    .then(({ data, error }: { data: unknown; error: Error | null }) => {
                      if (error || !data) throw error ?? new Error("Permission denied");
                      return q.refetch();
                    })
                    .catch((e: Error) => setError(e.message));
                }}
              >
                {s.enabled ? "Pause" : "Resume"}
              </button>
            )}
          </div>
        ))
      )}
    </section>
  );
}
