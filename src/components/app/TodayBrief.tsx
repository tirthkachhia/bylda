import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useGuest } from "@/lib/guest";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

// The generated schema predates the call-intelligence migrations.
const callDb: SupabaseClient = supabase;
type BriefInsight = { id: string; summary: string | null; writeback_status: string | null };

export function TodayBrief() {
  const { profile, currentOrgId } = useAuth();
  const { isGuest } = useGuest();
  const brief = useQuery({
    queryKey: ["revenue-daily-brief", currentOrgId],
    enabled: !!currentOrgId && !isGuest,
    queryFn: async () => {
      const [calls, insights, contacts] = await Promise.all([
        callDb
          .from("calls")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId!),
        callDb
          .from("call_insights")
          .select("id,summary,writeback_status")
          .eq("organization_id", currentOrgId!)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("org_id", currentOrgId!),
      ]);
      for (const result of [calls, insights, contacts]) if (result.error) throw result.error;
      return {
        calls: calls.count ?? 0,
        contacts: contacts.count ?? 0,
        insights: (insights.data ?? []) as BriefInsight[],
      };
    },
  });
  return (
    <section className="mx-auto max-w-5xl py-4 sm:py-8">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[.18em] text-neutral-400">
        Your daily brief
      </p>
      <h1 className="type-display-xl">
        Good to see you, {profile?.full_name?.split(" ")[0] || "there"}.
      </h1>
      <p className="mt-5 max-w-xl font-serif text-lg leading-relaxed text-neutral-500">
        Your conversations, the context behind them, and the next step. All in one place.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/app/integrations"
          className="rounded-by-control bg-by-surface-control-dark px-5 py-3 text-xs text-by-text-on-control"
        >
          Connect your sales stack ↗
        </Link>
        <Link to="/app/crm/calls" className="rounded-by-control border border-by-border-control px-5 py-3 text-xs">
          Review conversations
        </Link>
        <Link to="/app/crm/setup" className="rounded-by-control border border-by-border-control px-5 py-3 text-xs">
          Configure CRM intelligence
        </Link>
      </div>
      <div className="mt-14 border-t border-black/10 pt-6">
        <div className="mb-7 flex items-center justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
            From your latest conversations
          </h2>
          <button
            disabled={brief.isFetching || isGuest || !currentOrgId}
            onClick={() => void brief.refetch()}
            aria-label="Refresh daily brief"
            className="p-2 disabled:opacity-30"
          >
            <RefreshCw size={14} className={brief.isFetching ? "animate-spin" : ""} />
          </button>
        </div>
        {isGuest ? (
          <p className="text-sm text-neutral-500">
            Preview workspace. Sign in and connect a source to see real conversation insights.
          </p>
        ) : !currentOrgId ? (
          <p className="text-sm text-neutral-500">
            Select or create your workspace in{" "}
            <Link to="/app/settings" className="underline">
              Settings
            </Link>{" "}
            to load your brief.
          </p>
        ) : brief.isError ? (
          <p role="alert" className="text-sm text-red-700">
            Your brief couldn’t load. Refresh to retry; no sample data has been substituted.
          </p>
        ) : brief.isPending ? (
          <p role="status" className="text-sm text-neutral-500">
            Reading your workspace…
          </p>
        ) : brief.data?.insights.length ? (
          brief.data.insights.map((insight, i) => (
            <article key={insight.id} className="mb-4 flex gap-5 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-6">
              <span className="pt-1 font-mono text-xs text-neutral-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  {insight.writeback_status === "written"
                    ? "Written to CRM"
                    : "Review before CRM update"}
                </p>
                <p className="type-editorial-insight">
                  {insight.summary ||
                    "Conversation imported. Open the review to check its analysis."}
                </p>
                <Link
                  to="/app/crm/calls"
                  className="mt-4 inline-block rounded-full border border-black/10 px-4 py-2 text-xs"
                >
                  Open call review →
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="py-5">
            <h3 className="font-serif text-2xl">Your next conversation starts here.</h3>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Connect a CRM, sync its available calls and transcripts, then review the extracted
              insights before writing them back.
            </p>
            <Link
              to="/app/integrations"
              className="mt-5 inline-block text-sm underline underline-offset-4"
            >
              Set up an integration →
            </Link>
          </div>
        )}
      </div>
      {brief.data && !isGuest && (
        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-black/10 pt-7">
          <p>
            <span className="mr-3 font-serif text-3xl">{brief.data.calls}</span>
            <span className="text-xs text-neutral-500">Imported calls</span>
          </p>
          <p>
            <span className="mr-3 font-serif text-3xl">{brief.data.contacts}</span>
            <span className="text-xs text-neutral-500">CRM contacts</span>
          </p>
        </div>
      )}
    </section>
  );
}
