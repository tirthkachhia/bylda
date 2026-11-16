import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCoachingWorkspaceAccess } from "@/lib/coaching/workspace-access";
import type { SavedReport } from "@/lib/coaching/report-views";

export function useSavedReports() {
  const { currentOrgId, user } = useAuth();
  const access = useCoachingWorkspaceAccess();
  const query = useQuery({
    queryKey: [
      "workspace-coaching-reports",
      currentOrgId,
      user?.id,
      access.manager,
      access.rep?.id,
    ],
    enabled: !!currentOrgId && !access.error && Boolean(access.manager || access.rep),
    refetchInterval: (query) =>
      query.state.data?.some((report) => report.status === "running") ? 10_000 : false,
    queryFn: async () => {
      const reports: SavedReport[] = [];
      for (let from = 0; ; from += 500) {
        let query = supabase
          .from("coaching_reports" as never)
          .select(
            "id,rep_id,period_start,period_end,call_count,status,report,created_at,adherence:input->adherence",
          )
          .eq("organization_id", currentOrgId!)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + 499);
        if (access.rep) query = query.eq("rep_id", access.rep.id);
        const { data, error } = await query;
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Report history unavailable");
        const rows = data as unknown as SavedReport[];
        reports.push(...rows);
        if (rows.length < 500) return reports;
      }
    },
  });
  return { access, query };
}
