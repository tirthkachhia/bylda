import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
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
  saveIntegration,
  startIntegrationOAuth,
  syncSalesforce,
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

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
});

const LETTER_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

function IntegrationIcon({
  slug,
  name,
  size = 28,
}: {
  slug?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const bg = LETTER_COLORS[name.charCodeAt(0) % LETTER_COLORS.length];

  if (slug && !failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-lg bg-white p-1"
        style={{ width: size + 8, height: size + 8 }}
      >
        <img
          src={`https://cdn.simpleicons.org/${slug}`}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          className="object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
      style={{ width: size + 8, height: size + 8, background: bg, fontSize: size * 0.45 }}
    >
      {name[0].toUpperCase()}
    </div>
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
  const { user } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    queryKey: ["call-ingest-url"],
    queryFn: getCallIngestUrl,
    enabled: isReadyMode && !!user,
    staleTime: 5 * 60_000,
  });

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
    if (!user || item.key !== "salesforce") return;
    setWorking(true);
    setError(null);
    try {
      const result = await syncSalesforce();
      toast.success(
        `Salesforce synced: ${result.contacts_imported} contacts and ${result.opportunities_imported} opportunities`,
      );
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sync Salesforce data");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
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
              className="rounded-xl p-4"
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
                    Secure call intake is ready
                  </div>
                  <p
                    className="mt-1 text-[11.5px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Give this organization-specific URL to ReadyMode’s integrations team. Calls of
                    at least 45 seconds can be transcribed and analyzed automatically.
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
                Bylda webhook URL
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
                  variant="outline"
                  size="sm"
                  onClick={copyWebhookUrl}
                  disabled={!ingestUrl.data?.url}
                  aria-label="Copy ReadyMode webhook URL"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p
                className="text-[10.5px] leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                Treat this URL like a password. It authorizes call delivery into your Bylda
                workspace.
              </p>
            </div>

            {ingestUrl.isError && (
              <p className="text-[11.5px]" style={{ color: "var(--destructive)" }}>
                Could not load the webhook URL. Try refreshing or ask a workspace administrator.
              </p>
            )}

            <div
              className="rounded-xl p-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="mb-2 text-[12.5px] font-semibold">ReadyMode checklist</div>
              <div className="space-y-2 text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                {[
                  "Enable Automation → Integration Features",
                  "Enable CCS Profile → Play Recordings",
                  "Enable Communication → Manage VOIP",
                  "Ask ReadyMode to POST completed calls to the URL above",
                ].map((step) => (
                  <div key={step} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--success)" }}
                    />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <a
                  href="https://help.readymode.com/support/solutions/articles/11000083503-readymode-integrations"
                  target="_blank"
                  rel="noreferrer"
                >
                  ReadyMode instructions <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
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
              className="rounded-xl p-4"
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
                className="rounded-xl px-4 py-3"
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
            {connection && item.key === "salesforce" && (
              <Button variant="outline" className="w-full" onClick={syncCrm} disabled={working}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${working ? "animate-spin" : ""}`} />
                Sync contacts and opportunities
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
              className="rounded-xl p-4"
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
                  className="rounded-xl px-4 py-3"
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
              className="rounded-xl p-4"
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

function IntegrationCard({
  item,
  isConnected,
  onClick,
}: {
  item: IntegrationDef;
  isConnected: boolean;
  onClick: () => void;
}) {
  const providerName = oauthProviderName(item.key);
  const isReadyMode = item.key === "readymode";
  const hasCredentialFallback =
    !providerName && !isReadyMode && credentialFieldsForIntegration(item).length > 0;
  return (
    <div
      className="bylda-card flex cursor-pointer flex-col p-4 transition-all duration-200 hover:scale-[1.01]"
      style={{
        border: isConnected
          ? "1px solid color-mix(in oklab, var(--success) 30%, transparent)"
          : undefined,
      }}
      onClick={onClick}
    >
      {isConnected && (
        <div
          className="-mx-4 -mt-4 mb-3 h-[2px] rounded-t-2xl"
          style={{ background: "linear-gradient(90deg, transparent, var(--success), transparent)" }}
        />
      )}
      <div className="mb-3 flex items-start justify-between gap-2">
        <IntegrationIcon slug={item.iconSlug} name={item.name} />
        <StatusPill tone={isConnected ? "success" : "muted"}>
          {isConnected
            ? "Connected"
            : isReadyMode
              ? "Webhook setup"
              : providerName
                ? "Secure sign-in"
                : hasCredentialFallback
                  ? item.inputType === "url"
                    ? "Encrypted URL"
                    : "Encrypted key"
                  : "OAuth required"}
        </StatusPill>
      </div>
      <div className="flex-1">
        <h3 className="mb-0.5 text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
          {item.name}
        </h3>
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {item.description}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
          style={{
            background: "var(--surface-2)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)",
          }}
        >
          {item.category}
        </span>
        <Button
          size="sm"
          variant={isConnected ? "outline" : "default"}
          className="h-7 px-3 text-[11.5px]"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          {isConnected ? (
            <>
              <Check className="mr-1 h-3 w-3" /> Manage
            </>
          ) : isReadyMode ? (
            "Set up"
          ) : providerName || hasCredentialFallback ? (
            "Connect account"
          ) : (
            "Details"
          )}
        </Button>
      </div>
    </div>
  );
}

function IntegrationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const integrations = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  const connected = integrations.data ?? [];
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<IntegrationCategory>("All");
  const [connecting, setConnecting] = useState<IntegrationDef | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("oauth");
    const provider = params.get("provider");
    if (!status) return;
    if (status === "success") {
      toast.success(`${provider ?? "Account"} connected securely`);
      if (provider === "salesforce") {
        void syncSalesforce()
          .then((result) => {
            toast.success(
              `Salesforce synced: ${result.contacts_imported} contacts and ${result.opportunities_imported} opportunities`,
            );
          })
          .catch((error) => {
            toast.error(error instanceof Error ? error.message : "Salesforce sync failed");
          });
      }
    } else if (status === "cancelled") toast.info("Account connection cancelled");
    else toast.error("Account connection failed. Please try again.");
    window.history.replaceState({}, "", window.location.pathname);
    if (user) queryClient.invalidateQueries({ queryKey: ["user_integrations", user.id] });
  }, [queryClient, user]);

  const filtered = searchCatalog(search, category);
  const popularItems = POPULAR_INTEGRATIONS.filter(() => !search && category === "All");
  const isConnected = (item: IntegrationDef) => {
    const providerName = oauthProviderName(item.key);
    const primary = connected.find(
      (entry) => entry.integration_key === item.key && entry.is_connected,
    );
    if (item.key === "readymode") return !!primary;
    if (providerName && primary?.connection_type !== "legacy_credential") {
      return !!primary;
    }
    const requiredFields = credentialFieldsForIntegration(item).filter((field) => !field.optional);
    return (
      requiredFields.length > 0 &&
      requiredFields.every((field) =>
        connected.some((entry) => entry.integration_key === field.key && entry.is_connected),
      )
    );
  };
  const refresh = () => {
    if (user) queryClient.invalidateQueries({ queryKey: ["user_integrations", user.id] });
  };
  const openConnector = (item: IntegrationDef) => {
    setConnecting(item);
  };
  const connectedCount = connected.filter((entry) => entry.is_connected).length;

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Connect your sales stack."
        description="Use secure account sign-in where OAuth is configured, or add encrypted API credentials for the rest of your tools."
      />

      <div
        className="rounded-2xl px-5 py-4"
        style={{
          background: "color-mix(in oklab, var(--primary) 6%, var(--surface))",
          border: "1px solid color-mix(in oklab, var(--primary) 18%, var(--border))",
        }}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              Secure connections
            </div>
            <p
              className="mt-0.5 text-[11.5px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              OAuth connections use provider sign-in and minimum scopes. API keys, tokens, and
              webhook URLs are encrypted on the server and are never displayed again.
            </p>
          </div>
        </div>
      </div>

      {connectedCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-2xl px-5 py-3"
          style={{
            background: "color-mix(in oklab, var(--success) 8%, var(--surface))",
            border: "1px solid color-mix(in oklab, var(--success) 25%, transparent)",
          }}
        >
          <Check className="h-4 w-4" style={{ color: "var(--success)" }} />
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
            {connectedCount} integration{connectedCount === 1 ? "" : "s"} connected
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            id="integrations-search"
            name="integration-catalog-search"
            type="search"
            placeholder="Search integrations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full rounded-xl py-2.5 pl-10 pr-10 text-[13px] outline-none"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className="shrink-0 rounded-full px-3 py-1 text-[12px] font-medium"
              style={
                category === item
                  ? { background: "var(--primary)", color: "white" }
                  : {
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--muted-foreground)",
                    }
              }
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {popularItems.length > 0 && (
        <section>
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Popular
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {popularItems.map((item) => (
              <IntegrationCard
                key={item.key}
                item={item}
                isConnected={isConnected(item)}
                onClick={() => openConnector(item)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          {search || category !== "All" ? `${filtered.length} results` : "All integrations"}
        </div>
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl py-16 text-center"
            style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
          >
            <Search className="mx-auto mb-3 h-8 w-8" style={{ color: "var(--muted-foreground)" }} />
            <div className="text-[13px] font-medium">No integrations found</div>
            <div className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Try a provider name, category, or connection type.
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
              <IntegrationCard
                key={item.key}
                item={item}
                isConnected={isConnected(item)}
                onClick={() => openConnector(item)}
              />
            ))}
          </div>
        )}
      </section>

      {connecting && (
        <ConnectModal
          item={connecting}
          connected={connected}
          onClose={() => {
            setConnecting(null);
          }}
          onSaved={refresh}
        />
      )}
    </>
  );
}
