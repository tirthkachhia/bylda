import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
export function RecordedOutcomes() {
  const { currentOrgId } = useAuth();
  const q = useQuery({
    queryKey: ["recorded-outcomes", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async (): Promise<
      {
        id: string;
        call_id: string;
        outcome: string;
        occurred_at: string;
        source_reference: string;
      }[]
    > => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("coaching_recorded_outcomes")
        .select("id,call_id,outcome,occurred_at,source_reference")
        .eq("organization_id", currentOrgId)
        .order("occurred_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <section className="rounded-xl border p-4 space-y-3">
      <h2>Manager-recorded outcomes</h2>
      <p className="text-xs">
        Latest 1,000 imported records. These are separately attributed business records, not
        inferred transcript conclusions or proof that a behavior caused the outcome.
      </p>
      {q.error ? (
        <p role="alert">
          Outcome records could not load. <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : q.isPending ? (
        <p>Loading outcome records…</p>
      ) : q.data?.length ? (
        q.data.map((r) => (
          <p key={r.id} className="text-sm">
            <Link className="underline" to="/app/crm/calls" search={{ callId: r.call_id }}>
              {r.outcome.replaceAll("_", " ")}
            </Link>{" "}
            · {new Date(r.occurred_at).toLocaleDateString()} ·{" "}
            {r.source_reference || "No source reference"}
          </p>
        ))
      ) : (
        <p className="text-xs">
          No manager-recorded outcomes yet. Import a CSV in Integrations to connect later business
          outcomes to the source calls.
        </p>
      )}
    </section>
  );
}
