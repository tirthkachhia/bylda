import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { nextBestActions } from "@/lib/crm";
import { GUEST_INSIGHTS, GUEST_LEADS, guestStore } from "@/lib/guest";
import { syncCrm } from "@/lib/queries";
import type {
  CanvasConnections,
  CrmProfile,
  OperatorAction,
  OperatorCall,
  OperatorDeal,
  OperatorTask,
} from "./types";

const db = supabase as any;

const DEMO_DEALS: OperatorDeal[] = [
  {
    id: "demo-acme",
    name: "Acme Corp — Platform rollout",
    company: "Acme Corp",
    stage: "Proposal",
    value: 82000,
    notes: "Sarah likes the product. Pricing is still the blocker. VP of Finance not on a call yet.",
    updatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    live: false,
    externalSource: "gohighlevel",
  },
  {
    id: "demo-northstar",
    name: "Northstar Logistics — Implementation",
    company: "Northstar Logistics",
    stage: "Qualified",
    value: 32000,
    notes: "Asked for implementation dates and pulled their VP into Thursday’s call.",
    updatedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    live: false,
  },
  {
    id: "demo-apex",
    name: "Apex — Recap pending",
    company: "Apex",
    stage: "Contacted",
    value: 18000,
    notes: "You owe Marcus a recap from yesterday’s call.",
    updatedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    live: false,
  },
];

const DEMO_CALLS: OperatorCall[] = [
  {
    id: "demo-call-acme",
    contactName: "Sarah Chen",
    company: "Acme Corp",
    direction: "outbound",
    status: "completed",
    duration: 1840,
    startedAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    summary:
      "They want to move, but procurement needs the security docs before they’ll approve anything.",
    objections: ["Price needs Finance cover", "Security packet not received"],
    nextSteps: ["Send security packet today", "Get VP of Finance on the next call"],
    competitors: [],
    writebackStatus: "pending_review",
    insightId: null,
    transcript:
      "Sarah: The product is a fit. Finance still needs enough ROI to defend the price. Legal said they’d send revisions yesterday and nothing came through.",
    coaching: "You got the pain, but the decision process is still fuzzy.",
    risk: "Close date is Friday and legal still hasn’t started.",
    provider: "readymode",
    live: false,
  },
  {
    id: "demo-call-northstar",
    contactName: "Maya Rodriguez",
    company: "Northstar Logistics",
    direction: "outbound",
    status: "completed",
    duration: 1574,
    startedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    summary: "Product fit is clear. They asked for implementation dates and brought their VP in.",
    objections: [],
    nextSteps: ["Hold Tuesday technical review", "Send implementation outline"],
    competitors: ["Gong"],
    writebackStatus: "pending_review",
    insightId: null,
    transcript:
      "Maya: If implementation stays under two weeks, that changes the conversation. We’re comparing this with Gong, but their package is heavier than what we need.",
    coaching: "Nice progress. Don’t spend the next call re-demoing features.",
    risk: null,
    provider: "readymode",
    live: false,
  },
];

const DEMO_TASKS: OperatorTask[] = [
  {
    id: "demo-task-1",
    title: "Send Acme the security packet",
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "high",
    status: "open",
    live: false,
  },
  {
    id: "demo-task-2",
    title: "Draft Apex recap for Marcus",
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "medium",
    status: "open",
    live: false,
  },
];

const DEMO_ACTIONS: OperatorAction[] = [
  {
    kind: "follow_up",
    title: "Get the Acme security packet out today",
    detail: "You promised Sarah yesterday. Nothing is sent yet.",
    score: 98,
    entityType: "lead",
    entityId: "demo-acme",
    live: false,
  },
  {
    kind: "prep",
    title: "Prep the Northstar call",
    detail: "Biggest thing to solve: who owns the final decision.",
    score: 86,
    entityType: "call",
    entityId: "demo-call-northstar",
    live: false,
  },
];

function asDeal(row: Record<string, unknown>): OperatorDeal {
  return {
    id: String(row.id),
    name: String(row.name ?? row.company ?? "Untitled deal"),
    company: String(row.company ?? row.name ?? "Unknown"),
    stage: String(row.stage ?? "New"),
    value: typeof row.value === "number" ? row.value : Number(row.value) || null,
    notes: typeof row.notes === "string" ? row.notes : null,
    email: typeof row.email === "string" ? row.email : null,
    source: typeof row.source === "string" ? row.source : null,
    externalSource: typeof row.external_source === "string" ? row.external_source : null,
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    live: true,
  };
}

export function useOperatorData(orgId: string | null, userId?: string | null) {
  const queryClient = useQueryClient();
  const guest = guestStore.get().isGuest;

  const profileQuery = useQuery({
    queryKey: ["canvas-crm-profile", orgId],
    enabled: Boolean(orgId) && !guest,
    queryFn: async (): Promise<CrmProfile | null> => {
      const { data, error } = await db
        .from("crm_intelligence_profiles")
        .select("status,generated_at,generated_profile")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) return null;
      return (data as CrmProfile | null) ?? null;
    },
  });

  const dealsQuery = useQuery({
    queryKey: ["canvas-deals", orgId],
    queryFn: async (): Promise<OperatorDeal[]> => {
      if (guest) {
        return GUEST_LEADS.filter((lead) => lead.stage !== "Lost").map((lead) => ({
          id: lead.id,
          name: lead.name,
          company: lead.company,
          stage: lead.stage,
          value: lead.value,
          notes: lead.notes,
          email: lead.email,
          source: lead.source,
          updatedAt: lead.updated_at,
          live: false,
        }));
      }
      if (!orgId) return DEMO_DEALS;
      const { data, error } = await supabase
        .from("leads")
        .select("id,name,company,stage,value,notes,email,source,external_source,updated_at,created_at")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []).map((row) => asDeal(row as Record<string, unknown>));
    },
  });

  const callsQuery = useQuery({
    queryKey: ["canvas-calls", orgId],
    queryFn: async (): Promise<OperatorCall[]> => {
      if (guest || !orgId) return DEMO_CALLS;
      const { data: calls, error } = await db
        .from("calls")
        .select(
          "id,contact_id,lead_id,direction,status,duration,started_at,disposition,from_number,to_number,provider,recording_url",
        )
        .eq("organization_id", orgId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(40);
      if (error || !calls?.length) return [];
      const callIds = calls.map((row: { id: string }) => row.id);
      const [{ data: insights }, { data: transcripts }, { data: contacts }, { data: leads }] =
        await Promise.all([
          db
            .from("call_insights")
            .select(
              "id,call_id,summary,objections,competitor_mentions,next_steps_extracted,writeback_status,vertical_insights",
            )
            .in("call_id", callIds),
          db
            .from("call_transcripts")
            .select("call_id,transcript_text")
            .in("call_id", callIds)
            .order("created_at", { ascending: false }),
          db.from("contacts").select("id,first_name,last_name,company").eq("organization_id", orgId),
          supabase.from("leads").select("id,name,company").eq("organization_id", orgId),
        ]);
      const insightByCall = new Map(
        ((insights ?? []) as Record<string, unknown>[]).map((row) => [String(row.call_id), row]),
      );
      const transcriptByCall = new Map<string, string>();
      for (const row of (transcripts ?? []) as { call_id: string; transcript_text?: string }[]) {
        if (!transcriptByCall.has(row.call_id) && row.transcript_text) {
          transcriptByCall.set(row.call_id, row.transcript_text);
        }
      }
      const contactById = new Map(
        ((contacts ?? []) as Record<string, unknown>[]).map((row) => [String(row.id), row]),
      );
      const leadById = new Map(
        ((leads ?? []) as Record<string, unknown>[]).map((row) => [String(row.id), row]),
      );
      return calls.map((call: Record<string, unknown>) => {
        const insight = insightByCall.get(String(call.id));
        const contact = call.contact_id ? contactById.get(String(call.contact_id)) : null;
        const lead = call.lead_id ? leadById.get(String(call.lead_id)) : null;
        const contactName = contact
          ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
          : String(lead?.name ?? "Unknown contact");
        const vertical = insight?.vertical_insights as
          | { deal_insights?: { coaching_note?: string; primary_risk?: string } }
          | undefined;
        return {
          id: String(call.id),
          contactName: contactName || "Unknown contact",
          company: String(contact?.company ?? lead?.company ?? lead?.name ?? "Unknown company"),
          direction: String(call.direction ?? "outbound"),
          status: String(call.status ?? "completed"),
          duration: typeof call.duration === "number" ? call.duration : null,
          startedAt: typeof call.started_at === "string" ? call.started_at : null,
          summary: typeof insight?.summary === "string" ? insight.summary : null,
          objections: Array.isArray(insight?.objections)
            ? insight.objections.map(String)
            : [],
          nextSteps: Array.isArray(insight?.next_steps_extracted)
            ? insight.next_steps_extracted.map(String)
            : [],
          competitors: Array.isArray(insight?.competitor_mentions)
            ? insight.competitor_mentions.map(String)
            : [],
          writebackStatus:
            typeof insight?.writeback_status === "string" ? insight.writeback_status : null,
          insightId: insight?.id ? String(insight.id) : null,
          transcript: transcriptByCall.get(String(call.id)) ?? null,
          coaching: vertical?.deal_insights?.coaching_note ?? null,
          risk: vertical?.deal_insights?.primary_risk ?? null,
          provider: typeof call.provider === "string" ? call.provider : null,
          recordingUrl: typeof call.recording_url === "string" ? call.recording_url : null,
          live: true,
        } satisfies OperatorCall;
      });
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["canvas-tasks", orgId],
    queryFn: async (): Promise<OperatorTask[]> => {
      if (guest || !orgId) return DEMO_TASKS;
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,due_date,priority,status")
        .eq("organization_id", orgId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(40);
      if (error) return [];
      const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        title: String(row.title ?? "Untitled"),
        dueDate: typeof row.due_date === "string" ? row.due_date : null,
        priority: String(row.priority ?? "medium"),
        status: String(row.status ?? "open"),
        live: true,
      }));
      return rows;
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["canvas-nba", orgId],
    enabled: Boolean(orgId) && !guest,
    retry: false,
    queryFn: async (): Promise<OperatorAction[]> => {
      const result = await nextBestActions(orgId!, false);
      return (result.actions ?? []).map((action) => ({
        kind: action.kind,
        title: action.title,
        detail: action.detail,
        score: action.score,
        entityType: action.entity_type,
        entityId: action.entity_id,
        live: true,
      }));
    },
  });

  const insightsQuery = useQuery({
    queryKey: ["canvas-insights", orgId],
    queryFn: async () => {
      if (guest || !orgId) return GUEST_INSIGHTS;
      const { data } = await db
        .from("mentor_insights")
        .select("id,title,detail,priority,type,created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const connectionsQuery = useQuery({
    queryKey: ["canvas-connections", userId],
    enabled: Boolean(userId) && !guest,
    queryFn: async (): Promise<CanvasConnections> => {
      const { data } = await db
        .from("user_integrations_masked")
        .select("integration_key,is_connected,status")
        .eq("user_id", userId);
      const rows = (data ?? []) as { integration_key: string; is_connected?: boolean; status?: string }[];
      const connected = (key: string) =>
        rows.some((row) => row.integration_key === key && (row.is_connected || row.status === "connected"));
      return {
        readymode: connected("readymode"),
        gohighlevel: connected("gohighlevel"),
        syncing: false,
        lastSync: null,
      };
    },
  });

  const connections: CanvasConnections = connectionsQuery.data ?? {
    readymode: false,
    gohighlevel: false,
    syncing: false,
    lastSync: null,
  };

  const signedIn = Boolean(orgId) && !guest;
  const liveSources = connections.readymode || connections.gohighlevel;
  let connectLater = false;
  try {
    connectLater = localStorage.getItem(`bylda-connect-later:${orgId ?? "local"}`) === "1";
  } catch {
    connectLater = false;
  }
  const useDemo = !signedIn || (!liveSources && connectLater);
  const deals = useDemo ? DEMO_DEALS : (dealsQuery.data ?? []);
  const calls = useDemo ? DEMO_CALLS : (callsQuery.data ?? []);
  const tasks = useDemo ? DEMO_TASKS : (tasksQuery.data ?? []);
  const actions = useDemo ? DEMO_ACTIONS : (actionsQuery.data ?? []);
  const usingDemo = useDemo;

  async function refreshLive() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["canvas-deals", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["canvas-calls", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["canvas-tasks", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["canvas-nba", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["canvas-connections", userId] }),
    ]);
  }

  async function syncGoHighLevelPipeline(quiet = false) {
    if (!orgId || guest) {
      if (!quiet) toast.message("Connect GoHighLevel on a live account to pull pipeline.");
      return;
    }
    try {
      const result = await syncCrm("gohighlevel");
      await refreshLive();
      if (quiet) return;
      const dealsIn = result.deals_imported ?? 0;
      const contactsIn = result.contacts_imported ?? 0;
      toast.success(
        dealsIn || contactsIn
          ? `GoHighLevel updated. ${contactsIn} contacts, ${dealsIn} deals.`
          : "GoHighLevel is connected. Nothing new to import yet.",
      );
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "Couldn’t sync GoHighLevel.");
    }
  }

  async function completeTask(task: OperatorTask) {
    if (!task.live || !orgId) {
      toast.message("Got it. I’ll leave that here for now.");
      return;
    }
    const next = task.status === "completed" ? "open" : "completed";
    const { error } = await supabase
      .from("tasks")
      .update({
        status: next,
        completed_at: next === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error("Couldn’t update that task.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["canvas-tasks", orgId] });
    toast.success(next === "completed" ? "Marked done." : "Reopened.");
  }

  async function approveWriteback(call: OperatorCall, userId?: string) {
    if (!call.live || !call.insightId) {
      toast.message("I’d leave the CRM unchanged until this is a live call.");
      return;
    }
    const { error } = await db
      .from("call_insights")
      .update({
        writeback_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: userId ?? null,
      })
      .eq("id", call.insightId);
    if (error) {
      toast.error("Couldn’t approve that CRM update.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["canvas-calls", orgId] });
    toast.success("CRM update approved. I didn’t push anything ambiguous.");
  }

  return {
    loading: dealsQuery.isLoading || callsQuery.isLoading,
    profile: profileQuery.data ?? null,
    profileLoading: Boolean(orgId) && !guest && profileQuery.isLoading,
    deals,
    calls,
    tasks,
    actions,
    insights: insightsQuery.data ?? [],
    usingDemo,
    connections,
    connectionsLoading: Boolean(userId) && !guest && connectionsQuery.isLoading,
    guest,
    completeTask,
    approveWriteback,
    syncGoHighLevelPipeline,
    refreshLive,
    refreshProfile: () => queryClient.invalidateQueries({ queryKey: ["canvas-crm-profile", orgId] }),
  };
}
