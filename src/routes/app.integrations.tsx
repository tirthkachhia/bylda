import { type SearchSchemaInput, createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Inactive, FigmaRow } from "@/components/app/FigmaPrimitives";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { blockIfGuest } from "@/lib/guest";
import { credentialProvider, oauthProviderName } from "@/lib/integration-oauth";
import {
  disconnectIntegration,
  getCallIngestUrl,
  integrationsQuery,
  managerHomeQuery,
  readyModeStatusQuery,
  saveIntegration,
  startIntegrationOAuth,
  syncGoHighLevel,
  syncSalesforce,
  syncCrm as syncConnectedCrm,
  type MaskedIntegration,
} from "@/lib/queries";
import {
  CATALOG,
  CATEGORIES,
  POPULAR_INTEGRATIONS,
  credentialFieldsForIntegration,
  searchCatalog,
  type IntegrationCategory,
  type IntegrationDef,
} from "@/lib/integrations-catalog";
import { buildReadyModeConnectionRequest, readyModeProgress } from "@/lib/readymode";

export const Route = createFileRoute("/app/integrations")({
  validateSearch: (
    s: Record<string, unknown> & SearchSchemaInput,
  ): { tab: "sources" | "delivery" } => ({ tab: s.tab === "delivery" ? "delivery" : "sources" }),
  component: IntegrationsPage,
});

function IntegrationIcon({ name }: { slug?: string; name: string; size?: number }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded border border-by-border-engraved bg-by-surface-hover text-[11px]">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ConnectModal({
  item,
  connected,
  onClose,
  onSaved,
}: {
  item: IntegrationDef;
  connected: MaskedIntegration[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user, currentOrgId } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncReport, setSyncReport] = useState<string | null>(null);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [shopDomain, setShopDomain] = useState("");
  const [useCredentialFallback, setUseCredentialFallback] = useState(false);
  const providerName = oauthProviderName(item.key);
  const managedCredential = credentialProvider(item.key);
  const isReadyMode = item.key === "readymode";
  const primaryConnection = connected.find(
    (entry) => entry.integration_key === item.key && entry.is_connected,
  );
  const hasCredentialFallback = item.inputType !== "oauth" && !isReadyMode;
  const usingCredentialFallback =
    hasCredentialFallback &&
    (useCredentialFallback || primaryConnection?.connection_type === "legacy_credential");
  const credentialFields =
    hasCredentialFallback && (!providerName || usingCredentialFallback)
      ? credentialFieldsForIntegration(item)
      : [];
  const requiredCredentialFields = credentialFields.filter((field) => !field.optional);
  const credentialConnections = credentialFields
    .map((field) =>
      connected.find((entry) => entry.integration_key === field.key && entry.is_connected),
    )
    .filter((entry): entry is MaskedIntegration => !!entry);
  const credentialsConnected =
    requiredCredentialFields.length > 0 &&
    requiredCredentialFields.every((field) =>
      connected.some((entry) => entry.integration_key === field.key && entry.is_connected),
    );
  const connection =
    providerName && !usingCredentialFallback
      ? primaryConnection
      : credentialsConnected
        ? (primaryConnection ?? credentialConnections[0])
        : undefined;
  const ingestUrl = useQuery({
    queryKey: ["call-ingest-url", currentOrgId],
    queryFn: () => getCallIngestUrl(currentOrgId ?? undefined),
    enabled: isReadyMode && !!user && !!currentOrgId,
    staleTime: 5 * 60_000,
  });
  const readyModeStatus = useQuery({
    ...readyModeStatusQuery(currentOrgId ?? ""),
    enabled: isReadyMode && !!user && !!currentOrgId,
  });
  const readyModeStep = readyModeProgress(readyModeStatus.data);

  const copyWebhookUrl = async () => {
    const url = ingestUrl.data?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("ReadyMode webhook URL copied");
    } catch {
      setError("Could not copy automatically. Select the URL and copy it manually.");
    }
  };

  const copyReadyModeRequest = async () => {
    const url = ingestUrl.data?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(buildReadyModeConnectionRequest(url));
      toast.success("ReadyMode setup request copied");
    } catch {
      setError("Could not copy automatically. Copy the webhook URL and send it to your admin.");
    }
  };

  const connect = async () => {
    if (blockIfGuest("Sign up to connect integrations.")) return;
    if (!user || !providerName) return;
    setWorking(true);
    setError(null);
    try {
      if (item.key === "shopify" && !shopDomain.trim()) {
        setError("Enter your Shopify store domain.");
        setWorking(false);
        return;
      }
      const result = await startIntegrationOAuth(
        item.key,
        item.key === "shopify" ? { shop: shopDomain.trim() } : undefined,
      );
      window.location.assign(result.authorization_url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start secure sign-in");
      setWorking(false);
    }
  };

  const saveCredential = async () => {
    if (blockIfGuest("Sign up to connect integrations.")) return;
    if (!user || credentialFields.length === 0) return;
    const missingField = requiredCredentialFields.find(
      (field) => !credentialValues[field.key]?.trim(),
    );
    if (missingField) {
      setError(`Enter ${missingField.label.toLowerCase()}.`);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      for (const field of credentialFields) {
        const value = credentialValues[field.key]?.trim();
        if (value) await saveIntegration(field.key, value);
      }
      toast.success(`${item.name} connected`);
      setCredentialValues({});
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not validate this API key");
      setWorking(false);
    }
  };

  const disconnect = async () => {
    if (blockIfGuest("Sign up to manage integrations.")) return;
    if (!user) return;
    setWorking(true);
    setError(null);
    try {
      const keys =
        providerName && !usingCredentialFallback
          ? [item.key]
          : [...new Set(credentialFields.map((field) => field.key))];
      for (const key of keys) {
        await disconnectIntegration(user.id, key);
      }
      toast.success(`${item.name} disconnected`);
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not disconnect account");
      setWorking(false);
    }
  };

  const syncCrm = async () => {
    if (blockIfGuest("Sign up to sync CRM data.")) return;
    if (!user || !["salesforce", "gohighlevel", "close_io"].includes(item.key)) return;
    setWorking(true);
    setError(null);
    try {
      if (item.key === "close_io") {
        const result = await syncConnectedCrm("close_io");
        const close = result.results.find((row) => row.provider === "close_io");
        if (!result.ok || close?.error) throw new Error(close?.error ?? "Close sync failed");
        const report = `Close synced: ${result.contacts_imported} contacts, ${result.calls_imported} calls, and ${result.transcripts_imported} transcripts`;
        setSyncReport([report, close?.conversation_warning].filter(Boolean).join(". "));
        toast.success(report);
        if (close?.conversation_warning) toast.warning(close.conversation_warning);
      } else if (item.key === "gohighlevel") {
        const result = await syncGoHighLevel();
        toast.success(
          `GoHighLevel synced: ${result.contacts_imported} contacts, ${result.opportunities_imported ?? 0} opportunities, ${result.calls_imported} calls, and ${result.transcripts_imported} transcripts`,
        );
        if (result.conversation_warning) toast.warning(result.conversation_warning);
      } else {
        const result = await syncSalesforce();
        toast.success(
          `Salesforce synced: ${result.contacts_imported} contacts and ${result.opportunities_imported} opportunities`,
        );
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sync Salesforce data");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="figma-connector-dialog max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <IntegrationIcon slug={item.iconSlug} name={item.name} size={24} />
            <DialogTitle className="text-base">{item.name}</DialogTitle>
          </div>
          <DialogDescription className="text-[12.5px]">{item.description}</DialogDescription>
        </DialogHeader>

        {isReadyMode ? (
          <div className="space-y-4 pt-1">
            <div
              className="rounded-by-card p-4"
              style={{
                background: "color-mix(in oklab, var(--primary) 7%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--primary) 22%, transparent)",
              }}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: "var(--primary)" }}
                />
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {readyModeStep === 3
                      ? "ReadyMode is connected"
                      : "Connect ReadyMode in 3 steps"}
                  </div>
                  <p
                    className="mt-1 text-[11.5px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {readyModeStep === 3
                      ? "Bylda received a call, stored its transcript, and finished the AI analysis."
                      : "You do not need to share your ReadyMode password. Copy one secure URL, send it to your admin, then make a test call."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="readymode-webhook-url"
                className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Step 1 — Copy your Bylda call URL
              </label>
              <div className="flex gap-2">
                <input
                  id="readymode-webhook-url"
                  readOnly
                  value={
                    ingestUrl.isPending
                      ? "Generating secure URL…"
                      : (ingestUrl.data?.url ?? "Webhook URL is not configured")
                  }
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-[11px] outline-none"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={copyWebhookUrl}
                  disabled={!ingestUrl.data?.url}
                  aria-label="Copy ReadyMode webhook URL"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <p
                className="text-[10.5px] leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                This URL is unique to this workspace. Keep it private.
              </p>
            </div>

            {ingestUrl.isError && (
              <p className="text-[11.5px]" style={{ color: "var(--destructive)" }}>
                Could not load the webhook URL. Try refreshing or ask a workspace administrator.
              </p>
            )}

            <div
              className="rounded-by-card p-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="text-[12.5px] font-semibold">Step 2 — Send it to your admin</div>
              <p
                className="mt-1 text-[11.5px] leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                Ask your ReadyMode administrator or support team to send completed calls to this
                URL. We prepared the exact request for you.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={copyReadyModeRequest}
                disabled={!ingestUrl.data?.url}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy message for my admin
              </Button>
            </div>

            <div
              className="rounded-by-card p-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12.5px] font-semibold">Step 3 — Make one test call</div>
                  <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                    Complete a connected call lasting at least 45 seconds, then check the
                    connection.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void readyModeStatus.refetch()}
                  disabled={readyModeStatus.isFetching}
                >
                  <RefreshCw
                    className={`mr-1.5 h-3.5 w-3.5 ${readyModeStatus.isFetching ? "animate-spin" : ""}`}
                  />
                  Check
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["Call received", readyModeStep >= 1],
                  ["Transcript", readyModeStep >= 2],
                  ["AI analyzed", readyModeStep >= 3],
                ].map(([label, complete]) => (
                  <div
                    key={String(label)}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-[10.5px]"
                    style={{
                      background: "var(--surface)",
                      color: complete ? "var(--success)" : "var(--muted-foreground)",
                    }}
                  >
                    {complete ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{String(label)}</span>
                  </div>
                ))}
              </div>
              {readyModeStatus.data?.lastCallAt && (
                <p className="mt-2 text-[10.5px]" style={{ color: "var(--muted-foreground)" }}>
                  Last ReadyMode call received{" "}
                  {new Date(readyModeStatus.data.lastCallAt).toLocaleString()}.
                </p>
              )}
              {readyModeStep === 1 && (
                <p className="mt-2 text-[10.5px]" style={{ color: "var(--destructive)" }}>
                  The call arrived, but no transcript was stored (
                  {readyModeStatus.data?.transcriptionStatus ?? "no transcript supplied"}). Ask
                  ReadyMode to include a recording URL or transcript.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <a
                  href="https://help.readymode.com/support/solutions/articles/11000083503-readymode-integrations"
                  target="_blank"
                  rel="noreferrer"
                >
                  Need admin help? <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : providerName && !usingCredentialFallback ? (
          <div className="space-y-4 pt-1">
            <div
              className="rounded-by-card p-4"
              style={{
                background: "color-mix(in oklab, var(--success) 7%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--success) 22%, transparent)",
              }}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: "var(--success)" }}
                />
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    Secure account connection
                  </div>
                  <p
                    className="mt-1 text-[11.5px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    You’ll sign in on {providerName} and approve only the access Bylda needs. Your
                    password and API keys are never entered into Bylda.
                  </p>
                </div>
              </div>
            </div>

            {item.key === "shopify" && !connection && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium" htmlFor="shopify-store">
                  Shopify store
                </label>
                <Input
                  id="shopify-store"
                  value={shopDomain}
                  onChange={(event) => setShopDomain(event.target.value)}
                  placeholder="your-store.myshopify.com"
                  autoComplete="off"
                />
              </div>
            )}

            {connection && (
              <div
                className="rounded-by-card px-4 py-3"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div
                  className="flex items-center gap-2 text-[12px] font-medium"
                  style={{ color: "var(--success)" }}
                >
                  <Check className="h-3.5 w-3.5" /> Connected
                </div>
                <div className="mt-1 text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                  {connection.account_label ?? `${providerName} account`}
                </div>
              </div>
            )}

            {error && (
              <p className="text-[11.5px]" style={{ color: "var(--destructive)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={connect} disabled={working}>
                {working
                  ? "Opening sign-in…"
                  : connection
                    ? `Reconnect ${providerName}`
                    : `Continue with ${providerName}`}
                {!working && <ExternalLink className="ml-1.5 h-3.5 w-3.5" />}
              </Button>
              {connection && (
                <Button variant="outline" onClick={disconnect} disabled={working}>
                  Disconnect
                </Button>
              )}
            </div>
            {syncReport && (
              <p role="status" className="text-sm">
                {syncReport}
              </p>
            )}
            {connection && ["salesforce", "gohighlevel", "close_io"].includes(item.key) && (
              <Button variant="outline" className="w-full" onClick={syncCrm} disabled={working}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${working ? "animate-spin" : ""}`} />
                {["gohighlevel", "close_io"].includes(item.key)
                  ? "Sync contacts, opportunities, calls, and transcripts"
                  : "Sync contacts and opportunities"}
              </Button>
            )}
            {hasCredentialFallback && !connection && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setError(null);
                  setUseCredentialFallback(true);
                }}
                disabled={working}
              >
                Use an API key or token instead
              </Button>
            )}
          </div>
        ) : credentialFields.length > 0 ? (
          <div className="space-y-4 pt-1">
            <div
              className="rounded-by-card p-4"
              style={{
                background: "color-mix(in oklab, var(--success) 7%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--success) 22%, transparent)",
              }}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: "var(--success)" }}
                />
                <div>
                  <div className="text-[13px] font-semibold">Encrypted provider connection</div>
                  <p
                    className="mt-1 text-[11.5px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Bylda encrypts these {item.name} credentials at rest and never displays their
                    full values again. You can replace or disconnect them at any time.
                  </p>
                </div>
              </div>
            </div>

            {connection ? (
              <>
                <div
                  className="rounded-by-card px-4 py-3"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="flex items-center gap-2 text-[12px] font-medium"
                    style={{ color: "var(--success)" }}
                  >
                    <Check className="h-3.5 w-3.5" /> Connected
                  </div>
                  <div className="mt-1 text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                    {credentialConnections.length === 1
                      ? `Credential ending in ${connection.value_last4 ?? "••••"}`
                      : `${credentialConnections.length} credentials saved`}
                  </div>
                </div>
              </>
            ) : null}

            <div className="space-y-3">
              {credentialFields.map((field) => (
                <div className="space-y-1.5" key={field.key}>
                  <label className="text-[12px] font-medium" htmlFor={`${item.key}-${field.key}`}>
                    {field.label}
                    {field.optional ? " (optional)" : ""}
                  </label>
                  <Input
                    id={`${item.key}-${field.key}`}
                    type={field.inputType === "key" ? "password" : field.inputType}
                    name={`${item.key}-${field.key}${connection ? "-replacement" : ""}`}
                    value={credentialValues[field.key] ?? ""}
                    onChange={(event) =>
                      setCredentialValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={connection ? `New ${field.label.toLowerCase()}` : field.hint}
                    autoComplete={field.inputType === "key" ? "new-password" : "off"}
                    data-1p-ignore
                    data-lpignore="true"
                  />
                </div>
              ))}
            </div>

            {error && (
              <p className="text-[11.5px]" style={{ color: "var(--destructive)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={saveCredential}
                disabled={
                  working ||
                  requiredCredentialFields.some((field) => !credentialValues[field.key]?.trim())
                }
              >
                {working
                  ? "Validating…"
                  : connection
                    ? `Replace ${managedCredential?.name ?? item.name} credentials`
                    : "Connect"}
              </Button>
              {connection && (
                <Button variant="outline" onClick={disconnect} disabled={working}>
                  Disconnect
                </Button>
              )}
            </div>
            {connection && item.key === "gohighlevel" && (
              <Button variant="outline" className="w-full" onClick={syncCrm} disabled={working}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${working ? "animate-spin" : ""}`} />
                Sync contacts, opportunities, calls, and transcripts
              </Button>
            )}
            {providerName && !connection && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setError(null);
                  setUseCredentialFallback(false);
                }}
                disabled={working}
              >
                Back to secure {providerName} sign-in
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div
              className="rounded-by-card p-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-3">
                <div>
                  <div
                    className="text-[12.5px] font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    OAuth setup required
                  </div>
                  <p
                    className="mt-1 text-[11.5px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    This provider does not support the API-key fallback in its current catalog
                    configuration. Finish its OAuth setup to enable account connections.
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IntegrationsPage() {
  const navigate = Route.useNavigate();
  const { user, currentOrgId } = useAuth();
  const queryClient = useQueryClient();
  const q = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  const home = useQuery(managerHomeQuery(currentOrgId ?? ""));
  const [tab, setTab] = useState<"sources" | "delivery">(Route.useSearch().tab);
  const [connecting, setConnecting] = useState<IntegrationDef | null>(null);
  const connected = q.data ?? [];
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["user_integrations", user?.id] });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("oauth");
    if (!status) return;
    if (status === "success") {
      toast.success("Account connected");
      void refresh();
    } else
      toast.error(
        status === "cancelled" ? "Account connection cancelled" : "Account connection failed",
      );
    params.delete("oauth");
    params.delete("provider");
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (params.size ? "?" + params.toString() : ""),
    );
    // The callback is consumed once; source/provider reads continue through the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const groups =
    tab === "sources"
      ? ([
          [
            "Calls & meetings",
            [
              ["zoom", "Zoom", "Meeting recorder", false],
              ["gong", "Gong", "Recorder + transcripts", false],
              ["aircall", "Aircall", "Dialer", false],
              ["googlemeet", "Google Meet", "Meeting recorder", false],
              ["readymode", "ReadyMode", "Call ingestion", true],
              ["close_io", "Close", "Calls and CRM", true],
            ],
          ],
          [
            "CRM · outcomes",
            [
              ["hubspot", "HubSpot", "CRM", true],
              ["salesforce", "Salesforce", "CRM", true],
              ["gohighlevel", "GoHighLevel", "Calls and CRM", true],
            ],
          ],
          ["Calendar", [["google_calendar", "Google Calendar", "Account connection", true]]],
        ] as const)
      : ([
          [
            "Delivery channels",
            [
              ["slack", "Slack", "Account connection; report delivery unavailable", true],
              ["teams", "Microsoft Teams", "Report delivery", false],
              ["email", "Email", "Daily brief delivery", false],
              ["webhook", "Webhook", "Report delivery", false],
            ],
          ],
        ] as const);
  return (
    <div
      className="figma-surface grid gap-2 xl:grid-cols-[minmax(0,1fr)_344px]"
      data-design-screen="integrations"
    >
      <section className="figma-panel min-h-[calc(100dvh-72px)]">
        <h1>Integrations</h1>
        <p className="mt-2 text-xs text-by-text-secondary">
          Data sources feed Bylda. Delivery channels carry Bylda’s intelligence out.
        </p>
        <div className="figma-tabs" role="tablist" aria-label="Integration category">
          {(
            [
              ["sources", "Data sources"],
              ["delivery", "Delivery channels"],
            ] as const
          ).map(([key, name]) => (
            <button
              role="tab"
              type="button"
              key={key}
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                void navigate({ search: { tab: key } });
              }}
            >
              {name}
            </button>
          ))}
        </div>
        {q.isPending ? (
          <p role="status">Loading connections…</p>
        ) : q.error ? (
          <p role="alert">
            Connections could not load.{" "}
            <button className="underline" onClick={() => void q.refetch()}>
              Retry
            </button>
          </p>
        ) : (
          groups.map(([heading, rows]) => (
            <section key={heading}>
              <h3>{heading}</h3>
              <div className="rounded-xl border border-by-border-engraved">
                {rows.map(([key, name, detail, supported]) => {
                  const item = CATALOG.find((i) => i.key === key);
                  const entry = connected.find((i) => i.integration_key === key && i.is_connected);
                  const active = supported && !!item;
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-center gap-3 border-b border-by-border-engraved p-3 last:border-0"
                    >
                      <IntegrationIcon name={name} />
                      <div className="min-w-0 flex-1">
                        <p>{name}</p>
                        <p className="text-xs text-by-text-secondary">{detail}</p>
                      </div>
                      <span className="text-[11px] text-by-text-secondary">
                        {active ? (entry ? "Connected" : "Not connected") : "Not available yet"}
                      </span>
                      {active ? (
                        <button
                          type="button"
                          className="figma-button"
                          onClick={() => setConnecting(item)}
                        >
                          {entry ? "Manage" : "Connect"}
                        </button>
                      ) : (
                        <Inactive>Connect</Inactive>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
        {tab === "sources" && (
          <section>
            <h3>Files</h3>
            <div className="rounded-xl border border-by-border-engraved">
              <FigmaRow
                label="Manual upload"
                detail="Media up to 100 MB or TXT transcripts up to 100,000 characters"
              >
                <Link
                  className="figma-button"
                  to="/app/crm/calls"
                  search={{ view: "calls", upload: true }}
                >
                  Upload
                </Link>
              </FigmaRow>
              <FigmaRow label="CSV import" detail="Deal outcomes for teams without CRM">
                <Inactive>Import</Inactive>
              </FigmaRow>
            </div>
          </section>
        )}
        {connecting && (
          <ConnectModal
            item={connecting}
            connected={connected}
            onClose={() => setConnecting(null)}
            onSaved={() => void refresh()}
          />
        )}
      </section>
      <aside className="p-6">
        <h2 className="text-xs uppercase">Health</h2>
        <FigmaRow label="Imported calls">
          <span>{home.data?.importedCalls ?? "—"}</span>
        </FigmaRow>
        <FigmaRow label="Analyzed">
          <span>{home.data?.analyzedCalls ?? "—"}</span>
        </FigmaRow>
        <FigmaRow label="Failed">
          <span>—</span>
        </FigmaRow>
        <FigmaRow label="Waiting">
          <span>—</span>
        </FigmaRow>
        <FigmaRow label="CRM match">
          <span>—</span>
        </FigmaRow>
        <p className="mt-3 text-[11px] text-by-text-secondary">
          Call totals are all time for this workspace. Unavailable metrics remain blank.
        </p>
        <section className="mt-5 rounded-lg border border-by-border-engraved p-4">
          <h3 className="text-[11px] uppercase">What Bylda reads</h3>
          <p className="mt-2 text-xs">
            Available audio, transcripts, participants and timestamps, plus connected CRM context.
            Connector permissions govern access.
          </p>
        </section>
      </aside>
    </div>
  );
}
