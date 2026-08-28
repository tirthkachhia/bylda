import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Clipboard,
  Loader2,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Unplug,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusPill } from "@/components/app/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { syncCrm, type CrmSyncResult } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/context-memory")({
  component: ContextMemoryBetaPage,
});

const db = supabase as any;

type CallRow = {
  id: string;
  provider: string | null;
  provider_call_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  status: string;
  started_at: string | null;
  created_at: string;
};

type LeadRow = {
  id: string;
  name: string;
  stage: string;
  company: string | null;
  external_source: string | null;
  updated_at: string;
};

type ContextPackage = {
  package_version: string;
  task: string;
  entity: { type: string; id: string } | null;
  business: {
    context_version: number | null;
    profile: Record<string, unknown>;
    sales_baseline: Record<string, unknown>;
  };
  account: Record<string, unknown> | null;
  deal: Record<string, unknown> | null;
  contacts: Array<Record<string, unknown>>;
  current_state: {
    memory_facts: Array<Record<string, unknown>>;
    call: Record<string, unknown> | null;
  };
  recent_activity: Array<Record<string, unknown>>;
  relevant_history: Array<{
    id: string;
    source_type: string;
    content: string;
    occurred_at?: string | null;
  }>;
  retrieved_evidence: Array<{
    id: string;
    source_type: string;
    content: string;
  }>;
  receipt: {
    context_version: number;
    generated_at: string;
    source_references: Array<{ id: string; type: string; label?: string }>;
    omissions: string[];
    token_estimate: number;
  };
};

type BetaStats = {
  rawObjects: number;
  externalMappings: number;
  calls: number;
  memoryChunks: number;
  packagesBuilt: number;
};

const EMPTY_STATS: BetaStats = {
  rawObjects: 0,
  externalMappings: 0,
  calls: 0,
  memoryChunks: 0,
  packagesBuilt: 0,
};

const CONTEXT_SOURCES = [
  { key: "hubspot", label: "HubSpot", kind: "CRM", color: "#FF7A59", slug: "hubspot" },
  { key: "salesforce", label: "Salesforce", kind: "CRM", color: "#00A1E0", slug: "salesforce" },
  { key: "close_io", label: "Close", kind: "CRM", color: "#1CE783", slug: "close" },
  { key: "gohighlevel", label: "GoHighLevel", kind: "CRM", color: "#F97316", slug: "gohighlevel" },
  { key: "pipedrive", label: "Pipedrive", kind: "CRM", color: "#017737", slug: "pipedrive" },
  { key: "stripe", label: "Stripe", kind: "Payments", color: "#635BFF", slug: "stripe" },
  { key: "notion", label: "Notion", kind: "Notes", color: "#111111", slug: "notion" },
] as const;

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const response = (error as { context?: Response }).context;
    const payload = response
      ? await response
          .clone()
          .json()
          .catch(() => null)
      : null;
    throw new Error(payload?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function readableDate(value: string | null | undefined) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function textValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function money(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function stageTone(stage: string): "success" | "destructive" | "warning" | "primary" | "muted" {
  const normalized = stage.toLowerCase();
  if (normalized.includes("won")) return "success";
  if (normalized.includes("lost")) return "destructive";
  if (normalized.includes("new") || !stage) return "muted";
  return "primary";
}

function personName(contact: Record<string, unknown>) {
  return (
    [textValue(contact.first_name), textValue(contact.last_name)].filter(Boolean).join(" ") ||
    textValue(contact.email) ||
    "Contact"
  );
}

function SourceMark({
  source,
  size = 28,
}: {
  source: (typeof CONTEXT_SOURCES)[number];
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (source.slug && !failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"
        style={{ width: size, height: size }}
      >
        <img
          src={`https://cdn.simpleicons.org/${source.slug}`}
          alt=""
          width={size - 10}
          height={size - 10}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold text-white"
      style={{ width: size, height: size, background: source.color }}
    >
      {source.label.slice(0, 1)}
    </span>
  );
}

function ContextMemoryBetaPage() {
  const { currentOrgId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectedSources, setConnectedSources] = useState<string[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [stats, setStats] = useState<BetaStats>(EMPTY_STATS);
  const [callWebhookUrl, setCallWebhookUrl] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [context, setContext] = useState<ContextPackage | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastSync, setLastSync] = useState<CrmSyncResult | null>(null);
  const [showWebhook, setShowWebhook] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrgId || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [
        integrationResult,
        callsResult,
        leadsResult,
        rawResult,
        mappingsResult,
        callCountResult,
        chunksResult,
        packagesResult,
        inbound,
      ] = await Promise.all([
        db
          .from("user_integrations")
          .select("integration_key,status")
          .eq("user_id", user.id)
          .eq("status", "connected")
          .in(
            "integration_key",
            CONTEXT_SOURCES.map((source) => source.key),
          ),
        db
          .from("calls")
          .select("id,provider,provider_call_id,contact_id,lead_id,status,started_at,created_at")
          .eq("organization_id", currentOrgId)
          .order("created_at", { ascending: false })
          .limit(30),
        db
          .from("leads")
          .select("id,name,stage,company,external_source,updated_at")
          .eq("organization_id", currentOrgId)
          .order("updated_at", { ascending: false })
          .limit(50),
        db
          .from("integration_raw_objects")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId),
        db
          .from("integration_external_objects")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId),
        db
          .from("calls")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId),
        db
          .from("context_memory_chunks")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId),
        db
          .from("context_package_runs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId),
        invokeFunction<{ configured: boolean; call_url?: string }>("get-inbound-url", {
          org_id: currentOrgId,
        }).catch(
          (): { configured: boolean; call_url?: string } => ({
            configured: false,
          }),
        ),
      ]);

      const firstError = [
        integrationResult.error,
        callsResult.error,
        leadsResult.error,
        rawResult.error,
        mappingsResult.error,
        callCountResult.error,
        chunksResult.error,
        packagesResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const nextCalls = (callsResult.data ?? []) as CallRow[];
      const nextLeads = (leadsResult.data ?? []) as LeadRow[];
      setConnectedSources(
        ((integrationResult.data ?? []) as Array<{ integration_key: string }>).map(
          (row) => row.integration_key,
        ),
      );
      setCalls(nextCalls);
      setLeads(nextLeads);
      setStats({
        rawObjects: rawResult.count ?? 0,
        externalMappings: mappingsResult.count ?? 0,
        calls: callCountResult.count ?? 0,
        memoryChunks: chunksResult.count ?? 0,
        packagesBuilt: packagesResult.count ?? 0,
      });
      setCallWebhookUrl(inbound.call_url ?? null);
      setSelectedEntity((current) => {
        if (current) return current;
        if (nextLeads[0]) return `lead:${nextLeads[0].id}`;
        if (nextCalls[0]) return `call:${nextCalls[0].id}`;
        return "";
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the beta backend");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => {
    const [type, id] = selectedEntity.split(":");
    return { type, id };
  }, [selectedEntity]);

  const selectedLead = leads.find((lead) => `lead:${lead.id}` === selectedEntity);
  const selectedCall = calls.find((call) => `call:${call.id}` === selectedEntity);
  const connectedCount = connectedSources.length;

  const syncSources = async () => {
    setSyncing(true);
    try {
      const result = await syncCrm(connectedSources);
      setLastSync(result);
      const failed = result.results.filter((item) => item.error);
      if (failed.length && failed.length === result.results.length) {
        throw new Error(failed[0]?.error ?? "CRM sync failed");
      }
      toast.success("Pipeline refreshed", {
        description: `${result.contacts_imported} contacts and ${result.deals_imported} deals pulled in${
          failed.length ? `. ${failed.length} source(s) need a reconnect.` : "."
        }`,
      });
      await load();
    } catch (error) {
      toast.error("Could not refresh your pipeline", {
        description:
          error instanceof Error ? error.message : "Reconnect the integration and retry.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const buildPackage = async (entity = selectedEntity) => {
    const [type, id] = entity.split(":");
    if (!currentOrgId || !id) return;
    setAssembling(true);
    try {
      const response = await invokeFunction<{ context: ContextPackage }>("context-package", {
        organization_id: currentOrgId,
        task: "beta_context_inspection",
        ...(type === "call" ? { call_id: id } : { lead_id: id }),
        token_budget: 6000,
      });
      setContext(response.context);
      toast.success("Deal briefing is ready");
      await load();
    } catch (error) {
      toast.error("Could not build this briefing", {
        description: error instanceof Error ? error.message : "Check the beta backend deployment.",
      });
    } finally {
      setAssembling(false);
    }
  };

  const openEntity = async (entity: string) => {
    setSelectedEntity(entity);
    await buildPackage(entity);
  };

  const analyzeCall = async () => {
    if (selected.type !== "call" || !selected.id) return;
    setAnalyzing(true);
    try {
      await invokeFunction("analyze-call", { call_id: selected.id });
      toast.success("Call notes added to this briefing");
      await buildPackage();
    } catch (error) {
      toast.error("Call analysis failed", {
        description:
          error instanceof Error
            ? error.message
            : "Confirm that ANTHROPIC_API_KEY is configured in the development project.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const copyWebhook = async () => {
    if (!callWebhookUrl) return;
    await navigator.clipboard.writeText(callWebhookUrl);
    toast.success("Dialer webhook copied");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your pipeline memory…</p>
      </div>
    );
  }

  const deal = context?.deal ?? null;
  const account = context?.account ?? null;
  const contacts = context?.contacts ?? [];
  const facts = context?.current_state.memory_facts ?? [];
  const history = context?.relevant_history ?? [];
  const activity = context?.recent_activity ?? [];
  const evidence = context?.retrieved_evidence ?? [];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-5 md:p-8">
      <PageHeader
        eyebrow="Context beta"
        title="Deal memory"
        description="See what Bylda already knows about a live deal before the next call — account, people, history, and the notes that should change how you sell."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <Unplug className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <div className="font-medium">Backend is not ready yet</div>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          </div>
        </div>
      )}

      <section className="glass-card relative overflow-hidden rounded-3xl p-5 md:p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl"
          style={{ background: "color-mix(in oklab, var(--domain-customers) 45%, transparent)" }}
        />
        <div className="relative space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <StatusPill tone="primary">Live CRM memory</StatusPill>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">
                {connectedCount
                  ? `${connectedCount} source${connectedCount === 1 ? "" : "s"} feeding your pipeline`
                  : "Connect a CRM to start remembering deals"}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                HubSpot, Salesforce, Close, and the rest of your stack land in one briefing — not
                another spreadsheet.
              </p>
            </div>
            <Button
              size="lg"
              disabled={!connectedCount || syncing}
              onClick={() => void syncSources()}
            >
              {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Refresh pipeline
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Deals in memory", value: leads.length, hint: "Open opportunities" },
              { label: "People linked", value: stats.externalMappings, hint: "CRM identities" },
              { label: "Calls captured", value: stats.calls, hint: "From your dialer" },
              { label: "Notes remembered", value: stats.memoryChunks, hint: "Transcripts & docs" },
              { label: "Briefings built", value: stats.packagesBuilt, hint: "Ready for the next call" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-background/40 p-4">
                <div className="text-2xl font-semibold tracking-tight">{item.value}</div>
                <div className="mt-1 text-sm font-medium">{item.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{item.hint}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {CONTEXT_SOURCES.map((source) => {
              const connected = connectedSources.includes(source.key);
              return (
                <Link
                  key={source.key}
                  to="/app/integrations"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    connected
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-border bg-background/50 hover:bg-muted/60",
                  )}
                >
                  <SourceMark source={source} size={22} />
                  <span className="font-medium">{source.label}</span>
                  {connected ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Connect</span>
                  )}
                </Link>
              );
            })}
          </div>

          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Last refresh brought in {lastSync.contacts_imported} contacts and{" "}
              {lastSync.deals_imported} deals
              {lastSync.results.some((item) => item.error)
                ? ". One or more sources need a reconnect."
                : "."}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-3xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Choose a deal</div>
                <p className="text-xs text-muted-foreground">Open the briefing Bylda will use.</p>
              </div>
              <Badge variant="secondary">{leads.length}</Badge>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {leads.slice(0, 12).map((lead) => {
                const active = selectedEntity === `lead:${lead.id}`;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => void openEntity(`lead:${lead.id}`)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent bg-muted/40 hover:bg-muted/70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{lead.name}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {lead.company || "No account yet"}
                        </div>
                      </div>
                      <StatusPill tone={stageTone(lead.stage)}>{lead.stage || "New"}</StatusPill>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {lead.external_source ? lead.external_source.replace("_", " ") : "Bylda"} ·{" "}
                      {readableDate(lead.updated_at)}
                    </div>
                  </button>
                );
              })}
              {!leads.length && (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  No deals yet. Connect a CRM and refresh the pipeline.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Recent calls</div>
                <p className="text-xs text-muted-foreground">Link a conversation to the deal.</p>
              </div>
              <Badge variant="secondary">{calls.length}</Badge>
            </div>
            <div className="space-y-2">
              {calls.slice(0, 5).map((call) => {
                const active = selectedEntity === `call:${call.id}`;
                return (
                  <button
                    key={call.id}
                    type="button"
                    onClick={() => void openEntity(`call:${call.id}`)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3 text-left",
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent bg-muted/40 hover:bg-muted/70",
                    )}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background">
                      <PhoneCall className="h-4 w-4 text-primary" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {call.provider ?? "Dialer"} call
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {readableDate(call.started_at ?? call.created_at)} · {call.status}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!calls.length && (
                <p className="text-xs text-muted-foreground">
                  No calls in yet. Connect your dialer when you are ready.
                </p>
              )}
            </div>

            <div className="mt-4 border-t pt-3">
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() => setShowWebhook((open) => !open)}
              >
                {showWebhook ? "Hide dialer setup" : "Connect a dialer"}
              </button>
              {showWebhook && (
                <div className="mt-3 space-y-2">
                  {callWebhookUrl ? (
                    <>
                      <code className="block max-h-20 overflow-auto rounded-xl bg-muted p-3 text-[11px] leading-relaxed">
                        {callWebhookUrl}
                      </code>
                      <Button className="w-full" variant="outline" onClick={() => void copyWebhook()}>
                        <Clipboard />
                        Copy webhook
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ask an admin to set the inbound webhook secret, then refresh.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="min-h-[720px] overflow-hidden rounded-3xl border bg-card">
          <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight">
                {selectedLead?.name ||
                  (selectedCall ? `${selectedCall.provider ?? "Dialer"} call` : "Deal briefing")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedLead
                  ? `${selectedLead.company || "Account pending"} · last touched ${readableDate(selectedLead.updated_at)}`
                  : selectedCall
                    ? `Captured ${readableDate(selectedCall.started_at ?? selectedCall.created_at)}`
                    : "Pick a deal on the left to see the pre-call picture."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!selectedEntity || assembling} onClick={() => void buildPackage()}>
                {assembling ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Build briefing
              </Button>
              <Button
                variant="outline"
                disabled={selected.type !== "call" || analyzing}
                onClick={() => void analyzeCall()}
              >
                {analyzing ? <Loader2 className="animate-spin" /> : <PhoneCall />}
                Analyze call
              </Button>
            </div>
          </div>

          {!context ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div className="text-lg font-semibold">No briefing open yet</div>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Choose a live deal. Bylda will pull the account, the people, and the last things
                said — the same picture it uses before recommending a next step.
              </p>
            </div>
          ) : (
            <Tabs defaultValue="briefing" className="p-5">
              <TabsList>
                <TabsTrigger value="briefing">Briefing</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="technical">Technical</TabsTrigger>
              </TabsList>

              <TabsContent value="briefing" className="mt-5 space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <BriefStat
                    icon={Building2}
                    label="Account"
                    value={textValue(account?.name) || textValue(deal?.company) || "Not linked"}
                  />
                  <BriefStat
                    icon={Wallet}
                    label="Deal value"
                    value={money(deal?.value) ?? "Not set"}
                  />
                  <BriefStat
                    icon={Sparkles}
                    label="Stage"
                    value={textValue(deal?.stage) || selectedLead?.stage || "New"}
                  />
                  <BriefStat
                    icon={Users}
                    label="People"
                    value={`${contacts.length || 0} on the deal`}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <h3 className="text-sm font-semibold">Who is involved</h3>
                    <div className="mt-3 space-y-3">
                      {contacts.length ? (
                        contacts.map((contact, index) => (
                          <div key={textValue(contact.id) || index} className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                              {personName(contact).slice(0, 1)}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{personName(contact)}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {textValue(contact.email) || textValue(contact.phone) || "No contact details"}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No people linked yet. Sync the CRM or attach a contact.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <h3 className="text-sm font-semibold">What Bylda already knows</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {facts.length ? (
                        facts.slice(0, 8).map((fact, index) => (
                          <span
                            key={textValue(fact.id) || index}
                            className="rounded-full border bg-muted/50 px-3 py-1 text-xs"
                          >
                            {textValue(fact.fact_key) || "Note"}
                            {textValue(fact.fact_value) ? ` · ${textValue(fact.fact_value)}` : ""}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No durable facts yet. Analyze a call or add a note after the next meeting.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <h3 className="text-sm font-semibold">Remember this before the call</h3>
                  <div className="mt-3 space-y-3">
                    {(history.length ? history : evidence).slice(0, 6).map((item) => (
                      <blockquote
                        key={item.id}
                        className="rounded-2xl bg-muted/40 px-4 py-3 text-sm leading-relaxed"
                      >
                        <p>{item.content}</p>
                        <footer className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {item.source_type.replaceAll("_", " ")}
                          {"occurred_at" in item ? ` · ${readableDate(item.occurred_at)}` : ""}
                        </footer>
                      </blockquote>
                    ))}
                    {!history.length && !evidence.length && (
                      <p className="text-sm text-muted-foreground">
                        No prior notes or transcripts for this deal yet.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-5 space-y-3">
                {activity.length ? (
                  activity.map((item, index) => (
                    <div key={textValue(item.id) || index} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium capitalize">
                          {textValue(item.type) || "Update"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {readableDate(textValue(item.created_at) || null)}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {textValue(item.content) || "No detail recorded."}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No CRM activity on this deal yet.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="technical" className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <BriefStat label="Context version" value={String(context.receipt.context_version)} />
                  <BriefStat
                    label="Sources used"
                    value={String(context.receipt.source_references.length)}
                  />
                  <BriefStat
                    label="Estimated tokens"
                    value={String(context.receipt.token_estimate)}
                  />
                </div>
                {[
                  ["Account", context.account],
                  ["Deal", context.deal],
                  ["Contacts", context.contacts],
                  ["Current state", context.current_state],
                  ["Recent activity", context.recent_activity],
                  ["Relevant history", context.relevant_history],
                  ["Semantic evidence", context.retrieved_evidence],
                  ["Source receipt", context.receipt.source_references],
                  ["Omissions", context.receipt.omissions],
                ].map(([label, value]) => (
                  <section key={label as string}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label as string}
                    </h3>
                    <pre className="max-h-64 overflow-auto rounded-2xl bg-[#101216] p-4 text-[11px] leading-relaxed text-[#d7e1ee]">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </section>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </section>
      </div>
    </div>
  );
}

function BriefStat({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-1 truncate text-base font-semibold">{value}</div>
    </div>
  );
}
