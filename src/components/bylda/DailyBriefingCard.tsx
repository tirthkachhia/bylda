// Daily briefing — Bylda's overnight check, in the app instead of only Slack.
// Shows the latest org_briefings row (written by the bylda-pulse worker each
// morning): what Bylda found, the one recommended action, and a link to the
// monitoring surface. Renders nothing when there's no recent briefing, so
// quiet accounts stay quiet.

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ClosedLoopChip } from "@/components/app/ClosedLoopChip";
import { AiOriginCard } from "@/components/bylda/AiOriginCard";

interface BriefingRow {
  briefing_date: string;
  alert_count: number;
  critical_loop_count: number;
  overdue_outcome_count: number;
  top_alert: { severity: string; title: string; diagnosis: string | null } | null;
  recommended_action: string;
}

const MAX_AGE_DAYS = 3;

function briefingQuery(orgId: string) {
  return {
    queryKey: ["org_briefings", orgId],
    queryFn: async (): Promise<BriefingRow | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("org_briefings")
        .select(
          "briefing_date, alert_count, critical_loop_count, overdue_outcome_count, top_alert, recommended_action",
        )
        .eq("org_id", orgId)
        .order("briefing_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as BriefingRow | null) ?? null;
    },
    staleTime: 5 * 60_000,
  };
}

function dayLabel(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return "this morning";
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (iso === yesterday) return "yesterday";
  return iso;
}

export function DailyBriefingCard() {
  const { currentOrgId } = useAuth();
  const q = useQuery({ ...briefingQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const b = q.data;
  if (!b) return null;

  const ageDays = (Date.now() - new Date(b.briefing_date).getTime()) / 864e5;
  if (ageDays > MAX_AGE_DAYS) return null;

  const counts = [
    { n: b.alert_count, label: "open alerts" },
    { n: b.critical_loop_count, label: "critical loops" },
    { n: b.overdue_outcome_count, label: "outcomes due soon" },
  ].filter((c) => c.n > 0);

  return (
    <div>
      <div
        className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em]"
        style={{ color: "var(--text-faint)" }}
      >
        Daily briefing{" "}
        <ClosedLoopChip kind="updated" label={`Bylda checked ${dayLabel(b.briefing_date)}`} />
      </div>
      <AiOriginCard
        icon={Radar}
        label="Bylda's read"
        action={
          <Link
            to="/app/monitoring"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] px-3.5 py-2 text-[12.5px] font-bold text-white"
            style={{ background: "var(--primary)" }}
          >
            Review <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {counts.length > 0 && <div>{counts.map((c) => `${c.n} ${c.label}`).join(" · ")}</div>}
        {b.top_alert && (
          <div className="mt-1 font-bold" style={{ color: "var(--foreground)" }}>
            Top alert [{b.top_alert.severity.toUpperCase()}]: {b.top_alert.title}
          </div>
        )}
        <div className="mt-1.5" style={{ color: "var(--foreground)" }}>
          <b style={{ fontWeight: 700 }}>Recommended:</b> {b.recommended_action}
        </div>
      </AiOriginCard>
    </div>
  );
}
