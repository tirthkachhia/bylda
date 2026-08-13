import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Braces,
  CheckCircle2,
  Clipboard,
  Database,
  ExternalLink,
  Loader2,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { syncGoHighLevel, type GoHighLevelSyncResult } from "@/lib/queries";

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

function readableDate(value: string | null) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ContextMemoryBetaPage() {
  const { currentOrgId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ghlConnected, setGhlConnected] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [stats, setStats] = useState<BetaStats>(EMPTY_STATS);
  const [callWebhookUrl, setCallWebhookUrl] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [context, setContext] = useState<ContextPackage | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastSync, setLastSync] = useState<GoHighLevelSyncResult | null>(null);

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
          .select("status")
          .eq("user_id", user.id)
          .eq("integration_key", "gohighlevel")
          .eq("status", "connected")
          .maybeSingle(),
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
      setGhlConnected(Boolean(integrationResult.data));
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
        if (nextCalls[0]) return `call:${nextCalls[0].id}`;
        if (nextLeads[0]) return `lead:${nextLeads[0].id}`;
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

  const syncGhl = async () => {
    setSyncing(true);
    try {
      const result = await syncGoHighLevel();
      setLastSync(result);
      toast.success("Real GoHighLevel data synchronized", {
        description: `${result.contacts_imported} contacts and ${result.opportunities_imported} opportunities imported.`,
      });
      await load();
    } catch (error) {
      toast.error("GoHighLevel sync failed", {
        description:
          error instanceof Error ? error.message : "Reconnect the integration and retry.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const buildPackage = async () => {
    if (!currentOrgId || !selected.id) return;
    setAssembling(true);
    try {
      const response = await invokeFunction<{ context: ContextPackage }>("context-package", {
        organization_id: currentOrgId,
        task: "beta_context_inspection",
        ...(selected.type === "call" ? { call_id: selected.id } : { lead_id: selected.id }),
        token_budget: 6000,
      });
      setContext(response.context);
      toast.success("Context Package assembled from live data");
      await load();
    } catch (error) {
      toast.error("Context assembly failed", {
        description: error instanceof Error ? error.message : "Check the beta backend deployment.",
      });
    } finally {
      setAssembling(false);
    }
  };

  const analyzeCall = async () => {
    if (selected.type !== "call" || !selected.id) return;
    setAnalyzing(true);
    try {
      await invokeFunction("analyze-call", { call_id: selected.id });
      toast.success("Call analyzed with the assembled Context Package");
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
    toast.success("Call webhook URL copied");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">Beta · Live data</Badge>
            <span className="text-xs text-muted-foreground">GoHighLevel + call memory</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Context Memory</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Synchronize your connected CRM, ingest real calls, and inspect exactly what Bylda
            retrieves before intelligence runs.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh live state
        </Button>
      </div>

      {loadError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Unplug className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <div className="font-medium">Development backend is not ready</div>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Point localhost at the hosted development Supabase project after deploying the
                context migration and functions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Raw records", stats.rawObjects],
          ["Identity links", stats.externalMappings],
          ["Calls", stats.calls],
          ["Memory chunks", stats.memoryChunks],
          ["Packages built", stats.packagesBuilt],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                1. Synchronize CRM
              </CardTitle>
              <CardDescription>
                Uses the GoHighLevel account connected in Integrations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">GoHighLevel</div>
                  <div className="text-xs text-muted-foreground">
                    {ghlConnected ? "Connected account" : "Not connected"}
                  </div>
                </div>
                {ghlConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/app/integrations">
                      Connect <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
              <Button className="w-full" disabled={!ghlConnected || syncing} onClick={syncGhl}>
                {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Sync real contacts and opportunities
              </Button>
              {lastSync && (
                <p className="text-xs text-muted-foreground">
                  Last run received {lastSync.contacts_received} contacts and{" "}
                  {lastSync.opportunities_received} opportunities.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PhoneCall className="h-4 w-4" />
                2. Send real calls
              </CardTitle>
              <CardDescription>
                Configure your dialer or transcription provider to POST completed calls here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {callWebhookUrl ? (
                <>
                  <code className="block max-h-24 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
                    {callWebhookUrl}
                  </code>
                  <Button className="w-full" variant="outline" onClick={copyWebhook}>
                    <Clipboard />
                    Copy secure call webhook
                  </Button>
                </>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Set INBOUND_WEBHOOK_SECRET in the hosted development project to generate this URL.
                </p>
              )}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The payload must include a call ID and transcript. Phone numbers or provider CRM IDs
                are used to link the call to the synchronized contact and deal.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                3. Inspect context
              </CardTitle>
              <CardDescription>
                Select an actual synchronized deal or ingested call.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a real entity" />
                </SelectTrigger>
                <SelectContent>
                  {calls.map((call) => (
                    <SelectItem key={`call:${call.id}`} value={`call:${call.id}`}>
                      Call · {call.provider ?? "unknown"} ·{" "}
                      {readableDate(call.started_at ?? call.created_at)}
                    </SelectItem>
                  ))}
                  {leads.map((lead) => (
                    <SelectItem key={`lead:${lead.id}`} value={`lead:${lead.id}`}>
                      Deal · {lead.name} · {lead.stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!calls.length && !leads.length && (
                <p className="text-xs text-muted-foreground">
                  No real entities yet. Connect and synchronize GoHighLevel first.
                </p>
              )}
              <Button
                className="w-full"
                disabled={!selectedEntity || assembling}
                onClick={buildPackage}
              >
                {assembling ? <Loader2 className="animate-spin" /> : <Braces />}
                Build Context Package
              </Button>
              <Button
                className="w-full"
                variant="outline"
                disabled={selected.type !== "call" || analyzing}
                onClick={analyzeCall}
              >
                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Analyze selected call
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="min-h-[720px]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>Live Context Package</span>
              {context && <Badge variant="outline">v{context.package_version}</Badge>}
            </CardTitle>
            <CardDescription>
              Structured CRM state, historical memory, provenance, and retrieval omissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!context ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center rounded-xl border border-dashed text-center">
                <Braces className="mb-3 h-9 w-9 text-muted-foreground/50" />
                <div className="font-medium">No package assembled yet</div>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Choose a real deal or call. Bylda will retrieve only data belonging to your
                  organization.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Context version
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {context.receipt.context_version}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Sources used
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {context.receipt.source_references.length}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Estimated tokens
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {context.receipt.token_estimate}
                    </div>
                  </div>
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
                    <pre className="max-h-72 overflow-auto rounded-lg bg-[#101216] p-4 text-[11px] leading-relaxed text-[#d7e1ee]">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
