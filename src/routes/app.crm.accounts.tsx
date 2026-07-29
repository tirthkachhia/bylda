/**
 * CUSTOMER HEALTH — /app/crm/accounts
 *
 * The Customer Success surface over the customer_accounts table: health score,
 * MRR, renewal proximity and stage per account, at-risk first. "Recompute
 * health" runs the cs-health edge function on demand (it also runs nightly via
 * cron); the churn/health signals it raises feed Mo Latif's retention coaching.
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, RefreshCw, DollarSign, CalendarClock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { refreshCustomerHealth } from "@/lib/crm";
import { CustomersNav } from "@/components/app/CustomersNav";
import { toast } from "sonner";

export const Route = createFileRoute("/app/crm/accounts")({ component: AccountsPage });

// customer_accounts isn't in the generated Supabase types yet; cast like the
// other CRM surfaces do for not-yet-typed tables. Result is typed as Account[].
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Account = {
  id: string;
  name: string;
  stage: string | null;
  health_score: number | null;
  mrr: number | null;
  renewal_date: string | null;
  churned_at: string | null;
};

function healthColor(score: number | null): string {
  if (score == null) return "var(--text-faint)";
  if (score >= 70) return "var(--success)";
  if (score >= 40) return "var(--warning)";
  return "var(--destructive)";
}

function healthLabel(score: number | null): string {
  if (score == null) return "Unscored";
  if (score >= 70) return "Healthy";
  if (score >= 40) return "At risk";
  return "Critical";
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function AccountsPage() {
  const { currentOrgId } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await db
      .from("customer_accounts")
      .select("id, name, stage, health_score, mrr, renewal_date, churned_at")
      .eq("organization_id", currentOrgId)
      .order("health_score", { ascending: true, nullsFirst: false });
    setAccounts((data as Account[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function recompute() {
    if (!currentOrgId) return;
    setRecomputing(true);
    try {
      const r = await refreshCustomerHealth(currentOrgId);
      toast.success(
        `Health recomputed for ${r.accounts_scored} account${r.accounts_scored === 1 ? "" : "s"}`,
      );
      await load();
    } catch {
      toast.error("Couldn't recompute health");
    } finally {
      setRecomputing(false);
    }
  }

  const active = accounts.filter((a) => !a.churned_at);
  const totalMrr = active.reduce((s, a) => s + Number(a.mrr ?? 0), 0);
  const atRisk = active.filter((a) => (a.health_score ?? 100) < 40).length;

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <CustomersNav />
        </div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--text-primary]">
              Customer Health
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">
              {active.length} active · ${totalMrr.toLocaleString()} MRR · {atRisk} at risk
            </p>
          </div>
          <button
            onClick={recompute}
            disabled={!currentOrgId || recomputing}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            <RefreshCw className={`h-4 w-4 ${recomputing ? "animate-spin" : ""}`} />
            {recomputing ? "Recomputing…" : "Recompute health"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[--bg-surface-2]" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
            <HeartPulse className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--text-primary]">
              No customer accounts yet
            </p>
            <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
              Won deals become accounts you can track for health, renewals, and churn risk.
              Recompute once you have customers to score.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[--border] text-left">
                  {["Account", "Health", "Stage", "MRR", "Renewal"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[--text-muted]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const days = daysUntil(a.renewal_date);
                  return (
                    <tr key={a.id} className="border-b border-[--border] last:border-b-0">
                      <td className="px-4 py-3.5 text-sm font-medium text-[--text-primary]">
                        {a.name}
                        {a.churned_at && (
                          <span className="ml-2 text-[11px] font-semibold text-[--destructive]">
                            Churned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              color: healthColor(a.health_score),
                              background: `color-mix(in oklab, ${healthColor(a.health_score)} 12%, transparent)`,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: healthColor(a.health_score) }}
                            />
                            {a.health_score ?? "—"} · {healthLabel(a.health_score)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[--text-secondary]">
                        {a.stage ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[--text-secondary]">
                        {a.mrr ? (
                          <span className="inline-flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5 text-[--text-faint]" />
                            {Number(a.mrr).toLocaleString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        {a.renewal_date ? (
                          <span
                            className="inline-flex items-center gap-1"
                            style={{
                              color:
                                days != null && days <= 30
                                  ? "var(--warning)"
                                  : "var(--text-secondary)",
                            }}
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            {days != null && days >= 0 ? `${days}d` : "overdue"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
