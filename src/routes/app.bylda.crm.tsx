import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { CustomersNav } from "@/components/app/CustomersNav";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  X,
  Sparkles,
  Building2,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  DollarSign,
  Target,
  Loader2,
  Trash2,
  SlidersHorizontal,
  Tag,
  FileText,
  Settings2,
  ChevronDown,
  CheckSquare,
  ArrowRight,
  MessageSquare,
  BarChart3,
  Star,
  Check,
  GripVertical,
  Flag,
  AlertCircle,
  Pencil,
  Eye,
  EyeOff,
  Filter,
  MoreHorizontal,
  UserCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { leadsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { blockIfGuest } from "@/lib/guest";
import { Switch } from "@/components/ui/switch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { MomentumRail } from "@/components/bylda/MomentumRail";
import { CrmNextBestAction } from "@/components/bylda/CrmNextBestAction";
import { refreshForecast, refreshPipelineInsights } from "@/lib/crm";

export const Route = createFileRoute("/app/bylda/crm")({ component: CRMPage });

/* ── Types ─────────────────────────────────────────────────────── */
const STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"] as const;
type Stage = (typeof STAGES)[number];
type Priority = "low" | "medium" | "high";
type CRMView = "kanban" | "table" | "list" | "forecast";
type ActivityType = "note" | "stage_change" | "email" | "call" | "task" | "meeting";

interface Deal {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  notes: string | null;
  stage: Stage;
  value: number | null;
  probability: number;
  close_date: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  score: number;
  priority: Priority;
  owner_name: string | null;
}

interface Activity {
  id: string;
  deal_id: string;
  organization_id: string;
  user_id: string | null;
  type: ActivityType;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface CRMSettings {
  showProbability: boolean;
  showScore: boolean;
  showTags: boolean;
  compactView: boolean;
  showClosed: boolean;
  colValue: boolean;
  colProbability: boolean;
  colScore: boolean;
  colCloseDate: boolean;
  colTags: boolean;
  colPriority: boolean;
  colSource: boolean;
  colUpdated: boolean;
}

const DEFAULT_SETTINGS: CRMSettings = {
  showProbability: true,
  showScore: true,
  showTags: true,
  compactView: false,
  showClosed: true,
  colValue: true,
  colProbability: true,
  colScore: true,
  colCloseDate: true,
  colTags: true,
  colPriority: true,
  colSource: false,
  colUpdated: false,
};

/* ── Stage + Priority config ──────────────────────────────────── */
const STAGE_CONFIG: Record<Stage, { color: string; bg: string; text: string }> = {
  New: { color: "#6B7280", bg: "rgba(107,114,128,0.10)", text: "#374151" },
  Contacted: { color: "#3B82F6", bg: "rgba(59,130,246,0.10)", text: "#1D4ED8" },
  Qualified: { color: "#7C3AED", bg: "rgba(2, 132, 199,0.10)", text: "#5B21B6" },
  Proposal: { color: "#D97706", bg: "rgba(217,119,6,0.10)", text: "#92400E" },
  Won: { color: "#059669", bg: "rgba(5,150,105,0.10)", text: "#065F46" },
  Lost: { color: "#DC2626", bg: "rgba(220,38,38,0.10)", text: "#991B1B" },
};

const PRIORITY_CONFIG: Record<
  Priority,
  { color: string; bg: string; text: string; label: string }
> = {
  low: { color: "#6B7280", bg: "rgba(107,114,128,0.10)", text: "#374151", label: "Low" },
  medium: { color: "#D97706", bg: "rgba(217,119,6,0.10)", text: "#92400E", label: "Medium" },
  high: { color: "#DC2626", bg: "rgba(220,38,38,0.10)", text: "#991B1B", label: "High" },
};

const ACTIVITY_CONFIG: Record<
  ActivityType,
  { icon: React.ElementType; color: string; label: string }
> = {
  note: { icon: MessageSquare, color: "#6B7280", label: "Note" },
  stage_change: { icon: ArrowRight, color: "#7C3AED", label: "Stage Change" },
  email: { icon: Mail, color: "#3B82F6", label: "Email" },
  call: { icon: Phone, color: "#059669", label: "Call" },
  task: { icon: CheckSquare, color: "#D97706", label: "Task" },
  meeting: { icon: Calendar, color: "#EC4899", label: "Meeting" },
};

/* ── Tag colors ── */
const TAG_PALETTES = [
  { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  { bg: "#FDF4FF", text: "#7E22CE", border: "#E9D5FF" },
  { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3" },
  { bg: "#F0FDFA", text: "#0F766E", border: "#99F6E4" },
  { bg: "#FEFCE8", text: "#A16207", border: "#FEF08A" },
];

function tagColor(tag: string) {
  const h = tag.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return TAG_PALETTES[h % TAG_PALETTES.length];
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}k`
      : `$${n}`;
const fmtFull = (n: number) => `$${Number(n).toLocaleString()}`;

const SETTINGS_STORAGE = "bylda-crm-settings";

function loadSettings(): CRMSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* */
  }
  return DEFAULT_SETTINGS;
}

/* ══════════════════════════════ PAGE ════════════════════════════ */
function CRMPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ ...leadsQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const rawDeals = (q.data ?? []) as Deal[];

  // Live pipeline: refresh when any lead for this org changes (drag by a
  // teammate, a won-deal automation, etc.). leads is in the realtime publication.
  useEffect(() => {
    if (!currentOrgId) return;
    const channel = supabase
      .channel(`leads-rt:${currentOrgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `organization_id=eq.${currentOrgId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["leads", currentOrgId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentOrgId, qc]);

  const [view, setView] = useState<CRMView>("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "All">("All");
  const [tagFilter, setTagFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);

  const [settings, setSettings] = useState<CRMSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
    } catch {
      /* */
    }
  }, [settings]);

  const setSetting = useCallback(<K extends keyof CRMSettings>(k: K, v: CRMSettings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }));
  }, []);

  /* Deals pipeline (show/hide closed) */
  const deals = useMemo(() => {
    if (settings.showClosed) return rawDeals;
    return rawDeals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
  }, [rawDeals, settings.showClosed]);

  /* All tags collected */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    rawDeals.forEach((d) => (d.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [rawDeals]);

  /* All sources collected */
  const allSources = useMemo(() => {
    const set = new Set<string>();
    rawDeals.forEach((d) => {
      if (d.source) set.add(d.source);
    });
    return Array.from(set).sort();
  }, [rawDeals]);

  /* Filtered */
  const filtered = useMemo(() => {
    let arr = deals;
    if (stageFilter !== "All") arr = arr.filter((d) => d.stage === stageFilter);
    if (priorityFilter !== "All")
      arr = arr.filter((d) => (d.priority ?? "medium") === priorityFilter);
    if (tagFilter) arr = arr.filter((d) => (d.tags ?? []).includes(tagFilter));
    if (sourceFilter) arr = arr.filter((d) => d.source === sourceFilter);
    if (scoreMin > 0 || scoreMax < 100)
      arr = arr.filter((d) => (d.score ?? 0) >= scoreMin && (d.score ?? 0) <= scoreMax);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (d) =>
          d.name?.toLowerCase().includes(s) ||
          d.email?.toLowerCase().includes(s) ||
          d.company?.toLowerCase().includes(s) ||
          d.source?.toLowerCase().includes(s) ||
          (d.tags ?? []).some((t) => t.toLowerCase().includes(s)),
      );
    }
    return arr;
  }, [deals, stageFilter, priorityFilter, tagFilter, sourceFilter, scoreMin, scoreMax, search]);

  const hasActiveFilters =
    stageFilter !== "All" ||
    priorityFilter !== "All" ||
    tagFilter !== "" ||
    sourceFilter !== "" ||
    scoreMin > 0 ||
    scoreMax < 100;

  /* KPIs */
  const pipeline = deals
    .filter((d) => d.stage !== "Lost" && d.stage !== "Won")
    .reduce((s, d) => s + (d.value || 0), 0);
  const won = deals.filter((d) => d.stage === "Won").reduce((s, d) => s + (d.value || 0), 0);
  const active = deals.filter((d) => d.stage !== "Lost" && d.stage !== "Won").length;
  const closed = deals.filter((d) => d.stage === "Won" || d.stage === "Lost").length;
  const winRate =
    closed > 0 ? Math.round((deals.filter((d) => d.stage === "Won").length / closed) * 100) : 0;
  const avgSize = active > 0 ? Math.round(pipeline / active) : 0;
  const weighted = deals
    .filter((d) => d.stage !== "Lost")
    .reduce((s, d) => s + (d.value || 0) * (d.probability / 100), 0);

  /* Mutations */
  const updateStage = useMutation({
    mutationFn: async ({
      id,
      stage,
      fromStage,
    }: {
      id: string;
      stage: Stage;
      fromStage: Stage;
    }) => {
      const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
      if (error) throw error;
      if (currentOrgId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("crm_activities").insert({
          organization_id: currentOrgId,
          deal_id: id,
          type: "stage_change",
          content: `Moved from ${fromStage} to ${stage}`,
          metadata: { from_stage: fromStage, to_stage: stage },
        });
      }
    },
    onSuccess: (_, { stage }) => {
      qc.invalidateQueries({ queryKey: ["leads", currentOrgId] });
      qc.invalidateQueries({ queryKey: ["crm_activities"] });
      if (selectedDeal) setSelectedDeal((d) => (d ? { ...d, stage } : d));
      toast.success(`Moved to ${stage}`);
    },
    onError: () => toast.error("Failed to update stage"),
  });

  const saveNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("leads").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", currentOrgId] });
      toast.success("Notes saved");
    },
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", currentOrgId] });
      setSelectedDeal(null);
      setSelectedIds(new Set());
      toast.success("Deal deleted");
    },
  });

  const bulkUpdateStage = useMutation({
    mutationFn: async ({ ids, stage }: { ids: string[]; stage: Stage }) => {
      const { error } = await supabase.from("leads").update({ stage }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, { stage }) => {
      qc.invalidateQueries({ queryKey: ["leads", currentOrgId] });
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} deals moved to ${stage}`);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", currentOrgId] });
      setSelectedIds(new Set());
      if (selectedDeal && selectedIds.has(selectedDeal.id)) setSelectedDeal(null);
      toast.success("Deals deleted");
    },
  });

  /* DnD */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDealId(e.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDealId(null);
      const { active, over } = e;
      if (!over) return;
      const newStage = over.id as Stage;
      const deal = rawDeals.find((d) => d.id === active.id);
      if (!deal || deal.stage === newStage) return;
      if (blockIfGuest("Sign up to move deals.")) return;
      updateStage.mutate({ id: deal.id, stage: newStage, fromStage: deal.stage });
    },
    [rawDeals, updateStage],
  );

  const activeDeal = activeDealId ? rawDeals.find((d) => d.id === activeDealId) : null;

  const onSelect = (d: Deal) => setSelectedDeal((prev) => (prev?.id === d.id ? null : d));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setStageFilter("All");
    setPriorityFilter("All");
    setTagFilter("");
    setSourceFilter("");
    setScoreMin(0);
    setScoreMax(100);
  };

  return (
    <div className="flex flex-col h-full -mx-5 -my-5 md:-mx-7 md:-my-6">
      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="space-y-2.5">
            <CustomersNav />
            <h1
              className="font-display text-[22px] font-bold tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              Pipeline
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {deals.length} deal{deals.length !== 1 ? "s" : ""} · {fmt(weighted)} weighted forecast
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div
              className="flex rounded-lg p-0.5 gap-0.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              {(
                [
                  ["kanban", LayoutGrid, "Kanban"],
                  ["table", SlidersHorizontal, "Table"],
                  ["list", List, "List"],
                  ["forecast", BarChart3, "Forecast"],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  title={label}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-all"
                  style={
                    view === v
                      ? {
                          background: "var(--background)",
                          color: "var(--foreground)",
                          boxShadow: "var(--shadow-xs)",
                        }
                      : { color: "var(--muted-foreground)" }
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => {
                  setSettingsOpen((o) => !o);
                  setFilterOpen(false);
                }}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-medium transition-colors"
                style={{
                  background: settingsOpen ? "var(--surface-2)" : "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--muted-foreground)",
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Display</span>
              </button>
              {settingsOpen && (
                <CRMSettingsPanel
                  settings={settings}
                  onSet={setSetting}
                  onClose={() => setSettingsOpen(false)}
                />
              )}
            </div>
            {/* Advanced filter */}
            <div className="relative">
              <button
                onClick={() => {
                  setFilterOpen((o) => !o);
                  setSettingsOpen(false);
                }}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-medium transition-colors"
                style={{
                  background: hasActiveFilters ? "var(--primary-soft)" : "transparent",
                  border: `1px solid ${hasActiveFilters ? "var(--primary-border)" : "var(--border)"}`,
                  color: hasActiveFilters ? "var(--primary)" : "var(--muted-foreground)",
                }}
              >
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filter{hasActiveFilters ? " •" : ""}</span>
              </button>
              {filterOpen && (
                <AdvancedFilterPanel
                  allTags={allTags}
                  allSources={allSources}
                  tagFilter={tagFilter}
                  sourceFilter={sourceFilter}
                  priorityFilter={priorityFilter}
                  scoreMin={scoreMin}
                  scoreMax={scoreMax}
                  onTagFilter={setTagFilter}
                  onSourceFilter={setSourceFilter}
                  onPriorityFilter={setPriorityFilter}
                  onScoreMin={setScoreMin}
                  onScoreMax={setScoreMax}
                  onReset={resetFilters}
                  onClose={() => setFilterOpen(false)}
                />
              )}
            </div>
            <InsightsRefreshButton orgId={currentOrgId} />
            <button
              onClick={() => {
                if (blockIfGuest("Sign up to add deals.")) return;
                setAddOpen(true);
              }}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold transition-colors"
              style={{ background: "var(--primary)", color: "white" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--primary-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--primary)";
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Deal
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Pipeline", value: fmt(pipeline), icon: TrendingUp, accent: "#7C3AED" },
            { label: "Won", value: fmt(won), icon: DollarSign, accent: "#059669" },
            { label: "Weighted", value: fmt(Math.round(weighted)), icon: Star, accent: "#3B82F6" },
            { label: "Active", value: String(active), icon: Target, accent: "#3B82F6" },
            { label: "Win Rate", value: `${winRate}%`, icon: SlidersHorizontal, accent: "#D97706" },
            { label: "Avg Deal", value: fmt(avgSize), icon: BarChart3, accent: "#EC4899" },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="rounded-xl p-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {label}
                </span>
                <div
                  className="h-5 w-5 rounded-md flex items-center justify-center"
                  style={{ background: `${accent}18` }}
                >
                  <Icon className="h-3 w-3" style={{ color: accent }} />
                </div>
              </div>
              <div
                className="font-display text-[16px] font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick filter bar ── */}
      <div
        className="shrink-0 flex items-center gap-2 px-6 py-2.5 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
      >
        <div className="relative shrink-0 w-[200px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals, tags…"
            className="w-full h-8 rounded-lg pl-8 pr-3 text-[12.5px] outline-none"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(["All", ...STAGES] as const).map((s) => {
            const cfg = s !== "All" ? STAGE_CONFIG[s] : null;
            const isActive = stageFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className="flex items-center gap-1.5 h-7 rounded-full px-2.5 text-[11.5px] font-medium whitespace-nowrap transition-all"
                style={
                  isActive
                    ? { background: cfg?.color ?? "var(--foreground)", color: "white" }
                    : { color: "var(--muted-foreground)", background: "transparent" }
                }
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {cfg && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: isActive ? "white" : cfg.color }}
                  />
                )}
                {s}
              </button>
            );
          })}
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="shrink-0 flex items-center gap-1 h-7 px-2 rounded-lg text-[11.5px] transition-colors"
            style={{ color: "var(--primary)" }}
          >
            <XCircle className="h-3 w-3" />
            Clear
          </button>
        )}
        <div className="ml-auto shrink-0 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          {filtered.length} deal{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          onStageChange={(stage) => {
            if (blockIfGuest("Sign up to bulk update.")) return;
            bulkUpdateStage.mutate({ ids: Array.from(selectedIds), stage });
          }}
          onDelete={() => {
            if (blockIfGuest("Sign up to delete.")) return;
            if (!confirm(`Delete ${selectedIds.size} deal(s)?`)) return;
            bulkDelete.mutate(Array.from(selectedIds));
          }}
          onClear={() => setSelectedIds(new Set())}
          isPending={bulkUpdateStage.isPending || bulkDelete.isPending}
        />
      )}

      {/* ── Main content + detail panel ── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {/* Bylda's single highest-leverage move across the pipeline */}
          {deals.length > 0 && (
            <CrmNextBestAction
              orgId={currentOrgId}
              className="mb-4"
              onAct={(a) => {
                const d = deals.find((x) => x.id === a.entity_id);
                if (d) onSelect(d);
              }}
            />
          )}
          {q.isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: "var(--muted-foreground)" }}
              />
            </div>
          ) : filtered.length === 0 && deals.length === 0 ? (
            <EmptyPipeline onAdd={() => setAddOpen(true)} />
          ) : view === "kanban" ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveDealId(null)}
            >
              <KanbanBoard
                deals={filtered}
                selectedId={selectedDeal?.id}
                selectedIds={selectedIds}
                onSelect={onSelect}
                onToggleSelect={toggleSelect}
                onAddInStage={() => setAddOpen(true)}
                settings={settings}
                activeDealId={activeDealId}
              />
              <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
                {activeDeal ? (
                  <div style={{ transform: "rotate(2deg)", opacity: 0.95, pointerEvents: "none" }}>
                    <DealCard
                      deal={activeDeal}
                      active={false}
                      selected={false}
                      settings={settings}
                      stageConfig={STAGE_CONFIG[activeDeal.stage]}
                      onClick={() => {}}
                      onToggleSelect={() => {}}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : view === "table" ? (
            <DealsTable
              deals={filtered}
              selectedId={selectedDeal?.id}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onToggleSelect={toggleSelect}
              onStageChange={(id, stage) => {
                if (blockIfGuest("Sign up to update deals.")) return;
                const deal = rawDeals.find((d) => d.id === id);
                if (deal) updateStage.mutate({ id, stage, fromStage: deal.stage });
              }}
              settings={settings}
            />
          ) : view === "list" ? (
            <DealsListView
              deals={filtered}
              selectedId={selectedDeal?.id}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onToggleSelect={toggleSelect}
              settings={settings}
            />
          ) : (
            <ForecastView deals={deals} orgId={currentOrgId} />
          )}
        </div>

        {/* Detail panel */}
        {selectedDeal && (
          <DealDetailPanel
            deal={selectedDeal}
            orgId={currentOrgId ?? ""}
            onClose={() => setSelectedDeal(null)}
            onStageChange={(stage) => {
              if (blockIfGuest("Sign up to update deals.")) return;
              updateStage.mutate({ id: selectedDeal.id, stage, fromStage: selectedDeal.stage });
            }}
            onSaveNotes={(notes) => saveNotes.mutate({ id: selectedDeal.id, notes })}
            onDelete={() => {
              if (blockIfGuest("Sign up to delete deals.")) return;
              if (!confirm("Delete this deal?")) return;
              deleteDeal.mutate(selectedDeal.id);
            }}
            onEdit={() => setEditDeal(selectedDeal)}
          />
        )}
      </div>

      {/* Add / Edit modal */}
      {(addOpen || editDeal) && (
        <DealFormModal
          deal={editDeal}
          allTags={allTags}
          onClose={() => {
            setAddOpen(false);
            setEditDeal(null);
          }}
          onSave={async (data) => {
            if (blockIfGuest("Sign up to manage deals.")) return;
            if (!currentOrgId) return;
            if (editDeal) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase as any)
                .from("leads")
                .update(data)
                .eq("id", editDeal.id);
              if (error) {
                toast.error(error.message);
                return;
              }
              toast.success("Deal updated");
              if (selectedDeal?.id === editDeal.id)
                setSelectedDeal((d) => (d ? { ...d, ...data } : d));
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase as any)
                .from("leads")
                .insert({ ...data, organization_id: currentOrgId });
              if (error) {
                toast.error(error.message);
                return;
              }
              toast.success("Deal created");
            }
            qc.invalidateQueries({ queryKey: ["leads", currentOrgId] });
            setAddOpen(false);
            setEditDeal(null);
          }}
        />
      )}
    </div>
  );
}

/* ════════════════════ CRM SETTINGS PANEL ════════════════════════ */
function CRMSettingsPanel({
  settings,
  onSet,
  onClose,
}: {
  settings: CRMSettings;
  onSet: <K extends keyof CRMSettings>(k: K, v: CRMSettings[K]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const Toggle = ({ label, k }: { label: string; k: keyof CRMSettings }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px]" style={{ color: "var(--foreground)" }}>
        {label}
      </span>
      <Switch
        checked={settings[k] as boolean}
        onCheckedChange={(v) => onSet(k, v as CRMSettings[typeof k])}
      />
    </div>
  );

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] rounded-xl shadow-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
          Display Settings
        </span>
        <button onClick={onClose}>
          <X className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>
      <div className="p-4 space-y-1">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--muted-foreground)" }}
        >
          Card Options
        </p>
        <div className="space-y-3">
          <Toggle label="Show probability bars" k="showProbability" />
          <Toggle label="Show lead score" k="showScore" />
          <Toggle label="Show tags" k="showTags" />
          <Toggle label="Compact view" k="compactView" />
          <Toggle label="Show won / lost deals" k="showClosed" />
        </div>
        <div className="h-px my-3" style={{ background: "var(--border)" }} />
        <p
          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--muted-foreground)" }}
        >
          Table Columns
        </p>
        <div className="space-y-3">
          <Toggle label="Value" k="colValue" />
          <Toggle label="Probability" k="colProbability" />
          <Toggle label="Lead Score" k="colScore" />
          <Toggle label="Close Date" k="colCloseDate" />
          <Toggle label="Tags" k="colTags" />
          <Toggle label="Priority" k="colPriority" />
          <Toggle label="Source" k="colSource" />
          <Toggle label="Last Updated" k="colUpdated" />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ ADVANCED FILTER PANEL ═════════════════════ */
function AdvancedFilterPanel({
  allTags,
  allSources,
  tagFilter,
  sourceFilter,
  priorityFilter,
  scoreMin,
  scoreMax,
  onTagFilter,
  onSourceFilter,
  onPriorityFilter,
  onScoreMin,
  onScoreMax,
  onReset,
  onClose,
}: {
  allTags: string[];
  allSources: string[];
  tagFilter: string;
  sourceFilter: string;
  priorityFilter: Priority | "All";
  scoreMin: number;
  scoreMax: number;
  onTagFilter: (t: string) => void;
  onSourceFilter: (s: string) => void;
  onPriorityFilter: (p: Priority | "All") => void;
  onScoreMin: (n: number) => void;
  onScoreMax: (n: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] rounded-xl shadow-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
          Advanced Filters
        </span>
        <button onClick={onClose}>
          <X className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Priority */}
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            Priority
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {(["All", "high", "medium", "low"] as const).map((p) => {
              const cfg = p !== "All" ? PRIORITY_CONFIG[p] : null;
              const isA = priorityFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => onPriorityFilter(p)}
                  className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-all"
                  style={
                    isA
                      ? { background: cfg?.color ?? "var(--foreground)", color: "white" }
                      : {
                          background: cfg?.bg ?? "var(--surface-2)",
                          color: cfg?.text ?? "var(--muted-foreground)",
                        }
                  }
                >
                  {p === "All" ? "All" : cfg!.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Tags */}
        {allTags.length > 0 && (
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              Tag
            </p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => onTagFilter("")}
                className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-all"
                style={{
                  background: tagFilter === "" ? "var(--foreground)" : "var(--surface-2)",
                  color: tagFilter === "" ? "white" : "var(--muted-foreground)",
                }}
              >
                All
              </button>
              {allTags.map((t) => {
                const c = tagColor(t);
                const isA = tagFilter === t;
                return (
                  <button
                    key={t}
                    onClick={() => onTagFilter(isA ? "" : t)}
                    className="rounded-full px-2.5 py-1 text-[11.5px] font-medium border transition-all"
                    style={
                      isA
                        ? { background: c.text, color: "white", borderColor: c.text }
                        : { background: c.bg, color: c.text, borderColor: c.border }
                    }
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Source */}
        {allSources.length > 0 && (
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              Source
            </p>
            <select
              value={sourceFilter}
              onChange={(e) => onSourceFilter(e.target.value)}
              className="w-full h-8 rounded-lg px-3 text-[12.5px] outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <option value="">All sources</option>
              {allSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* Score range */}
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            Lead Score: {scoreMin} – {scoreMax}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={scoreMin}
              onChange={(e) => onScoreMin(Number(e.target.value))}
              className="flex-1 h-1.5 accent-[var(--primary)]"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={scoreMax}
              onChange={(e) => onScoreMax(Number(e.target.value))}
              className="flex-1 h-1.5 accent-[var(--primary)]"
            />
          </div>
        </div>
        <button
          onClick={onReset}
          className="w-full rounded-lg py-2 text-[12.5px] font-medium transition-colors"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}

/* ════════════════════ BULK ACTIONS BAR ══════════════════════════ */
function BulkActionsBar({
  count,
  onStageChange,
  onDelete,
  onClear,
  isPending,
}: {
  count: number;
  onStageChange: (s: Stage) => void;
  onDelete: () => void;
  onClear: () => void;
  isPending: boolean;
}) {
  const [stageOpen, setStageOpen] = useState(false);
  return (
    <div
      className="shrink-0 flex items-center gap-3 px-6 py-2.5"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--primary-soft)" }}
    >
      <span className="text-[13px] font-semibold" style={{ color: "var(--primary)" }}>
        {count} selected
      </span>
      <div className="relative">
        <button
          onClick={() => setStageOpen((o) => !o)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium"
          style={{ background: "var(--primary)", color: "white" }}
        >
          Move to Stage <ChevronDown className="h-3 w-3 ml-1" />
        </button>
        {stageOpen && (
          <div
            className="absolute top-[calc(100%+4px)] left-0 z-50 rounded-lg shadow-lg overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {STAGES.map((s) => {
              const cfg = STAGE_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => {
                    onStageChange(s);
                    setStageOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-left"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: cfg.color }} />
                  <span style={{ color: "var(--foreground)" }}>{s}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium"
        style={{ background: "var(--destructive)", color: "white" }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
      <button
        onClick={onClear}
        className="ml-auto flex items-center gap-1 h-8 px-3 rounded-lg text-[12.5px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
        Clear
      </button>
    </div>
  );
}

/* ════════════════════════ KANBAN BOARD ══════════════════════════ */
function KanbanBoard({
  deals,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onAddInStage,
  settings,
  activeDealId,
}: {
  deals: Deal[];
  selectedId?: string;
  selectedIds: Set<string>;
  onSelect: (d: Deal) => void;
  onToggleSelect: (id: string) => void;
  onAddInStage: () => void;
  settings: CRMSettings;
  activeDealId: string | null;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 h-full">
      {STAGES.map((stage) => {
        const items = deals.filter((d) => d.stage === stage);
        const total = items.reduce((s, d) => s + (d.value || 0), 0);
        const cfg = STAGE_CONFIG[stage];
        return (
          <DroppableColumn
            key={stage}
            stage={stage}
            cfg={cfg}
            items={items}
            total={total}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onToggleSelect={onToggleSelect}
            onAdd={onAddInStage}
            settings={settings}
            activeDealId={activeDealId}
          />
        );
      })}
    </div>
  );
}

function DroppableColumn({
  stage,
  cfg,
  items,
  total,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onAdd,
  settings,
  activeDealId,
}: {
  stage: Stage;
  cfg: (typeof STAGE_CONFIG)[Stage];
  items: Deal[];
  total: number;
  selectedId?: string;
  selectedIds: Set<string>;
  onSelect: (d: Deal) => void;
  onToggleSelect: (id: string) => void;
  onAdd: () => void;
  settings: CRMSettings;
  activeDealId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      className="flex flex-col w-[264px] shrink-0 rounded-xl overflow-hidden transition-all"
      style={{
        background: isOver ? `${cfg.color}10` : "var(--surface)",
        border: isOver ? `1.5px solid ${cfg.color}` : "1px solid var(--border)",
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderBottom: `2px solid ${cfg.color}` }}
      >
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
        <span className="font-semibold text-[12.5px] flex-1" style={{ color: "var(--foreground)" }}>
          {stage}
        </span>
        <span
          className="rounded-full px-2 py-px text-[10.5px] font-medium"
          style={{ background: cfg.bg, color: cfg.text }}
        >
          {items.length}
        </span>
        {total > 0 && (
          <span className="font-mono text-[10.5px]" style={{ color: "var(--muted-foreground)" }}>
            {fmt(total)}
          </span>
        )}
        {isOver && <ArrowRight className="h-3 w-3 shrink-0" style={{ color: cfg.color }} />}
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[160px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-1.5">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: cfg.bg }}
            >
              <span className="text-[14px]">{isOver ? "📥" : "📋"}</span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>
              {isOver ? `Drop here` : "No deals"}
            </p>
          </div>
        ) : (
          items.map((d) => (
            <DraggableDealCard
              key={d.id}
              deal={d}
              active={selectedId === d.id}
              selected={selectedIds.has(d.id)}
              settings={settings}
              stageConfig={STAGE_CONFIG[d.stage]}
              onClick={() => onSelect(d)}
              onToggleSelect={() => onToggleSelect(d.id)}
              isDragActive={activeDealId === d.id}
            />
          ))
        )}
      </div>

      {/* Add button */}
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-2 text-[11.5px] transition-colors w-full"
        style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <Plus className="h-3 w-3" />
        Add deal
      </button>
    </div>
  );
}

function DraggableDealCard({
  deal,
  active,
  selected,
  settings,
  stageConfig,
  onClick,
  onToggleSelect,
  isDragActive,
}: {
  deal: Deal;
  active: boolean;
  selected: boolean;
  settings: CRMSettings;
  stageConfig: (typeof STAGE_CONFIG)[Stage];
  onClick: () => void;
  onToggleSelect: () => void;
  isDragActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stage: deal.stage },
  });

  const style: React.CSSProperties = {
    opacity: isDragging || isDragActive ? 0.3 : 1,
    transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    cursor: isDragging ? "grabbing" : "grab",
    position: "relative",
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard
        deal={deal}
        active={active}
        selected={selected}
        settings={settings}
        stageConfig={stageConfig}
        onClick={onClick}
        onToggleSelect={onToggleSelect}
      />
    </div>
  );
}

function DealCard({
  deal,
  active,
  selected,
  settings,
  stageConfig,
  onClick,
  onToggleSelect,
}: {
  deal: Deal;
  active: boolean;
  selected: boolean;
  settings: CRMSettings;
  stageConfig: (typeof STAGE_CONFIG)[Stage];
  onClick: () => void;
  onToggleSelect: () => void;
}) {
  const isCompact = settings.compactView;
  const tags = deal.tags ?? [];

  return (
    <div
      className="rounded-lg transition-all"
      style={{
        background: selected
          ? "var(--primary-soft)"
          : active
            ? "var(--primary-soft)"
            : "var(--background)",
        border: active
          ? "1.5px solid var(--primary-border)"
          : selected
            ? "1.5px solid var(--primary-border)"
            : "1px solid var(--border)",
        boxShadow: active ? "var(--shadow-glow-primary)" : "var(--shadow-xs)",
      }}
    >
      <div className="h-[3px] rounded-t-lg" style={{ background: stageConfig.color }} />
      <div className={isCompact ? "p-2" : "p-3"}>
        <div className="flex items-start gap-1.5 mb-1.5">
          {/* Select checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="shrink-0 mt-0.5 h-4 w-4 rounded flex items-center justify-center transition-colors"
            style={{
              border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
              background: selected ? "var(--primary)" : "transparent",
            }}
          >
            {selected && <Check className="h-2.5 w-2.5 text-white" />}
          </button>
          <div className="min-w-0 flex-1" onClick={onClick}>
            <div
              className="font-semibold text-[13px] truncate"
              style={{ color: "var(--foreground)" }}
            >
              {deal.name}
            </div>
            {(deal.company || deal.source) && !isCompact && (
              <div
                className="flex items-center gap-1 mt-0.5 text-[11px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Building2 className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{deal.company || deal.source}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0" onClick={onClick}>
            {deal.value ? (
              <span
                className="font-mono text-[12px] font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {fmt(deal.value)}
              </span>
            ) : null}
            {settings.showScore && <ScoreBadge score={deal.score ?? 0} />}
          </div>
        </div>

        <div onClick={onClick}>
          {deal.email && !isCompact && (
            <div
              className="flex items-center gap-1.5 text-[10.5px] mb-1.5"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Mail className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{deal.email}</span>
            </div>
          )}

          {/* Priority + tags row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {deal.priority && deal.priority !== "medium" && (
              <PriorityBadge priority={deal.priority} />
            )}
            {settings.showTags && tags.slice(0, 2).map((t) => <TagBadge key={t} tag={t} />)}
            {settings.showTags && tags.length > 2 && (
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                +{tags.length - 2}
              </span>
            )}
          </div>

          {/* Probability bar */}
          {settings.showProbability && !isCompact && (
            <div className="space-y-0.5">
              <div
                className="flex items-center justify-between text-[9.5px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span>Win probability</span>
                <span className="font-medium">{deal.probability}%</span>
              </div>
              <div className="h-1 rounded-full" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${deal.probability}%`, background: stageConfig.color }}
                />
              </div>
            </div>
          )}

          {deal.close_date && !isCompact && (
            <div
              className="flex items-center gap-1 mt-1.5 text-[10px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Calendar className="h-2.5 w-2.5" />
              {new Date(deal.close_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ TABLE VIEW ════════════════════════════ */
function DealsTable({
  deals,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onStageChange,
  settings,
}: {
  deals: Deal[];
  selectedId?: string;
  selectedIds: Set<string>;
  onSelect: (d: Deal) => void;
  onToggleSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  settings: CRMSettings;
}) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    return [...deals].sort((a, b) => {
      let va: string | number = ((a as unknown as Record<string, unknown>)[sortKey] ?? "") as
        | string
        | number;
      let vb: string | number = ((b as unknown as Record<string, unknown>)[sortKey] ?? "") as
        | string
        | number;
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [deals, sortKey, sortDir]);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const SortTh = ({ label, k }: { label: string; k: string }) => (
    <th
      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none"
      style={{ color: "var(--muted-foreground)" }}
      onClick={() => toggleSort(k)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === k && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </div>
    </th>
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <table className="w-full text-left">
        <thead>
          <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
            <th className="px-4 py-3 w-8" />
            <SortTh label="Deal" k="name" />
            <th
              className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--muted-foreground)" }}
            >
              Stage
            </th>
            {settings.colValue && <SortTh label="Value" k="value" />}
            {settings.colProbability && <SortTh label="Prob %" k="probability" />}
            {settings.colScore && <SortTh label="Score" k="score" />}
            {settings.colPriority && (
              <th
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Priority
              </th>
            )}
            {settings.colTags && (
              <th
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Tags
              </th>
            )}
            {settings.colCloseDate && <SortTh label="Close Date" k="close_date" />}
            {settings.colSource && (
              <th
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Source
              </th>
            )}
            {settings.colUpdated && <SortTh label="Updated" k="updated_at" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => {
            const cfg = STAGE_CONFIG[d.stage];
            const isSelected = selectedId === d.id;
            const isChecked = selectedIds.has(d.id);
            return (
              <tr
                key={d.id}
                onClick={() => onSelect(d)}
                className="cursor-pointer transition-colors"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: isSelected
                    ? "var(--primary-soft)"
                    : isChecked
                      ? "var(--primary-soft)"
                      : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !isChecked)
                    (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && !isChecked)
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onToggleSelect(d.id)}
                    className="h-4 w-4 rounded flex items-center justify-center transition-colors"
                    style={{
                      border: `1.5px solid ${isChecked ? "var(--primary)" : "var(--border)"}`,
                      background: isChecked ? "var(--primary)" : "transparent",
                    }}
                  >
                    {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-[13px]" style={{ color: "var(--foreground)" }}>
                    {d.name}
                  </div>
                  {(d.company || d.email) && (
                    <div
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {d.company || d.email}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={d.stage}
                    onChange={(e) => onStageChange(d.id, e.target.value as Stage)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer outline-none border-0"
                    style={{ background: cfg.bg, color: cfg.text }}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                {settings.colValue && (
                  <td
                    className="px-4 py-3 font-mono text-[12.5px] font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {d.value ? fmtFull(d.value) : "—"}
                  </td>
                )}
                {settings.colProbability && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 h-1.5 rounded-full max-w-[60px]"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${d.probability}%`, background: cfg.color }}
                        />
                      </div>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {d.probability}%
                      </span>
                    </div>
                  </td>
                )}
                {settings.colScore && (
                  <td className="px-4 py-3">
                    <ScoreBadge score={d.score ?? 0} />
                  </td>
                )}
                {settings.colPriority && (
                  <td className="px-4 py-3">
                    <PriorityBadge priority={d.priority ?? "medium"} />
                  </td>
                )}
                {settings.colTags && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(d.tags ?? []).slice(0, 3).map((t) => (
                        <TagBadge key={t} tag={t} />
                      ))}
                      {(d.tags ?? []).length > 3 && (
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                          +{(d.tags ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {settings.colCloseDate && (
                  <td
                    className="px-4 py-3 text-[12px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {d.close_date
                      ? new Date(d.close_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                )}
                {settings.colSource && (
                  <td
                    className="px-4 py-3 text-[12px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {d.source || "—"}
                  </td>
                )}
                {settings.colUpdated && (
                  <td
                    className="px-4 py-3 text-[12px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {new Date(d.updated_at).toLocaleDateString()}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════ LIST VIEW ═════════════════════════════ */
function DealsListView({
  deals,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  settings,
}: {
  deals: Deal[];
  selectedId?: string;
  selectedIds: Set<string>;
  onSelect: (d: Deal) => void;
  onToggleSelect: (id: string) => void;
  settings: CRMSettings;
}) {
  return (
    <div className="rounded-xl overflow-hidden space-y-1.5">
      {deals.map((d) => {
        const cfg = STAGE_CONFIG[d.stage];
        const isA = selectedId === d.id;
        const isC = selectedIds.has(d.id);
        return (
          <div
            key={d.id}
            onClick={() => onSelect(d)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
            style={{
              background: isA || isC ? "var(--primary-soft)" : "var(--surface)",
              border: isA ? "1.5px solid var(--primary-border)" : "1px solid var(--border)",
            }}
            onMouseEnter={(e) => {
              if (!isA && !isC)
                (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
            }}
            onMouseLeave={(e) => {
              if (!isA && !isC)
                (e.currentTarget as HTMLElement).style.background = "var(--surface)";
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(d.id);
              }}
              className="h-4 w-4 rounded shrink-0 flex items-center justify-center"
              style={{
                border: `1.5px solid ${isC ? "var(--primary)" : "var(--border)"}`,
                background: isC ? "var(--primary)" : "transparent",
              }}
            >
              {isC && <Check className="h-2.5 w-2.5 text-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[13px]" style={{ color: "var(--foreground)" }}>
                  {d.name}
                </span>
                {d.priority && d.priority !== "medium" && <PriorityBadge priority={d.priority} />}
                {settings.showTags && (d.tags ?? []).map((t) => <TagBadge key={t} tag={t} />)}
              </div>
              <div
                className="flex items-center gap-3 mt-0.5 text-[11px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                {d.company && (
                  <>
                    <Building2 className="h-2.5 w-2.5" />
                    {d.company}
                  </>
                )}
                {d.email && (
                  <>
                    <Mail className="h-2.5 w-2.5" />
                    {d.email}
                  </>
                )}
                {d.close_date && (
                  <>
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(d.close_date).toLocaleDateString()}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {settings.showScore && <ScoreBadge score={d.score ?? 0} />}
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: cfg.bg, color: cfg.text }}
              >
                {d.stage}
              </span>
              {d.value && (
                <span
                  className="font-mono text-[12.5px] font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {fmt(d.value)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════ FORECAST VIEW ════════════════════════ */
/** Regenerate Mo Latif's pipeline coaching signals (crm-insights) on demand. */
function InsightsRefreshButton({ orgId }: { orgId: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={!orgId || busy}
      title="Refresh Bylda's pipeline insights"
      onClick={async () => {
        if (!orgId) return;
        setBusy(true);
        try {
          const r = await refreshPipelineInsights(orgId);
          toast.success(
            r.insights_written > 0
              ? `Bylda refreshed ${r.insights_written} pipeline insight${r.insights_written > 1 ? "s" : ""}`
              : "Pipeline looks healthy — no new signals",
          );
        } catch {
          toast.error("Couldn't refresh insights");
        } finally {
          setBusy(false);
        }
      }}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold disabled:opacity-50"
      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
    >
      <Sparkles
        className={`h-3.5 w-3.5 ${busy ? "animate-pulse" : ""}`}
        style={{ color: "var(--primary)" }}
      />
      {busy ? "Refreshing…" : "Refresh insights"}
    </button>
  );
}

function ForecastView({ deals, orgId }: { deals: Deal[]; orgId: string | null }) {
  const [snapshotting, setSnapshotting] = useState(false);
  const data = STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    const pipeline = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
    const weighted = stageDeals.reduce((s, d) => s + (d.value || 0) * (d.probability / 100), 0);
    return {
      stage,
      pipeline,
      weighted: Math.round(weighted),
      count: stageDeals.length,
      color: STAGE_CONFIG[stage].color,
    };
  });

  const totalPipeline = data.reduce((s, d) => s + d.pipeline, 0);
  const totalWeighted = data.reduce((s, d) => s + d.weighted, 0);

  return (
    <div className="space-y-6">
      {/* Snapshot this forecast into forecast_snapshots + refresh Dhruv's
          verdict (forecast-rollup). The chart above is live; this records a
          point-in-time snapshot for accuracy tracking. */}
      <div className="flex items-center justify-between">
        <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          Live from your open pipeline. Snapshot to track forecast accuracy over time.
        </p>
        <button
          disabled={!orgId || snapshotting}
          onClick={async () => {
            if (!orgId) return;
            setSnapshotting(true);
            try {
              await refreshForecast(orgId);
              toast.success("Forecast snapshot saved");
            } catch {
              toast.error("Couldn't snapshot the forecast");
            } finally {
              setSnapshotting(false);
            }
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
          style={{ background: "var(--primary)", color: "white" }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${snapshotting ? "animate-spin" : ""}`} />
          {snapshotting ? "Snapshotting…" : "Snapshot forecast"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-[12px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
            Total Pipeline
          </p>
          <p className="font-display text-[28px] font-bold" style={{ color: "var(--foreground)" }}>
            {fmt(totalPipeline)}
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--muted-foreground)" }}>
            Gross deal value across all active stages
          </p>
        </div>
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-border)" }}
        >
          <p className="text-[12px] font-medium mb-1" style={{ color: "var(--primary)" }}>
            Weighted Forecast
          </p>
          <p className="font-display text-[28px] font-bold" style={{ color: "var(--primary)" }}>
            {fmt(totalWeighted)}
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--primary)", opacity: 0.7 }}>
            Probability-adjusted expected revenue
          </p>
        </div>
      </div>

      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-[13px] font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          Pipeline by Stage
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => fmt(v)}
            />
            <RechartTooltip
              formatter={(v, name) => [
                fmt(v as number),
                name === "pipeline" ? "Pipeline" : "Weighted",
              ]}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="pipeline" name="pipeline" radius={[4, 4, 0, 0]} opacity={0.4}>
              {data.map((d) => (
                <Cell key={d.stage} fill={d.color} />
              ))}
            </Bar>
            <Bar dataKey="weighted" name="weighted" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.stage} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-left">
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {["Stage", "Deals", "Pipeline", "Weighted", "Avg Probability"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const cfg = STAGE_CONFIG[d.stage as Stage];
              const stageDeals = deals.filter((dd) => dd.stage === d.stage);
              const avgProb =
                stageDeals.length > 0
                  ? Math.round(
                      stageDeals.reduce((s, dd) => s + dd.probability, 0) / stageDeals.length,
                    )
                  : 0;
              return (
                <tr key={d.stage} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: cfg.color }}
                      />
                      <span
                        className="font-medium text-[13px]"
                        style={{ color: "var(--foreground)" }}
                      >
                        {d.stage}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: "var(--foreground)" }}>
                    {d.count}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-[13px] font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {fmt(d.pipeline)}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-[13px] font-medium"
                    style={{ color: "var(--primary)" }}
                  >
                    {fmt(d.weighted)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 h-1.5 rounded-full max-w-[80px]"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${avgProb}%`, background: cfg.color }}
                        />
                      </div>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {avgProb}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════ DEAL DETAIL PANEL ════════════════════ */
function DealDetailPanel({
  deal,
  orgId,
  onClose,
  onStageChange,
  onSaveNotes,
  onDelete,
  onEdit,
}: {
  deal: Deal;
  orgId: string;
  onClose: () => void;
  onStageChange: (s: Stage) => void;
  onSaveNotes: (n: string) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [tab, setTab] = useState<"overview" | "activity">("overview");
  const cfg = STAGE_CONFIG[deal.stage];
  const stageIdx = STAGES.indexOf(deal.stage);
  const expected = deal.value ? Math.round((deal.value * deal.probability) / 100) : 0;

  useEffect(() => {
    setNotes(deal.notes ?? "");
  }, [deal.id, deal.notes]);

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{ width: 400, borderLeft: "1px solid var(--border)", background: "var(--background)" }}
    >
      {/* Panel header */}
      <div
        className="flex items-start justify-between gap-3 px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: cfg.bg, color: cfg.text }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
              {deal.stage}
            </span>
            <PriorityBadge priority={deal.priority ?? "medium"} />
            <ScoreBadge score={deal.score ?? 0} />
          </div>
          <h2
            className="font-display text-[17px] font-bold leading-tight truncate"
            style={{ color: "var(--foreground)" }}
          >
            {deal.name}
          </h2>
          {deal.company && (
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {deal.company}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
          style={{ color: "var(--muted-foreground)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stage progression */}
      <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="relative flex items-center">
          {STAGES.filter((s) => s !== "Lost").map((s, i, arr) => {
            const si = STAGES.indexOf(s);
            const isActive = si === stageIdx;
            const isPast = si < stageIdx && deal.stage !== "Lost";
            const sCfg = STAGE_CONFIG[s];
            return (
              <React.Fragment key={s}>
                <button
                  onClick={() => onStageChange(s)}
                  title={s}
                  className="flex flex-col items-center gap-1 transition-all group relative z-10"
                >
                  <div
                    className="h-5 w-5 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{
                      borderColor: isActive || isPast ? sCfg.color : "var(--border)",
                      background: isActive || isPast ? sCfg.color : "var(--background)",
                    }}
                  >
                    {(isActive || isPast) && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <span
                    className="text-[9px] font-medium"
                    style={{ color: isActive ? sCfg.text : "var(--muted-foreground)" }}
                  >
                    {s}
                  </span>
                </button>
                {i < arr.length - 1 && (
                  <div
                    className="flex-1 h-px mx-0.5 mb-3"
                    style={{ background: isPast ? cfg.color : "var(--border)" }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {deal.stage === "Lost" && (
          <div
            className="text-center text-[11px] font-medium mt-1"
            style={{ color: STAGE_CONFIG.Lost.text }}
          >
            Deal marked as Lost
          </div>
        )}
        {/* Mark as Won/Lost buttons */}
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={() => onStageChange("Won")}
            className="flex-1 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors"
            style={{ background: STAGE_CONFIG.Won.bg, color: STAGE_CONFIG.Won.text }}
          >
            ✓ Mark Won
          </button>
          <button
            onClick={() => onStageChange("Lost")}
            className="flex-1 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors"
            style={{ background: STAGE_CONFIG.Lost.bg, color: STAGE_CONFIG.Lost.text }}
          >
            ✗ Mark Lost
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        {(["overview", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-[12.5px] font-medium capitalize transition-colors"
            style={
              tab === t
                ? { color: "var(--primary)", borderBottom: `2px solid var(--primary)` }
                : { color: "var(--muted-foreground)" }
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "overview" ? (
          <div>
            {/* Loop context — what led to this deal (collapsed by default) */}
            <div className="px-5 pt-4">
              <MomentumRail
                loop={{
                  decision: deal.source ? `Sourced via ${deal.source}` : undefined,
                  asset: deal.company ? `${deal.company} — ${deal.name}` : deal.name,
                  task: `At ${deal.stage} stage`,
                  momentum: expected ? `${fmt(expected)} weighted` : undefined,
                }}
              />
            </div>
            {/* Tags */}
            {(deal.tags ?? []).length > 0 && (
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Tags
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {(deal.tags ?? []).map((t) => (
                    <TagBadge key={t} tag={t} />
                  ))}
                </div>
              </div>
            )}

            {/* Deal metrics */}
            <div
              className="px-5 py-4 space-y-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Deal Info
              </p>
              <div className="grid grid-cols-2 gap-3">
                <MetricBox label="Value" value={deal.value ? fmtFull(deal.value) : "—"} />
                <MetricBox label="Expected" value={expected ? fmt(expected) : "—"} />
                <MetricBox label="Score" value={`${deal.score ?? 0}/100`} />
                <MetricBox label="Probability" value={`${deal.probability}%`} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5 text-[12px]">
                  <span style={{ color: "var(--muted-foreground)" }}>Win probability</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    {deal.probability}%
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${deal.probability}%`, background: cfg.color }}
                  />
                </div>
              </div>
              {[
                {
                  icon: Calendar,
                  label: "Close Date",
                  value: deal.close_date
                    ? new Date(deal.close_date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null,
                },
                { icon: Tag, label: "Source", value: deal.source },
                { icon: UserCircle, label: "Owner", value: deal.owner_name },
              ]
                .filter((r) => r.value)
                .map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--muted-foreground)" }}
                    />
                    <div>
                      <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                        {label}
                      </div>
                      <div
                        className="text-[12.5px] font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Contact info */}
            {(deal.email || deal.phone) && (
              <div
                className="px-5 py-4 space-y-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Contact
                </p>
                {deal.email && (
                  <a href={`mailto:${deal.email}`} className="flex items-center gap-2.5 group">
                    <Mail
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--muted-foreground)" }}
                    />
                    <span
                      className="text-[12.5px] group-hover:underline"
                      style={{ color: "var(--primary)" }}
                    >
                      {deal.email}
                    </span>
                  </a>
                )}
                {deal.phone && (
                  <a href={`tel:${deal.phone}`} className="flex items-center gap-2.5 group">
                    <Phone
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--muted-foreground)" }}
                    />
                    <span
                      className="text-[12.5px] group-hover:underline"
                      style={{ color: "var(--primary)" }}
                    >
                      {deal.phone}
                    </span>
                  </a>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="px-5 py-4">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--muted-foreground)" }}
              >
                Notes
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this deal…"
                rows={4}
                className="w-full rounded-lg px-3 py-2.5 text-[12.5px] outline-none resize-none transition"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--ring)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                }}
              />
              <button
                onClick={() => onSaveNotes(notes)}
                disabled={notes === (deal.notes ?? "")}
                className="mt-2 w-full rounded-lg py-2 text-[12.5px] font-semibold transition-all disabled:opacity-40"
                style={{ background: "var(--primary)", color: "white" }}
              >
                Save Notes
              </button>
            </div>
          </div>
        ) : (
          <ActivityFeed dealId={deal.id} orgId={orgId} dealStage={deal.stage} />
        )}
      </div>

      {/* Actions */}
      <div
        className="px-5 py-4 flex gap-2 shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium transition-colors"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--surface-tertiary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
          }}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit Deal
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors"
          style={{ color: "var(--destructive)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "color-mix(in oklab, var(--destructive) 8%, transparent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════ ACTIVITY FEED ════════════════════════ */
function ActivityFeed({
  dealId,
  orgId,
  dealStage,
}: {
  dealId: string;
  orgId: string;
  dealStage: Stage;
}) {
  const qc = useQueryClient();
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["crm_activities", dealId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("crm_activities")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
    enabled: !!dealId,
  });

  const [newType, setNewType] = useState<ActivityType>("note");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  const addActivity = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("crm_activities").insert({
        deal_id: dealId,
        organization_id: orgId,
        type: newType,
        content: newContent.trim() || null,
        metadata: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_activities", dealId] });
      setNewContent("");
      setAdding(false);
      toast.success("Activity logged");
    },
    onError: () => toast.error("Failed to log activity"),
  });

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="px-5 py-4">
      {/* Add activity */}
      <div className="mb-4">
        <div className="flex gap-1.5 flex-wrap mb-2">
          {(
            Object.entries(ACTIVITY_CONFIG) as [
              ActivityType,
              (typeof ACTIVITY_CONFIG)[ActivityType],
            ][]
          ).map(([type, cfg]) => (
            <button
              key={type}
              onClick={() => setNewType(type)}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-all"
              style={
                newType === type
                  ? { background: cfg.color, color: "white" }
                  : { background: "var(--surface-2)", color: "var(--muted-foreground)" }
              }
            >
              <cfg.icon className="h-3 w-3" />
              {cfg.label}
            </button>
          ))}
        </div>
        {adding ? (
          <div className="space-y-2">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={`Log a ${newType}…`}
              rows={3}
              autoFocus
              className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none resize-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => addActivity.mutate()}
                disabled={addActivity.isPending}
                className="flex-1 rounded-lg py-1.5 text-[12.5px] font-semibold"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {addActivity.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                ) : (
                  "Log Activity"
                )}
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewContent("");
                }}
                className="rounded-lg px-3 py-1.5 text-[12.5px]"
                style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-lg py-2 text-[12.5px] font-medium border-dashed border transition-colors"
            style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}
          >
            <Plus className="h-3.5 w-3.5 inline mr-1.5" />
            Log Activity
          </button>
        )}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare
            className="h-8 w-8 mx-auto mb-2"
            style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
          />
          <p className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
            No activities yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            const cfg = ACTIVITY_CONFIG[a.type];
            return (
              <div key={a.id} className="flex gap-3">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${cfg.color}18` }}
                >
                  <cfg.icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11.5px] font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[10.5px]" style={{ color: "var(--muted-foreground)" }}>
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                  {a.content && (
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {a.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════ DEAL FORM MODAL ══════════════════════ */
function DealFormModal({
  deal,
  allTags,
  onClose,
  onSave,
}: {
  deal: Deal | null;
  allTags: string[];
  onClose: () => void;
  onSave: (data: Partial<Deal>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: deal?.name ?? "",
    email: deal?.email ?? "",
    phone: deal?.phone ?? "",
    company: deal?.company ?? "",
    source: deal?.source ?? "",
    value: String(deal?.value ?? ""),
    probability: String(deal?.probability ?? 20),
    close_date: deal?.close_date ?? "",
    stage: (deal?.stage ?? "New") as Stage,
    notes: deal?.notes ?? "",
    tags: deal?.tags ?? ([] as string[]),
    score: String(deal?.score ?? 0),
    priority: (deal?.priority ?? "medium") as Priority,
    owner_name: deal?.owner_name ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const set = (k: string, v: string | string[]) => setForm((f) => ({ ...f, [k]: v }));

  const addTag = (t: string) => {
    const trimmed = t.trim().toLowerCase();
    if (trimmed && !form.tags.includes(trimmed)) set("tags", [...form.tags, trimmed]);
    setTagInput("");
  };

  const removeTag = (t: string) =>
    set(
      "tags",
      form.tags.filter((x) => x !== t),
    );

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      source: form.source || null,
      value: form.value ? Number(form.value) : null,
      probability: Number(form.probability),
      close_date: form.close_date || null,
      stage: form.stage,
      notes: form.notes || null,
      tags: form.tags,
      score: Number(form.score),
      priority: form.priority,
      owner_name: form.owner_name || null,
    });
    setSaving(false);
  };

  const is: React.CSSProperties = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span
            className="font-display font-bold text-[16px]"
            style={{ color: "var(--foreground)" }}
          >
            {deal ? "Edit Deal" : "New Deal"}
          </span>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Stage selector */}
          <FField label="Stage">
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => {
                const isA = form.stage === s;
                const cfg = STAGE_CONFIG[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("stage", s)}
                    className="rounded-full px-3 py-1 text-[11.5px] font-semibold transition-all"
                    style={
                      isA
                        ? { background: cfg.color, color: "white" }
                        : { background: cfg.bg, color: cfg.text }
                    }
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </FField>

          <FField label="Deal name" required>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Acme Corp — Enterprise"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
              style={is}
            />
          </FField>

          <div className="grid grid-cols-2 gap-3">
            <FField label="Company">
              <input
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={is}
              />
            </FField>
            <FField label="Source">
              <input
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                placeholder="LinkedIn, referral…"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={is}
              />
            </FField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="contact@example.com"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={is}
              />
            </FField>
            <FField label="Phone">
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+1 555 0000"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={is}
              />
            </FField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FField label="Value ($)">
              <input
                type="number"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={is}
              />
            </FField>
            <FField label="Probability (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.probability}
                onChange={(e) => set("probability", e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={is}
              />
            </FField>
            <FField label="Close Date">
              <input
                type="date"
                value={form.close_date}
                onChange={(e) => set("close_date", e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={is}
              />
            </FField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FField label="Lead Score (0–100)">
              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.score}
                  onChange={(e) => set("score", e.target.value)}
                  className="w-full h-1.5 accent-[var(--primary)]"
                />
                <div
                  className="flex justify-between text-[10.5px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <span>0</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    {form.score}
                  </span>
                  <span>100</span>
                </div>
              </div>
            </FField>
            <FField label="Priority">
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as Priority[]).map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set("priority", p)}
                      className="flex-1 rounded-lg py-2 text-[11.5px] font-semibold transition-all capitalize"
                      style={
                        form.priority === p
                          ? { background: cfg.color, color: "white" }
                          : { background: cfg.bg, color: cfg.text }
                      }
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </FField>
          </div>

          <FField label="Owner Name">
            <input
              value={form.owner_name}
              onChange={(e) => set("owner_name", e.target.value)}
              placeholder="Sales rep name…"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
              style={is}
            />
          </FField>

          {/* Tags */}
          <FField label="Tags">
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap min-h-[28px]">
                {form.tags.map((t) => {
                  const c = tagColor(t);
                  return (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border"
                      style={{ background: c.bg, color: c.text, borderColor: c.border }}
                    >
                      {t}
                      <button
                        onClick={() => removeTag(t)}
                        className="ml-0.5 opacity-60 hover:opacity-100"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Add tag (Enter to add)"
                  className="flex-1 rounded-lg px-3 py-1.5 text-[12.5px] outline-none"
                  style={is}
                />
                <button
                  onClick={() => addTag(tagInput)}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {allTags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {allTags
                    .filter((t) => !form.tags.includes(t))
                    .map((t) => (
                      <button
                        key={t}
                        onClick={() => addTag(t)}
                        className="rounded-full px-2 py-0.5 text-[10.5px] border transition-all"
                        style={{
                          ...(() => {
                            const c = tagColor(t);
                            return { background: c.bg, color: c.text, borderColor: c.border };
                          })(),
                        }}
                      >
                        + {t}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </FField>

          <FField label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notes about this deal…"
              rows={3}
              className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none resize-none"
              style={is}
            />
          </FField>
        </div>

        <div
          className="flex justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-medium"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--primary)", color: "white" }}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {deal ? "Save Changes" : "Create Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ HELPER COMPONENTS ════════════════════ */
function TagBadge({ tag }: { tag: string }) {
  const c = tagColor(tag);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-medium border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      {tag}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#6B7280";
  const bg =
    score >= 70
      ? "rgba(5,150,105,0.10)"
      : score >= 40
        ? "rgba(217,119,6,0.10)"
        : "rgba(107,114,128,0.10)";
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-bold"
      style={{ background: bg, color }}
    >
      <Star className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "medium") return null;
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-medium"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <Flag className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <div className="text-[10px] mb-1" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
      <div className="font-mono text-[14px] font-bold" style={{ color: "var(--foreground)" }}>
        {value}
      </div>
    </div>
  );
}

function FField({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12px] font-medium" style={{ color: "var(--muted-foreground)" }}>
        {label}
        {required && (
          <span className="ml-0.5" style={{ color: "var(--destructive)" }}>
            *
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

function EmptyPipeline({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
        style={{ background: "var(--primary-soft)" }}
      >
        <LayoutGrid className="h-7 w-7" style={{ color: "var(--primary)" }} />
      </div>
      <h3
        className="font-display text-[18px] font-bold mb-2"
        style={{ color: "var(--foreground)" }}
      >
        Your pipeline is empty
      </h3>
      <p className="text-[13px] max-w-xs mb-6" style={{ color: "var(--muted-foreground)" }}>
        Add your first deal to start tracking your sales pipeline, close rates, and revenue.
      </p>
      {/* Outline weight — the persistent header "Add deal" is the pipeline's
          single primary CTA (CTA reduction: one primary per screen). */}
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-[13px] font-semibold"
        style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
      >
        <Plus className="h-4 w-4" />
        Add First Deal
      </button>
    </div>
  );
}
