/**
 * WAITLIST — /app/crm/waitlist  (platform admins only)
 *
 * Signups from the public usebylda.com/waitlist form, with all five
 * qualifying answers. Rows flip to 'joined' automatically (auth.users
 * trigger) when the person creates a platform account; admins can also
 * remove/restore entries manually. Reads waitlist_signups via is_admin RLS.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hourglass, UserCheck, UserX, RotateCcw, Mail, ShieldAlert, Loader2 } from "lucide-react";
import { CustomersNav } from "@/components/app/CustomersNav";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";

export const Route = createFileRoute("/app/crm/waitlist")({ component: WaitlistPage });

type Signup = {
  id: string;
  name: string;
  email: string;
  segment: string | null;
  bottleneck: string | null;
  revenue: string | null;
  ref: string | null;
  status: "waiting" | "invited" | "joined" | "removed";
  created_at: string;
  joined_at: string | null;
};

const FILTERS = ["Waiting", "Joined", "All"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_STYLES: Record<Signup["status"], { label: string; color: string; bg: string }> = {
  waiting: { label: "Waiting", color: "#b45309", bg: "rgba(245,158,11,0.12)" },
  invited: { label: "Invited", color: "#6d28d9", bg: "rgba(139,92,246,0.12)" },
  joined: { label: "Joined", color: "#15803d", bg: "rgba(34,197,94,0.12)" },
  removed: { label: "Removed", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

function WaitlistPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("Waiting");

  const signupsQ = useQuery({
    queryKey: ["crm", "waitlist_signups"],
    enabled: isAdmin,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("waitlist_signups")
        .select("id, name, email, segment, bottleneck, revenue, ref, status, created_at, joined_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Signup[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Signup["status"] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("waitlist_signups")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm", "waitlist_signups"] }),
  });

  const all = useMemo(() => signupsQ.data ?? [], [signupsQ.data]);
  const counts = useMemo(
    () => ({
      waiting: all.filter((s) => s.status === "waiting" || s.status === "invited").length,
      joined: all.filter((s) => s.status === "joined").length,
    }),
    [all],
  );
  const rows = useMemo(() => {
    if (filter === "Waiting")
      return all.filter((s) => s.status === "waiting" || s.status === "invited");
    if (filter === "Joined") return all.filter((s) => s.status === "joined");
    return all;
  }, [all, filter]);

  if (adminLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-8 w-8" style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Admins only
        </p>
        <p className="max-w-xs text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          The platform waitlist is only visible to Bylda administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-5 -my-5 md:-mx-7 md:-my-6">
      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2.5">
            <CustomersNav />
            <h1
              className="font-display text-[22px] font-bold tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              Waitlist
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {counts.waiting} waiting · {counts.joined} joined the platform
            </p>
          </div>
          <div
            className="flex rounded-lg p-0.5 gap-0.5"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium transition"
                style={{
                  background: filter === f ? "var(--surface)" : "transparent",
                  color: filter === f ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: filter === f ? "var(--shadow-card)" : "none",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {signupsQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl"
                style={{ background: "var(--surface-2)" }}
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl px-8 py-16 text-center"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <Hourglass className="mb-3 h-8 w-8" style={{ color: "var(--domain-customers)" }} />
            <p className="mb-1 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {filter === "Waiting" ? "No one is waiting right now" : "Nothing here yet"}
            </p>
            <p className="max-w-sm text-xs" style={{ color: "var(--muted-foreground)" }}>
              Signups from usebylda.com/waitlist land here with their answers, and move to Joined
              automatically when they create an account.
            </p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            {rows.map((s) => {
              const st = STATUS_STYLES[s.status];
              return (
                <div
                  key={s.id}
                  className="border-b px-5 py-4 last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {s.name}
                    </p>
                    <a
                      href={`mailto:${s.email}`}
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Mail className="h-3 w-3" />
                      {s.email}
                    </a>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ color: st.color, background: st.bg }}
                    >
                      {st.label}
                    </span>
                    <span
                      className="ml-auto text-[11px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {new Date(s.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {s.status === "joined" && s.joined_at
                        ? ` · joined ${new Date(s.joined_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                        : ""}
                    </span>
                  </div>

                  {/* The five qualifying answers */}
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <Answer label="Who they are" value={s.segment} />
                    <Answer label="Bottleneck" value={s.bottleneck} />
                    <Answer label="Revenue" value={s.revenue} />
                    {s.ref ? <Answer label="Source" value={s.ref} /> : null}
                  </div>

                  <div className="mt-2.5 flex gap-2">
                    {(s.status === "waiting" || s.status === "invited") && (
                      <>
                        <RowAction
                          icon={UserCheck}
                          label="Mark invited"
                          disabled={s.status === "invited" || setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: s.id, status: "invited" })}
                        />
                        <RowAction
                          icon={UserX}
                          label="Remove from list"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: s.id, status: "removed" })}
                        />
                      </>
                    )}
                    {s.status === "removed" && (
                      <RowAction
                        icon={RotateCcw}
                        label="Restore to waitlist"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: s.id, status: "waiting" })}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Answer({ label, value }: { label: string; value: string | null }) {
  return (
    <span style={{ color: "var(--muted-foreground)" }}>
      <span className="font-medium" style={{ color: "var(--foreground)" }}>
        {label}:
      </span>{" "}
      {value || "—"}
    </span>
  );
}

function RowAction({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof UserX;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition disabled:opacity-50"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--muted-foreground)",
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
