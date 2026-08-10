import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Lock, Search, ShieldCheck, X } from "lucide-react";
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
  integrationsQuery,
  saveIntegration,
  startIntegrationOAuth,
  type MaskedIntegration,
} from "@/lib/queries";
import {
  CATALOG,
  CATEGORIES,
  POPULAR_INTEGRATIONS,
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
  const [credentialValue, setCredentialValue] = useState("");
  const [secondaryValue, setSecondaryValue] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const providerName = oauthProviderName(item.key);
  const credential = credentialProvider(item.key);
  const primaryConnection = connected.find(
    (entry) => entry.integration_key === item.key && entry.is_connected,
  );
  const sendgridSender = connected.find(
    (entry) => entry.integration_key === "sendgrid_from" && entry.is_connected,
  );
  const connection =
    item.key === "sendgrid"
      ? primaryConnection && sendgridSender
        ? primaryConnection
        : undefined
      : primaryConnection;

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
    if (
      !user ||
      !credential ||
      !credentialValue.trim() ||
      (item.key === "sendgrid" && !secondaryValue.trim())
    )
      return;
    setWorking(true);
    setError(null);
    try {
      await saveIntegration(item.key, credentialValue.trim());
      if (item.key === "sendgrid") {
        await saveIntegration("sendgrid_from", secondaryValue.trim());
      }
      toast.success(`${item.name} connected`);
      setCredentialValue("");
      setSecondaryValue("");
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
      await disconnectIntegration(user.id, item.key);
      if (item.key === "sendgrid") {
        await disconnectIntegration(user.id, "sendgrid_from");
      }
      toast.success(`${item.name} disconnected`);
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not disconnect account");
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

        {providerName ? (
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
          </div>
        ) : credential ? (
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
                    Bylda validates this credential with {credential.name}, encrypts it at rest, and
                    never displays it again.
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
                    Key ending in {connection.value_last4 ?? "••••"}
                  </div>
                </div>
                <Input
                  type={credential.inputType ?? "password"}
                  name={`${item.key}-api-key-replacement`}
                  value={credentialValue}
                  onChange={(event) => setCredentialValue(event.target.value)}
                  placeholder={`New ${credential.name} key`}
                  autoComplete={credential.inputType === "url" ? "off" : "new-password"}
                  data-1p-ignore
                  data-lpignore="true"
                />
                {item.key === "sendgrid" && (
                  <Input
                    type="email"
                    name="sendgrid-verified-sender-replacement"
                    value={secondaryValue}
                    onChange={(event) => setSecondaryValue(event.target.value)}
                    placeholder="Verified sender email"
                    autoComplete="off"
                  />
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Input
                  type={credential.inputType ?? "password"}
                  name={`${item.key}-api-key`}
                  value={credentialValue}
                  onChange={(event) => setCredentialValue(event.target.value)}
                  placeholder={credential.placeholder}
                  autoComplete={credential.inputType === "url" ? "off" : "new-password"}
                  data-1p-ignore
                  data-lpignore="true"
                />
                {item.key === "sendgrid" && (
                  <Input
                    type="email"
                    name="sendgrid-verified-sender"
                    value={secondaryValue}
                    onChange={(event) => setSecondaryValue(event.target.value)}
                    placeholder="Verified sender email"
                    autoComplete="off"
                  />
                )}
              </div>
            )}

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
                  !credentialValue.trim() ||
                  (item.key === "sendgrid" && !secondaryValue.trim())
                }
              >
                {working
                  ? "Validating…"
                  : connection
                    ? `Replace ${credential.name} key`
                    : "Connect"}
              </Button>
              {connection && (
                <Button variant="outline" onClick={disconnect} disabled={working}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-3">
                <Lock
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                />
                <div>
                  <div
                    className="text-[12.5px] font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Managed connector required
                  </div>
                  <p
                    className="mt-1 text-[11.5px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Bylda no longer asks teammates to paste API keys. This provider will become
                    available after a secure managed connector is approved.
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
  const credential = credentialProvider(item.key);
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
            : providerName
              ? "Secure sign-in"
              : credential
                ? "Encrypted key"
                : "Managed"}
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
          ) : providerName || credential ? (
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
    if (status === "success") toast.success(`${provider ?? "Account"} connected securely`);
    else if (status === "cancelled") toast.info("Account connection cancelled");
    else toast.error("Account connection failed. Please try again.");
    window.history.replaceState({}, "", window.location.pathname);
    if (user) queryClient.invalidateQueries({ queryKey: ["user_integrations", user.id] });
  }, [queryClient, user]);

  const filtered = searchCatalog(search, category);
  const popularItems = POPULAR_INTEGRATIONS.filter(() => !search && category === "All");
  const isConnected = (key: string) => {
    const primary = connected.some((entry) => entry.integration_key === key && entry.is_connected);
    if (key !== "sendgrid") return primary;
    return (
      primary &&
      connected.some((entry) => entry.integration_key === "sendgrid_from" && entry.is_connected)
    );
  };
  const refresh = () => {
    if (user) queryClient.invalidateQueries({ queryKey: ["user_integrations", user.id] });
  };
  const openConnector = (item: IntegrationDef) => {
    if (credentialProvider(item.key)) setSearch("");
    setConnecting(item);
  };
  const connectedCount = connected.filter((entry) => entry.is_connected).length;

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Connect accounts, not API keys."
        description="Sign in to the tools your team already uses. Bylda stores delegated access securely and keeps provider secrets off every user device."
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
              OAuth connected accounts
            </div>
            <p
              className="mt-0.5 text-[11.5px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              Teammates authorize access on the provider’s website. Bylda requests minimum scopes,
              validates every callback, and stores refresh tokens encrypted on the server.
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
                isConnected={isConnected(item.key)}
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
              Bylda only exposes managed account connections—never raw credential fields.
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
              <IntegrationCard
                key={item.key}
                item={item}
                isConnected={isConnected(item.key)}
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
            if (credentialProvider(connecting.key)) setSearch("");
            setConnecting(null);
          }}
          onSaved={refresh}
        />
      )}
    </>
  );
}
