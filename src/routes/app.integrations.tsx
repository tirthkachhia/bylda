import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { integrationsQuery, saveIntegration, type MaskedIntegration } from "@/lib/queries";
import { blockIfGuest } from "@/lib/guest";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Plus, Check, Lock, AlertTriangle, X, Plug } from "lucide-react";
import {
  CATALOG,
  CATEGORIES,
  POPULAR_INTEGRATIONS,
  searchCatalog,
  type IntegrationDef,
  type IntegrationField,
  type IntegrationCategory,
} from "@/lib/integrations-catalog";

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
});

// ── Icon component using Simple Icons CDN ─────────────────────────────────────
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
      className="flex shrink-0 items-center justify-center rounded-lg text-white font-bold"
      style={{ width: size + 8, height: size + 8, background: bg, fontSize: size * 0.45 }}
    >
      {name[0].toUpperCase()}
    </div>
  );
}

// ── Connect modal ─────────────────────────────────────────────────────────────
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
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Single-value integrations are modelled as a one-field list for uniformity.
  const fields: IntegrationField[] = item.fields ?? [
    {
      key: item.key,
      label: item.inputType === "url" ? "Webhook URL" : "API Key / Token",
      hint: item.hint,
      inputType: item.inputType === "url" ? "url" : "key",
    },
  ];

  const last4For = (key: string) =>
    connected.find((c) => c.integration_key === key)?.value_last4 ?? null;
  const isFieldConnected = (key: string) =>
    connected.some((c) => c.integration_key === key && c.is_connected);
  const anyConnected = fields.some((f) => isFieldConnected(f.key));

  const setVal = (key: string, v: string) => {
    setVals((prev) => ({ ...prev, [key]: v }));
    setErr(null);
  };

  const save = async () => {
    if (blockIfGuest("Sign up to connect integrations.")) return;
    if (!user) return;

    // Fields the user actually typed into this time.
    const entered = fields.filter((f) => (vals[f.key] ?? "").trim().length > 0);

    // Require every non-optional field that isn't already connected.
    const missing = fields.filter(
      (f) => !f.optional && !isFieldConnected(f.key) && (vals[f.key] ?? "").trim().length === 0,
    );
    if (missing.length > 0) {
      setErr(`Enter ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    if (entered.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      for (const f of entered) {
        await saveIntegration(f.key, vals[f.key].trim());
      }
      toast.success(`${item.name} ${anyConnected ? "updated" : "connected"}`);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (blockIfGuest("Sign up to manage integrations.")) return;
    if (!user) return;
    setSaving(true);
    try {
      for (const f of fields) {
        if (isFieldConnected(f.key)) await saveIntegration(f.key, "");
      }
      toast.success(`${item.name} disconnected`);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <IntegrationIcon slug={item.iconSlug} name={item.name} size={24} />
            <DialogTitle className="text-base">{item.name}</DialogTitle>
          </div>
          <DialogDescription className="text-[12.5px]">{item.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {item.comingSoon ? (
            <div
              className="rounded-xl px-4 py-3 text-[12.5px]"
              style={{
                background: "color-mix(in oklab, var(--primary) 8%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
                color: "var(--muted-foreground)",
              }}
            >
              <Lock className="inline h-3.5 w-3.5 mr-1.5" />
              OAuth integration coming soon. Check back shortly.
            </div>
          ) : (
            <>
              {item.fields && (
                <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                  Connect your own account — these credentials are encrypted and used to run your
                  automations on your behalf.
                </div>
              )}

              {fields.map((f) => {
                const fieldConnected = isFieldConnected(f.key);
                return (
                  <div key={f.key}>
                    <label
                      htmlFor={`integration-${f.key}`}
                      className="block mb-1.5 text-[12px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {f.label}
                      {fieldConnected && (
                        <span
                          className="ml-2 text-[11px] font-normal"
                          style={{ color: "var(--success)" }}
                        >
                          Saved (…{last4For(f.key)})
                        </span>
                      )}
                    </label>
                    <Input
                      id={`integration-${f.key}`}
                      name={`integration_${f.key}`}
                      placeholder={fieldConnected ? "Leave blank to keep current" : f.hint}
                      value={vals[f.key] ?? ""}
                      onChange={(e) => setVal(f.key, e.target.value)}
                      type={f.inputType === "key" ? "password" : "text"}
                      className="rounded-xl text-[12.5px]"
                      style={{
                        background: "var(--surface-2)",
                        ...(err
                          ? {
                              border:
                                "1px solid color-mix(in oklab, var(--destructive) 60%, transparent)",
                            }
                          : {}),
                      }}
                    />
                  </div>
                );
              })}

              {err && (
                <div
                  className="flex items-center gap-1.5 text-[11.5px]"
                  style={{ color: "var(--destructive)" }}
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {err}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 rounded-xl py-2 text-[13px] font-semibold text-white transition disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, var(--primary), var(--accent))",
                    boxShadow: "0 3px 10px color-mix(in oklab, var(--primary) 30%, transparent)",
                  }}
                >
                  {saving ? "Saving…" : anyConnected ? "Update" : "Connect"}
                </button>
                {anyConnected && (
                  <button
                    onClick={disconnect}
                    disabled={saving}
                    className="rounded-xl px-3 py-2 text-[12px] font-medium transition"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--destructive)",
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Custom integration modal ──────────────────────────────────────────────────
function CustomModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const derivedKey = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);

  useEffect(() => {
    if (!key || key === derivedKey) setKey(derivedKey);
  }, [derivedKey]); // eslint-disable-line

  const save = async () => {
    if (blockIfGuest("Sign up to add integrations.")) return;
    if (!user) return;
    if (!key || !val) {
      setErr("Name and credential are required.");
      return;
    }
    if (!/^[a-z][a-z0-9_-]{1,62}$/.test(key)) {
      setErr("Key must be lowercase letters, numbers, underscores, or dashes.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await saveIntegration(key, val);
      toast.success(`${name || key} connected`);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <Plug className="h-4 w-4" style={{ color: "var(--primary)" }} />
            </div>
            <DialogTitle className="text-base">Custom Integration</DialogTitle>
          </div>
          <DialogDescription className="text-[12.5px]">
            Connect any tool not in the catalog — paste any API key, token, or URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div>
            <label
              htmlFor="custom-integration-name"
              className="block mb-1.5 text-[12px] font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Integration name
            </label>
            <Input
              id="custom-integration-name"
              name="integration_name"
              placeholder="e.g. My CRM"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl text-[12.5px]"
              style={{ background: "var(--surface-2)" }}
            />
          </div>

          <div>
            <label
              htmlFor="custom-integration-key"
              className="block mb-1.5 text-[12px] font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Key identifier{" "}
              <span className="font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                (auto-generated)
              </span>
            </label>
            <Input
              id="custom-integration-key"
              name="integration_key"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              className="rounded-xl text-[12.5px] font-mono"
              style={{ background: "var(--surface-2)" }}
            />
          </div>

          <div>
            <label
              htmlFor="custom-integration-value"
              className="block mb-1.5 text-[12px] font-medium"
              style={{ color: "var(--foreground)" }}
            >
              API key / token / URL
            </label>
            <Input
              id="custom-integration-value"
              name="integration_value"
              placeholder="Paste your credential here"
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                setErr(null);
              }}
              type="password"
              className="rounded-xl text-[12.5px]"
              style={{
                background: "var(--surface-2)",
                ...(err
                  ? { border: "1px solid color-mix(in oklab, var(--destructive) 60%, transparent)" }
                  : {}),
              }}
            />
          </div>

          {err && (
            <div
              className="flex items-center gap-1.5 text-[11.5px]"
              style={{ color: "var(--destructive)" }}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {err}
            </div>
          )}

          <button
            onClick={save}
            disabled={saving || !key || !val}
            className="w-full rounded-xl py-2 text-[13px] font-semibold text-white transition disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--accent))",
              boxShadow: "0 3px 10px color-mix(in oklab, var(--primary) 30%, transparent)",
            }}
          >
            {saving ? "Saving…" : "Save integration"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────
function IntegrationCard({
  item,
  isConnected,
  existingLast4,
  onClick,
}: {
  item: IntegrationDef;
  isConnected: boolean;
  existingLast4?: string | null;
  onClick: () => void;
}) {
  return (
    <div
      className="bylda-card flex flex-col p-4 cursor-pointer transition-all duration-200 hover:scale-[1.01]"
      style={{
        border: isConnected
          ? "1px solid color-mix(in oklab, var(--success) 30%, transparent)"
          : undefined,
        boxShadow: isConnected
          ? "0 0 12px color-mix(in oklab, var(--success) 8%, transparent)"
          : undefined,
      }}
      onClick={!item.comingSoon ? onClick : undefined}
    >
      {isConnected && (
        <div
          className="h-[2px] -mx-4 -mt-4 mb-3 rounded-t-2xl"
          style={{
            background: "linear-gradient(90deg, transparent, var(--success), transparent)",
          }}
        />
      )}
      <div className="flex items-start justify-between gap-2 mb-3">
        <IntegrationIcon slug={item.iconSlug} name={item.name} />
        <StatusPill tone={isConnected ? "success" : item.comingSoon ? "muted" : "muted"}>
          {isConnected ? "Connected" : item.comingSoon ? "Soon" : "Not connected"}
        </StatusPill>
      </div>

      <div className="flex-1">
        <h3 className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--foreground)" }}>
          {item.name}
        </h3>
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {item.description}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
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
          disabled={item.comingSoon}
          onClick={(e) => {
            e.stopPropagation();
            if (!item.comingSoon) onClick();
          }}
        >
          {item.comingSoon ? (
            <>
              <Lock className="h-3 w-3 mr-1" /> Soon
            </>
          ) : isConnected ? (
            <>
              <Check className="h-3 w-3 mr-1" /> Manage
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function IntegrationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const intQ = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  const connected = intQ.data ?? [];

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<IntegrationCategory>("All");
  const [connecting, setConnecting] = useState<IntegrationDef | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const filtered = searchCatalog(search, category);
  const popularItems = POPULAR_INTEGRATIONS.filter((i) => !search && category === "All");

  function isConnected(key: string) {
    return connected.some((c) => c.integration_key === key && c.is_connected);
  }
  function getLast4(key: string) {
    return connected.find((c) => c.integration_key === key)?.value_last4 ?? null;
  }

  const refresh = () => {
    if (user) qc.invalidateQueries({ queryKey: ["user_integrations", user.id] });
  };

  const connectedCount = connected.filter((c) => c.is_connected).length;

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Connect your entire stack."
        description={`${CATALOG.length}+ integrations available. Connect any tool your business uses — or add your own.`}
      />

      {/* Stats bar */}
      {connectedCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-2xl px-5 py-3 mb-2"
          style={{
            background: "color-mix(in oklab, var(--success) 8%, var(--surface))",
            border: "1px solid color-mix(in oklab, var(--success) 25%, transparent)",
          }}
        >
          <Check className="h-4 w-4" style={{ color: "var(--success)" }} />
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
            {connectedCount} integration{connectedCount !== 1 ? "s" : ""} connected
          </span>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            id="integrations-search"
            name="integrations_search"
            type="text"
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] outline-none transition"
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
              <X className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-150"
                style={
                  active
                    ? {
                        background: "var(--primary)",
                        color: "white",
                      }
                    : {
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--muted-foreground)",
                      }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Popular / featured section */}
      {popularItems.length > 0 && (
        <div>
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Popular
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {popularItems.map((item) => (
              <IntegrationCard
                key={item.key}
                item={item}
                isConnected={isConnected(item.key)}
                existingLast4={getLast4(item.key)}
                onClick={() => setConnecting(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All / filtered results */}
      <div>
        {(search || category !== "All") && (
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {category !== "All" ? ` in ${category}` : ""}
            {search ? ` for "${search}"` : ""}
          </div>
        )}
        {!search && category === "All" && (
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            All integrations
          </div>
        )}

        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl py-16 text-center"
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
            }}
          >
            <Search className="h-8 w-8 mb-3" style={{ color: "var(--muted-foreground)" }} />
            <div className="text-[13px] font-medium mb-1" style={{ color: "var(--foreground)" }}>
              No integrations found
            </div>
            <div className="text-[12px] mb-4" style={{ color: "var(--muted-foreground)" }}>
              Can't find what you need? Add it as a custom integration.
            </div>
            <Button size="sm" variant="outline" onClick={() => setCustomOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add custom
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((item) => (
              <IntegrationCard
                key={item.key}
                item={item}
                isConnected={isConnected(item.key)}
                existingLast4={getLast4(item.key)}
                onClick={() => setConnecting(item)}
              />
            ))}

            {/* Custom integration add card */}
            <div
              className="bylda-card flex flex-col items-center justify-center p-6 cursor-pointer transition-all duration-200 hover:scale-[1.01] text-center"
              style={{
                border: "1px dashed color-mix(in oklab, var(--border) 80%, transparent)",
              }}
              onClick={() => setCustomOpen(true)}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: "color-mix(in oklab, var(--primary) 10%, var(--surface-2))",
                  border: "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
                }}
              >
                <Plus className="h-5 w-5" style={{ color: "var(--primary)" }} />
              </div>
              <div
                className="text-[13px] font-semibold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                Add custom
              </div>
              <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                Connect any API not in the catalog
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {connecting && (
        <ConnectModal
          item={connecting}
          connected={connected}
          onClose={() => setConnecting(null)}
          onSaved={refresh}
        />
      )}

      {customOpen && <CustomModal onClose={() => setCustomOpen(false)} onSaved={refresh} />}
    </>
  );
}
