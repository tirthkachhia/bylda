import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  memorySourcesQuery,
  memoryArtifactsQuery,
  addMemorySource,
  deleteMemorySource,
  type MemorySource,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BusinessMemory } from "@/components/app/BusinessMemory";
import {
  Brain,
  Plus,
  Search,
  FileText,
  Globe,
  Github,
  Database,
  ArrowRight,
  Upload,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Link2,
  Inbox,
  Trash2,
  RefreshCw,
  Clock,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/app/memory")({ component: MemoryPage });

/* ── Source type config ── */
const SOURCE_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    desc: string;
  }
> = {
  github: { label: "GitHub", icon: Github, desc: "Repos, issues, PRs, wikis" },
  notion: { label: "Notion", icon: BookOpen, desc: "Docs, databases, wikis" },
  "google-drive": { label: "Google Drive", icon: FileText, desc: "Docs, sheets, slides" },
  slack: { label: "Slack", icon: FileText, desc: "Messages and threads" },
  url: { label: "Website / URL", icon: Globe, desc: "Any public page or doc" },
  upload: { label: "File Upload", icon: Upload, desc: "PDFs, text, markdown, CSV" },
};

const SOURCE_TYPES = Object.keys(SOURCE_CONFIG);

const SUGGESTED_QUERIES = [
  "What is our current pricing strategy?",
  "Summarize our Q1 goals",
  "What's our ICP definition?",
  "What decisions were made about the API?",
  "Who are our primary competitors?",
];

/* ── Helpers ── */
function StatusBadge({ status }: { status: MemorySource["status"] }) {
  const isActive = status === "indexed";
  const label = { indexed: "Indexed", indexing: "Indexing…", pending: "Pending", error: "Error" }[
    status
  ];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium"
      style={
        isActive
          ? { background: "var(--primary-soft)", color: "var(--primary)" }
          : {
              background: "var(--surface-2)",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }
      }
    >
      {status === "indexing" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {status === "indexed" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

function MemoryPage() {
  const { user, currentOrgId } = useAuth();
  const queryClient = useQueryClient();

  const sourcesQ = useQuery({ ...memorySourcesQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const artifactsQ = useQuery({
    ...memoryArtifactsQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const sources = sourcesQ.data ?? [];
  const artifacts = artifactsQ.data ?? [];

  const [queryText, setQueryText] = useState("");
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"business" | "sources" | "artifacts" | "query">(
    "business",
  );
  const [urlInput, setUrlInput] = useState("");
  const [searchArtifacts, setSearchArtifacts] = useState("");

  const addSourceMutation = useMutation({
    mutationFn: (payload: {
      source_type: string;
      source_label: string | null;
      source_url: string | null;
    }) => addMemorySource(currentOrgId!, user!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory_sources", currentOrgId] });
      toast.success("Source added — indexing will begin shortly.");
      setUrlInput("");
    },
    onError: () => toast.error("Failed to add source."),
  });

  const deleteSourceMutation = useMutation({
    mutationFn: deleteMemorySource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory_sources", currentOrgId] });
      queryClient.invalidateQueries({ queryKey: ["memory_artifacts", currentOrgId] });
      toast.success("Source removed.");
    },
    onError: () => toast.error("Failed to remove source."),
  });

  const queryMutation = useMutation({
    mutationFn: async ({ query, orgId }: { query: string; orgId: string }) => {
      const { data, error } = await supabase.functions.invoke("memory-query", {
        body: { query, orgId },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { answer: string; sources_searched?: number };
    },
    onSuccess: (data) => setQueryAnswer(data.answer),
    onError: () => toast.error("Failed to query memory. Please try again."),
  });

  const handleIngestUrl = () => {
    if (!urlInput.trim()) return;
    addSourceMutation.mutate({
      source_type: "url",
      source_label: urlInput.trim(),
      source_url: urlInput.trim(),
    });
  };

  const handleConnectSource = (sourceType: string) => {
    addSourceMutation.mutate({
      source_type: sourceType,
      source_label: SOURCE_CONFIG[sourceType]?.label ?? sourceType,
      source_url: null,
    });
  };

  const indexedSources = sources.filter((s) => s.status === "indexed");
  const totalArtifacts = artifacts.length || sources.reduce((sum, s) => sum + s.artifact_count, 0);
  const lastSynced = sources
    .map((s) => s.last_synced_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  const filteredArtifacts = searchArtifacts
    ? artifacts.filter((a) => a.title.toLowerCase().includes(searchArtifacts.toLowerCase()))
    : artifacts;

  const isLoading = sourcesQ.isLoading || artifactsQ.isLoading;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--primary)" }}
            >
              Company Memory
            </span>
          </div>
          <h1
            className="font-display text-[22px] font-bold tracking-tight"
            style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
          >
            AI-queryable knowledge base
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Connect your tools, ingest artifacts, and query your company context in plain language.
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--border)" }}
      >
        {[
          {
            label: "Sources",
            value: isLoading ? "—" : String(indexedSources.length),
            sub: "indexed",
          },
          { label: "Artifacts", value: isLoading ? "—" : String(totalArtifacts), sub: "documents" },
          {
            label: "Last synced",
            value: isLoading
              ? "—"
              : lastSynced
                ? new Date(lastSynced).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—",
            sub: "auto-updates",
          },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="flex flex-col px-5 py-4"
            style={{ background: "var(--surface)" }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--muted-foreground)" }}
            >
              {label}
            </span>
            <span
              className="mt-1 font-mono font-bold text-xl tabular-nums"
              style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
            >
              {value}
            </span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {sub}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 rounded-lg p-1"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          width: "fit-content",
        }}
      >
        {(["business", "sources", "artifacts", "query"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="rounded-md px-4 py-1.5 text-[12.5px] font-medium transition-colors"
            style={
              activeTab === tab
                ? {
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                  }
                : { color: "var(--muted-foreground)" }
            }
          >
            {tab === "query"
              ? "Ask AI"
              : tab === "business"
                ? "Business Memory"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "sources" && sources.length > 0 && (
              <span
                className="ml-1.5 rounded-full px-1.5 py-px text-[9px] font-semibold"
                style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
              >
                {sources.length}
              </span>
            )}
            {tab === "artifacts" && artifacts.length > 0 && (
              <span
                className="ml-1.5 rounded-full px-1.5 py-px text-[9px] font-semibold"
                style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
              >
                {artifacts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── BUSINESS MEMORY TAB ── */}
      {activeTab === "business" && user && (
        <BusinessMemory userId={user.id} orgId={currentOrgId ?? ""} />
      )}

      {/* ── SOURCES TAB ── */}
      {activeTab === "sources" && (
        <div className="space-y-4">
          {/* Empty state */}
          {!isLoading && sources.length === 0 && (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
            >
              <Inbox
                className="h-7 w-7 mx-auto mb-3"
                style={{ color: "var(--muted-foreground)", opacity: 0.4 }}
              />
              <p className="text-[13.5px] font-semibold" style={{ color: "var(--foreground)" }}>
                No sources connected
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                Add a source below to start building your company knowledge base.
              </p>
            </div>
          )}

          {/* Connected sources list */}
          {sources.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="px-5 py-3 flex items-center"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  CONNECTED SOURCES
                </span>
              </div>
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {sources.map((src) => {
                  const cfg = SOURCE_CONFIG[src.source_type];
                  const Icon = cfg?.icon ?? FileText;
                  return (
                    <li key={src.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Icon className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[13px] font-medium truncate"
                          style={{ color: "var(--foreground)" }}
                        >
                          {src.source_label ?? cfg?.label ?? src.source_type}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[11px]"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {src.artifact_count} artifact{src.artifact_count !== 1 ? "s" : ""}
                          </span>
                          {src.last_synced_at && (
                            <>
                              <span style={{ color: "var(--border)" }}>·</span>
                              <span
                                className="flex items-center gap-1 text-[11px]"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                <Clock className="h-3 w-3" />
                                {new Date(src.last_synced_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={src.status} />
                      <button
                        onClick={() => deleteSourceMutation.mutate(src.id)}
                        disabled={deleteSourceMutation.isPending}
                        className="ml-2 rounded-md p-1.5 transition-colors"
                        style={{ color: "var(--muted-foreground)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color = "var(--destructive)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                        }}
                        title="Remove source"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Add source grid */}
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              Add a source
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SOURCE_TYPES.filter((t) => t !== "url" && t !== "upload").map((sourceType) => {
                const cfg = SOURCE_CONFIG[sourceType];
                const Icon = cfg.icon;
                const alreadyAdded = sources.some((s) => s.source_type === sourceType);
                return (
                  <button
                    key={sourceType}
                    onClick={() => !alreadyAdded && handleConnectSource(sourceType)}
                    disabled={alreadyAdded || addSourceMutation.isPending}
                    className="flex items-center gap-3 rounded-xl p-4 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => {
                      if (!alreadyAdded)
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "color-mix(in oklab, var(--primary) 35%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <Icon className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {cfg.label}
                        </span>
                        {alreadyAdded && (
                          <CheckCircle2
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: "var(--success)" }}
                          />
                        )}
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        {cfg.desc}
                      </span>
                    </div>
                    {!alreadyAdded && (
                      <Plus
                        className="h-4 w-4 shrink-0"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* URL ingest */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                Ingest a URL
              </span>
              <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                — any public page, doc, or Notion URL
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIngestUrl()}
                placeholder="https://notion.so/your-doc or any public URL…"
                className="flex-1 rounded-lg px-3.5 py-2 text-[13px] outline-none transition"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "color-mix(in oklab, var(--primary) 50%, transparent)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                }}
              />
              <button
                onClick={handleIngestUrl}
                disabled={!urlInput.trim() || addSourceMutation.isPending}
                className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--primary)" }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled)
                    (e.currentTarget as HTMLElement).style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "1";
                }}
              >
                {addSourceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Ingest"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ARTIFACTS TAB ── */}
      {activeTab === "artifacts" && (
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              value={searchArtifacts}
              onChange={(e) => setSearchArtifacts(e.target.value)}
              placeholder="Search artifacts…"
              className="w-full rounded-lg py-2 pl-9 pr-4 text-[13px] outline-none transition"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "color-mix(in oklab, var(--primary) 50%, transparent)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: "var(--muted-foreground)" }}
              />
            </div>
          ) : filteredArtifacts.length > 0 ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="grid grid-cols-12 px-5 py-2.5"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
              >
                {[
                  ["ARTIFACT", "col-span-5"],
                  ["SOURCE", "col-span-2"],
                  ["UPDATED", "col-span-3"],
                  ["STATUS", "col-span-2 text-right"],
                ].map(([h, cls]) => (
                  <span
                    key={h}
                    className={`text-[10px] font-semibold ${cls}`}
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {h}
                  </span>
                ))}
              </div>
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {filteredArtifacts.map((art) => {
                  const cfg = SOURCE_CONFIG[art.source_type];
                  const Icon = cfg?.icon ?? FileText;
                  return (
                    <li
                      key={art.id}
                      className="grid grid-cols-12 items-center gap-3 px-5 py-3 transition-colors"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <Icon
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--muted-foreground)" }}
                          />
                        </div>
                        <span
                          className="text-[13px] font-medium truncate"
                          style={{ color: "var(--foreground)" }}
                        >
                          {art.title}
                        </span>
                      </div>
                      <span
                        className="col-span-2 text-[11.5px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {art.source_label ?? cfg?.label ?? art.source_type}
                      </span>
                      <span
                        className="col-span-3 text-[11.5px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {new Date(art.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="col-span-2 flex justify-end">
                        <StatusBadge status={art.status as MemorySource["status"]} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
            >
              <Database
                className="h-7 w-7 mx-auto mb-3"
                style={{ color: "var(--muted-foreground)", opacity: 0.4 }}
              />
              <p className="text-[13.5px] font-semibold" style={{ color: "var(--foreground)" }}>
                {searchArtifacts ? "No matches" : "No artifacts indexed yet"}
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {searchArtifacts
                  ? "Try a different search term."
                  : "Add a source on the Sources tab to begin indexing."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── ASK AI TAB ── */}
      {activeTab === "query" && (
        <div className="space-y-4">
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                Ask about your company
              </span>
            </div>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="What is our ICP? Summarize our Q1 strategy. What was decided in the pricing meeting?"
              rows={4}
              className="w-full resize-none rounded-lg px-3.5 py-3 text-[13px] outline-none transition"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "color-mix(in oklab, var(--primary) 50%, transparent)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
                {indexedSources.length > 0
                  ? `Searching ${indexedSources.length} source${indexedSources.length !== 1 ? "s" : ""} · ${totalArtifacts} artifacts`
                  : "Connect and index sources to enable querying"}
              </span>
              <button
                onClick={() => {
                  if (currentOrgId && queryText.trim()) {
                    setQueryAnswer(null);
                    queryMutation.mutate({ query: queryText, orgId: currentOrgId });
                  }
                }}
                disabled={
                  indexedSources.length === 0 || !queryText.trim() || queryMutation.isPending
                }
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--primary)" }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled)
                    (e.currentTarget as HTMLElement).style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "1";
                }}
              >
                {queryMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    Ask <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Suggested queries */}
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQueryText(q)}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "color-mix(in oklab, var(--primary) 35%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Answer block */}
          {queryMutation.isPending && (
            <div
              className="flex items-center gap-3 rounded-xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Loader2
                className="h-4 w-4 animate-spin shrink-0"
                style={{ color: "var(--primary)" }}
              />
              <span className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Searching memory…
              </span>
            </div>
          )}

          {queryAnswer && !queryMutation.isPending && (
            <div
              className="rounded-xl p-5 space-y-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
                <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  Answer
                </span>
              </div>
              <div
                className="text-[13px] leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--foreground)" }}
              >
                {queryAnswer}
              </div>
            </div>
          )}

          {/* No sources callout */}
          {indexedSources.length === 0 && (
            <div
              className="flex items-center gap-4 rounded-xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <AlertCircle
                className="h-5 w-5 shrink-0"
                style={{ color: "var(--muted-foreground)" }}
              />
              <div className="flex-1">
                <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {sources.length === 0 ? "No sources connected" : "Sources not yet indexed"}
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {sources.length === 0
                    ? "Add at least one source on the Sources tab before querying."
                    : "Indexing in progress. This usually takes a few minutes."}
                </p>
              </div>
              {sources.length === 0 && (
                <button
                  onClick={() => setActiveTab("sources")}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold shrink-0 transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Add source <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              {sources.length > 0 && indexedSources.length === 0 && (
                <button
                  onClick={() =>
                    queryClient.invalidateQueries({ queryKey: ["memory_sources", currentOrgId] })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold shrink-0 transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
