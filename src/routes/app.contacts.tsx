import React, { useRef, useState, useMemo } from "react";
import Papa from "papaparse";
import { CustomersNav } from "@/components/app/CustomersNav";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { guestStore, GUEST_CONTACTS } from "@/lib/guest";
import { computeLeadScore } from "@/lib/lead-scoring";
import { nudgeAutomationDispatch } from "@/lib/automation-run";
import { MomentumRail } from "@/components/bylda/MomentumRail";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  Mail,
  Phone,
  Building2,
  Tag,
  Filter,
  MoreHorizontal,
  Activity,
  Clock,
  AlertCircle,
  CheckSquare,
  Square,
  Zap,
  MessageSquare,
  Send,
  Download,
  Upload,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/app/contacts")({ component: ContactsPage });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/* ─── Types ─── */
interface Contact {
  id: string;
  user_id: string;
  org_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  notes: string | null;
  status: ContactStatus;
  lead_score: number | null;
  tags: string[] | null;
  last_contacted_at: string | null;
  created_at: string;
}

interface ContactNote {
  id: string;
  contact_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

type ContactStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "engaged"
  | "nurture"
  | "cold"
  | "archived";

type SortField = "lead_score" | "status" | "created_at" | "last_contacted_at";
type SortDir = "asc" | "desc";

const STATUS_OPTIONS: ContactStatus[] = [
  "new",
  "contacted",
  "qualified",
  "engaged",
  "nurture",
  "cold",
  "archived",
];

const STATUS_CONFIG: Record<
  ContactStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  new: { bg: "rgba(107,114,128,0.12)", text: "#6B7280", dot: "#6B7280", label: "New" },
  contacted: { bg: "rgba(59,130,246,0.12)", text: "#2563EB", dot: "#3B82F6", label: "Contacted" },
  qualified: { bg: "rgba(2, 132, 199,0.12)", text: "#7C3AED", dot: "#7C3AED", label: "Qualified" },
  engaged: { bg: "rgba(5,150,105,0.12)", text: "#059669", dot: "#059669", label: "Engaged" },
  nurture: { bg: "rgba(217,119,6,0.12)", text: "#D97706", dot: "#D97706", label: "Nurture" },
  cold: { bg: "rgba(8,145,178,0.12)", text: "#0891B2", dot: "#0891B2", label: "Cold" },
  archived: { bg: "rgba(220,38,38,0.12)", text: "#DC2626", dot: "#DC2626", label: "Archived" },
};

const AVATAR_PALETTE = [
  { bg: "rgba(2, 132, 199,0.15)", text: "#7C3AED" },
  { bg: "rgba(59,130,246,0.15)", text: "#2563EB" },
  { bg: "rgba(5,150,105,0.15)", text: "#059669" },
  { bg: "rgba(217,119,6,0.15)", text: "#D97706" },
  { bg: "rgba(236,72,153,0.15)", text: "#EC4899" },
  { bg: "rgba(8,145,178,0.15)", text: "#0891B2" },
];

const TAG_PALETTE = [
  { bg: "rgba(2, 132, 199,0.10)", text: "#7C3AED" },
  { bg: "rgba(59,130,246,0.10)", text: "#2563EB" },
  { bg: "rgba(5,150,105,0.10)", text: "#059669" },
  { bg: "rgba(217,119,6,0.10)", text: "#D97706" },
  { bg: "rgba(236,72,153,0.10)", text: "#EC4899" },
  { bg: "rgba(8,145,178,0.10)", text: "#0891B2" },
];

const PAGE_SIZE = 25;

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

function avatarColor(name: string) {
  return AVATAR_PALETTE[hashStr(name) % AVATAR_PALETTE.length];
}

function tagColor(tag: string) {
  return TAG_PALETTE[hashStr(tag) % TAG_PALETTE.length];
}

function scoreColor(score: number) {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#7C3AED";
  if (score >= 40) return "#D97706";
  return "#6B7280";
}

/* ─── Supabase helpers ─── */
async function fetchContacts(userId: string): Promise<Contact[]> {
  if (guestStore.get().isGuest) return GUEST_CONTACTS as unknown as Contact[];
  const { data } = await db
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Contact[];
}

async function createContact(contact: Omit<Contact, "id" | "created_at">): Promise<void> {
  await db.from("contacts").insert(contact);
}

async function updateContactStatus(id: string, status: ContactStatus): Promise<void> {
  await db.from("contacts").update({ status }).eq("id", id);
}

async function deleteContact(id: string): Promise<void> {
  await db.from("contacts").delete().eq("id", id);
}

async function fetchContactNotes(contactId: string): Promise<ContactNote[]> {
  const { data } = await db
    .from("contact_notes")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ContactNote[];
}

/* ─── Main Page ─── */
function SecondaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
      }}
    >
      {children}
    </button>
  );
}

// Contact caps by plan (master build: 0 / 500 / 2000 / unlimited for
// starter / launch / operate / scale). null = unlimited.
const CONTACT_LIMITS: Record<string, number | null> = {
  starter: 0,
  launch: 500,
  operate: 2000,
  scale: null,
};

function ContactsPage() {
  const { user, currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [bulkAction, setBulkAction] = useState<"" | "status" | "trigger">("");

  const contactsQ = useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: () => fetchContacts(user!.id),
    enabled: !!user?.id,
  });

  const allContacts = contactsQ.data ?? [];

  // Plan-based contact cap (non-blocking warning per master build).
  const planQ = useQuery({
    queryKey: ["org-plan-contacts", currentOrgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("organization_id", currentOrgId!)
        .maybeSingle();
      return (data?.plan as string) ?? "starter";
    },
    enabled: !!currentOrgId,
  });
  const contactLimit = CONTACT_LIMITS[planQ.data ?? "starter"] ?? null;
  const atContactLimit = contactLimit !== null && allContacts.length >= contactLimit;

  const filtered = useMemo(() => {
    let arr = allContacts;
    if (statusFilter !== "all") arr = arr.filter((c) => c.status === statusFilter);
    if (minScore > 0) arr = arr.filter((c) => (c.lead_score ?? 0) >= minScore);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (c) =>
          (c.first_name ?? "").toLowerCase().includes(s) ||
          (c.last_name ?? "").toLowerCase().includes(s) ||
          (c.email ?? "").toLowerCase().includes(s) ||
          (c.company ?? "").toLowerCase().includes(s),
      );
    }
    arr = [...arr].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortField === "lead_score") {
        av = a.lead_score ?? 0;
        bv = b.lead_score ?? 0;
      } else if (sortField === "status") {
        av = a.status;
        bv = b.status;
      } else if (sortField === "created_at") {
        av = a.created_at;
        bv = b.created_at;
      } else if (sortField === "last_contacted_at") {
        av = a.last_contacted_at ?? "";
        bv = b.last_contacted_at ?? "";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [allContacts, statusFilter, minScore, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContactStatus }) =>
      updateContactStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts", user?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", user?.id] });
      setDetailContact(null);
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"" | "import" | "score">("");

  // Export the current (filtered) list to a CSV file.
  const exportCsv = () => {
    const rows = filtered.map((c) => ({
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      status: c.status,
      lead_score: c.lead_score ?? 0,
      tags: (c.tags ?? []).join("|"),
      source: c.source ?? "",
      notes: c.notes ?? "",
      last_contacted_at: c.last_contacted_at ?? "",
    }));
    const csv = Papa.unparse(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import contacts from a CSV. Headers are matched case-insensitively; tags may
  // be pipe- or comma-separated. Each row is scored on insert.
  const importCsv = (file: File) => {
    if (!user) return;
    setBusy("import");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: async (res) => {
        try {
          const rows = res.data
            .map((r) => {
              const tags = (r.tags ?? "")
                .split(/[|,]/)
                .map((t) => t.trim())
                .filter(Boolean);
              const base = {
                user_id: user.id,
                first_name: r.first_name || r.firstname || null,
                last_name: r.last_name || r.lastname || null,
                email: r.email || null,
                phone: r.phone || null,
                company: r.company || null,
                source: r.source || "csv-import",
                notes: r.notes || null,
                status: (r.status || "new").toLowerCase(),
                tags,
              };
              return { ...base, lead_score: computeLeadScore({ ...base, tags }) };
            })
            .filter((r) => r.email || r.first_name || r.last_name);
          if (rows.length === 0) {
            toast.error("No usable rows found in that CSV.");
            return;
          }
          const { error } = await db.from("contacts").insert(rows);
          if (error) throw error;
          toast.success(`Imported ${rows.length} contact${rows.length === 1 ? "" : "s"}.`);
          qc.invalidateQueries({ queryKey: ["contacts", user.id] });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Import failed.");
        } finally {
          setBusy("");
        }
      },
      error: () => {
        toast.error("Could not read that file.");
        setBusy("");
      },
    });
  };

  // Recompute lead_score for every contact and persist the ones that changed.
  const recomputeScores = async () => {
    if (!user) return;
    setBusy("score");
    try {
      const changed = allContacts
        .map((c) => ({ id: c.id, next: computeLeadScore(c) }))
        .filter((c) => c.next !== undefined);
      await Promise.all(
        changed.map((c) => db.from("contacts").update({ lead_score: c.next }).eq("id", c.id)),
      );
      toast.success(`Recomputed scores for ${changed.length} contacts.`);
      qc.invalidateQueries({ queryKey: ["contacts", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not recompute scores.");
    } finally {
      setBusy("");
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((c) => c.id)));
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === "asc" ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )
    ) : (
      <ChevronDown className="h-3 w-3 opacity-30" />
    );

  if (!user) return null;

  return (
    <div className="space-y-5">
      {atContactLimit && (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-[--border] bg-[--warning-light] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[--text-primary]">
            {contactLimit === 0
              ? "Your plan doesn't include CRM contacts. Upgrade to start capturing and managing leads."
              : `You've reached your plan's contact limit (${allContacts.length.toLocaleString()}/${contactLimit?.toLocaleString()}). Upgrade to add more.`}
          </p>
          <a
            href="/app/billing"
            className="shrink-0 rounded-xl bg-[--warning] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Upgrade
          </a>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2.5">
          <CustomersNav />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
              Contacts
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {allContacts.length} contact{allContacts.length !== 1 ? "s" : ""} in your CRM
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
          <SecondaryBtn
            onClick={recomputeScores}
            disabled={busy !== "" || allContacts.length === 0}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy === "score" ? "animate-spin" : ""}`} />
            Recompute scores
          </SecondaryBtn>
          <SecondaryBtn onClick={() => fileInputRef.current?.click()} disabled={busy !== ""}>
            <Upload className="h-3.5 w-3.5" />
            {busy === "import" ? "Importing…" : "Import CSV"}
          </SecondaryBtn>
          <SecondaryBtn onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </SecondaryBtn>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search contacts…"
              className="w-full rounded-lg py-2 pl-9 pr-4 text-[13px] outline-none transition"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
        </div>

        {/* Score range */}
        <div className="flex items-center gap-3">
          <Filter className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
          <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            Min score:
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => {
              setMinScore(Number(e.target.value));
              setPage(1);
            }}
            className="flex-1"
            style={{ accentColor: "var(--primary)" }}
          />
          <span
            className="text-[12px] font-mono w-6 text-right"
            style={{ color: "var(--foreground)" }}
          >
            {minScore}
          </span>
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
            style={
              statusFilter === "all"
                ? { background: "var(--primary)", color: "#fff" }
                : {
                    background: "var(--surface-2)",
                    color: "var(--muted-foreground)",
                    border: "1px solid var(--border)",
                  }
            }
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                style={
                  active
                    ? { background: cfg.dot, color: "#fff" }
                    : {
                        background: cfg.bg,
                        color: cfg.text,
                        border: `1px solid ${cfg.dot}40`,
                      }
                }
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-2.5"
          style={{
            background: "var(--primary-soft)",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
          }}
        >
          <span className="text-[12px] font-medium" style={{ color: "var(--primary)" }}>
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as "" | "status" | "trigger")}
              className="rounded-lg px-3 py-1.5 text-[12px] outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <option value="">Bulk action…</option>
              <option value="status">Change status</option>
              <option value="trigger">Trigger automation</option>
            </select>
            {bulkAction === "status" && (
              <select
                onChange={async (e) => {
                  const status = e.target.value as ContactStatus;
                  await Promise.all([...selected].map((id) => updateContactStatus(id, status)));
                  qc.invalidateQueries({ queryKey: ["contacts", user?.id] });
                  setSelected(new Set());
                  setBulkAction("");
                }}
                className="rounded-lg px-3 py-1.5 text-[12px] outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="">Select status…</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            )}
            {bulkAction === "trigger" && (
              <button
                onClick={async () => {
                  const {
                    data: { session },
                  } = await supabase.auth.getSession();
                  const token = session?.access_token;
                  await fetch("/api/automations/trigger", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ contact_ids: [...selected] }),
                  });
                  setSelected(new Set());
                  setBulkAction("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                <Zap className="h-3.5 w-3.5" />
                Trigger
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {contactsQ.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2
              className="h-5 w-5 animate-spin"
              style={{ color: "var(--muted-foreground)" }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="px-4 py-3 w-10">
                    <button onClick={selectAll}>
                      {selected.size === paginated.length && paginated.length > 0 ? (
                        <CheckSquare className="h-4 w-4" style={{ color: "var(--primary)" }} />
                      ) : (
                        <Square className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                      )}
                    </button>
                  </th>
                  <th
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Name
                  </th>
                  <th
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider hidden sm:table-cell"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Company
                  </th>
                  <th
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={() => handleSort("lead_score")}
                  >
                    <span className="flex items-center gap-1">
                      Score <SortIcon field="lead_score" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={() => handleSort("status")}
                  >
                    <span className="flex items-center gap-1">
                      Status <SortIcon field="status" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider hidden lg:table-cell"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Tags
                  </th>
                  <th
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hidden md:table-cell"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={() => handleSort("last_contacted_at")}
                  >
                    <span className="flex items-center gap-1">
                      Last Contacted <SortIcon field="last_contacted_at" />
                    </span>
                  </th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users
                          className="h-7 w-7"
                          style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
                        />
                        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                          {search || statusFilter !== "all" || minScore > 0
                            ? "No contacts match your filters"
                            : "No contacts yet"}
                        </p>
                        {/* Outline weight — the header "Add Contact" is the
                            screen's single primary CTA (one primary/screen). */}
                        {!search && statusFilter === "all" && minScore === 0 && (
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium"
                            style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
                          >
                            <Plus className="h-3.5 w-3.5" /> Add your first contact
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((contact) => {
                    const score = contact.lead_score;
                    const fullName =
                      [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";
                    const initials =
                      [contact.first_name?.[0], contact.last_name?.[0]]
                        .filter(Boolean)
                        .join("")
                        .toUpperCase() || "?";
                    const av = avatarColor(fullName);
                    const sc = STATUS_CONFIG[contact.status];
                    const tags = contact.tags ?? [];

                    return (
                      <tr
                        key={contact.id}
                        className="transition-colors cursor-pointer"
                        style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background = "var(--surface-2)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background = "transparent")
                        }
                        onClick={() => setDetailContact(contact)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleSelect(contact.id)}>
                            {selected.has(contact.id) ? (
                              <CheckSquare
                                className="h-4 w-4"
                                style={{ color: "var(--primary)" }}
                              />
                            ) : (
                              <Square
                                className="h-4 w-4"
                                style={{ color: "var(--muted-foreground)" }}
                              />
                            )}
                          </button>
                        </td>

                        {/* Name + avatar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-full shrink-0 font-semibold text-[11px]"
                              style={{ background: av.bg, color: av.text }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div
                                className="font-medium text-[13px]"
                                style={{ color: "var(--foreground)" }}
                              >
                                {fullName}
                              </div>
                              {contact.email && (
                                <div
                                  className="text-[11px] mt-0.5"
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  {contact.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span
                            className="text-[13px]"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {contact.company ?? "—"}
                          </span>
                        </td>

                        {/* Score bar */}
                        <td className="px-4 py-3">
                          {score != null ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="h-1.5 rounded-full overflow-hidden"
                                style={{ background: "var(--surface-2)", width: "48px" }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${score}%`, background: scoreColor(score) }}
                                />
                              </div>
                              <span
                                className="text-[12px] font-semibold tabular-nums"
                                style={{ color: scoreColor(score) }}
                              >
                                {score}
                              </span>
                            </div>
                          ) : (
                            <span
                              className="text-[12px]"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Status badge with dot */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: sc.bg, color: sc.text }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: sc.dot }}
                            />
                            {sc.label}
                          </span>
                        </td>

                        {/* Tags chips */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag, i) => {
                              const tc = tagColor(tag);
                              return (
                                <span
                                  key={i}
                                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                  style={{ background: tc.bg, color: tc.text }}
                                >
                                  {tag}
                                </span>
                              );
                            })}
                            {tags.length > 3 && (
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[10px]"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                +{tags.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 hidden md:table-cell">
                          <span
                            className="text-[12px]"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {contact.last_contacted_at
                              ? new Date(contact.last_contacted_at).toLocaleDateString()
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                            style={{ color: "var(--muted-foreground)" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                "var(--surface-2)";
                              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color =
                                "var(--muted-foreground)";
                            }}
                            onClick={() => setDetailContact(contact)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Page {page} of {totalPages} · {filtered.length} results
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-3 py-1 text-[12px] font-medium transition-all disabled:opacity-40"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg px-3 py-1 text-[12px] font-medium transition-all disabled:opacity-40"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddContactModal
          userId={user.id}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["contacts", user?.id] });
            setShowAddModal(false);
          }}
        />
      )}

      {detailContact && (
        <ContactDetail
          contact={detailContact}
          userId={user.id}
          onClose={() => setDetailContact(null)}
          onStatusChange={(id, status) => {
            updateMutation.mutate({ id, status });
            setDetailContact((c) => (c ? { ...c, status } : c));
          }}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}
    </div>
  );
}

/* ─── Add Contact Modal ─── */
function AddContactModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currentOrgId } = useAuth();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    source: "",
    notes: "",
    status: "new" as ContactStatus,
    lead_score: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createContact({
        user_id: userId,
        org_id: currentOrgId,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        company: form.company || null,
        source: form.source || null,
        notes: form.notes || null,
        status: form.status,
        lead_score: form.lead_score ? parseInt(form.lead_score) : null,
        tags: null,
        last_contacted_at: null,
      });
      // Fire any "new lead / contact created" automations the org has switched on.
      nudgeAutomationDispatch();
      onSaved();
    } catch (err) {
      setError((err as Error).message ?? "Failed to create contact");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="font-semibold text-[15px]" style={{ color: "var(--foreground)" }}>
            Add Contact
          </div>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "first_name", label: "First Name", placeholder: "Jane" },
              { key: "last_name", label: "Last Name", placeholder: "Doe" },
            ].map((f) => (
              <div key={f.key}>
                <label
                  className="block text-[12px] font-medium mb-1.5"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {f.label}
                </label>
                <input
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          {[
            { key: "email", label: "Email", placeholder: "jane@example.com", type: "email" },
            { key: "phone", label: "Phone", placeholder: "+1 555 000 0000", type: "tel" },
            { key: "company", label: "Company", placeholder: "Acme Corp", type: "text" },
            {
              key: "source",
              label: "Source",
              placeholder: "LinkedIn, referral, ad…",
              type: "text",
            },
          ].map((f) => (
            <div key={f.key}>
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                {f.label}
              </label>
              <input
                type={f.type}
                value={form[f.key as keyof typeof form]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={inputStyle}
              />
            </div>
          ))}
          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--muted-foreground)" }}
            >
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Any notes about this contact…"
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
              style={inputStyle}
            />
          </div>
          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]"
              style={{
                background: "color-mix(in oklab, var(--muted-foreground) 8%, transparent)",
                border: "1px solid color-mix(in oklab, var(--muted-foreground) 15%, transparent)",
                color: "var(--foreground)",
              }}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
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
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-60"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Add Contact
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Contact Detail Slide-over ─── */
function ContactDetail({
  contact,
  userId,
  onClose,
  onStatusChange,
  onDelete,
}: {
  contact: Contact;
  userId: string;
  onClose: () => void;
  onStatusChange: (id: string, status: ContactStatus) => void;
  onDelete: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "notes">("overview");
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const notesQ = useQuery({
    queryKey: ["contact-notes", contact.id],
    queryFn: () => fetchContactNotes(contact.id),
  });

  // Activity timeline — crm_activities links by deal_id, and leads carry a
  // contact_id, so a contact's activity is the feed across the deals it's on.
  const activityQ = useQuery({
    queryKey: ["contact-activity", contact.id],
    queryFn: async () => {
      const { data: dealRows } = await supabase
        .from("leads")
        .select("id, name")
        .eq("contact_id", contact.id);
      const deals = (dealRows as { id: string; name: string }[] | null) ?? [];
      if (deals.length === 0) return [];
      const { data } = await supabase
        .from("crm_activities")
        .select("id, type, content, created_at, deal_id")
        .in(
          "deal_id",
          deals.map((d) => d.id),
        )
        .order("created_at", { ascending: false })
        .limit(50);
      const nameById = new Map(deals.map((d) => [d.id, d.name]));
      return (
        (data as
          | {
              id: string;
              type: string;
              content: string | null;
              created_at: string;
              deal_id: string;
            }[]
          | null) ?? []
      ).map((a) => ({ ...a, deal_name: nameById.get(a.deal_id) ?? null }));
    },
  });

  const fullName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed Contact";
  const initials =
    [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const av = avatarColor(fullName);
  const sc = STATUS_CONFIG[contact.status];
  const score = contact.lead_score;
  const tags = contact.tags ?? [];

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await db
        .from("contact_notes")
        .insert({ contact_id: contact.id, user_id: userId, body: newNote.trim() });
      qc.invalidateQueries({ queryKey: ["contact-notes", contact.id] });
      setNewNote("");
    } finally {
      setSavingNote(false);
    }
  };

  const triggerAutomation = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch("/api/automations/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contact_id: contact.id }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative ml-auto flex h-full w-full max-w-[400px] flex-col"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-[14px] shrink-0"
              style={{ background: av.bg, color: av.text }}
            >
              {initials}
            </div>
            <div>
              <div className="font-semibold text-[14px]" style={{ color: "var(--foreground)" }}>
                {fullName}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: sc.bg, color: sc.text }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: sc.dot }}
                  />
                  {sc.label}
                </span>
                {contact.company && (
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {contact.company}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 px-5" style={{ borderBottom: "1px solid var(--border)" }}>
          {(["overview", "activity", "notes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative py-2.5 px-1 mr-5 text-[12px] font-medium transition-colors"
              style={
                activeTab === tab
                  ? { color: "var(--primary)" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              <span className="flex items-center gap-1">
                {tab === "overview" && <Activity className="h-3 w-3" />}
                {tab === "activity" && <Clock className="h-3 w-3" />}
                {tab === "notes" && <MessageSquare className="h-3 w-3" />}
                {tab === "overview" ? "Overview" : tab === "activity" ? "Activity" : "Notes"}
                {tab === "notes" && notesQ.data && notesQ.data.length > 0 && (
                  <span
                    className="ml-0.5 rounded-full px-1.5 py-0 text-[9px] font-bold"
                    style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                  >
                    {notesQ.data.length}
                  </span>
                )}
              </span>
              {activeTab === tab && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Overview Tab ── */}
          {activeTab === "overview" && (
            <div className="px-5 py-5 space-y-5">
              {/* Loop context — what led to this contact (collapsed by default) */}
              <MomentumRail
                loop={{
                  decision: contact.source ? `Came in via ${contact.source}` : undefined,
                  asset: contact.company ? `Linked to ${contact.company}` : undefined,
                  task: `Working this contact — ${sc.label}`,
                  momentum: score != null ? `Lead score ${score}` : undefined,
                }}
              />
              {/* Score bar */}
              {score != null && (
                <div>
                  <label
                    className="block text-[11px] font-semibold mb-2 uppercase tracking-wider"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Lead Score
                  </label>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${score}%`, background: scoreColor(score) }}
                      />
                    </div>
                    <span
                      className="text-[15px] font-bold tabular-nums w-8 text-right"
                      style={{ color: scoreColor(score) }}
                    >
                      {score}
                    </span>
                  </div>
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <label
                    className="block text-[11px] font-semibold mb-2 uppercase tracking-wider"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => {
                      const tc = tagColor(tag);
                      return (
                        <span
                          key={i}
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{ background: tc.bg, color: tc.text }}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contact info rows */}
              <div className="space-y-3">
                {[
                  { icon: Mail, value: contact.email, label: "Email" },
                  { icon: Phone, value: contact.phone, label: "Phone" },
                  { icon: Building2, value: contact.company, label: "Company" },
                  { icon: Tag, value: contact.source, label: "Source" },
                ]
                  .filter((r) => r.value)
                  .map(({ icon: Icon, value, label }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div
                        className="h-7 w-7 flex items-center justify-center rounded-lg shrink-0"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <Icon
                          className="h-3.5 w-3.5"
                          style={{ color: "var(--muted-foreground)" }}
                        />
                      </div>
                      <div>
                        <div
                          className="text-[10px] uppercase tracking-wider font-medium"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {label}
                        </div>
                        <div className="text-[13px]" style={{ color: "var(--foreground)" }}>
                          {value}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Status change */}
              <div>
                <label
                  className="block text-[11px] font-semibold mb-2 uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const active = contact.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => onStatusChange(contact.id, s)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                        style={
                          active
                            ? { background: cfg.dot, color: "#fff" }
                            : {
                                background: cfg.bg,
                                color: cfg.text,
                                border: `1px solid ${cfg.dot}40`,
                              }
                        }
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {contact.notes && (
                <div>
                  <label
                    className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Profile Notes
                  </label>
                  <p
                    className="text-[12.5px] leading-relaxed"
                    style={{ color: "var(--foreground)" }}
                  >
                    {contact.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={triggerAutomation}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-opacity hover:opacity-80"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  <Zap className="h-3.5 w-3.5" /> Trigger Automation
                </button>
                <button
                  onClick={() => onDelete(contact.id)}
                  className="rounded-lg px-3 py-2 text-[12px] font-medium transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "#DC2626";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* ── Activity Tab ── */}
          {activeTab === "activity" && (
            <div className="px-5 py-5">
              {activityQ.isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg"
                      style={{ background: "var(--surface-2)" }}
                    />
                  ))}
                </div>
              ) : (activityQ.data ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="mb-2 h-6 w-6" style={{ color: "var(--text-faint)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    No activity yet
                  </p>
                  <p
                    className="mt-1 max-w-[16rem] text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Stage changes, notes, and tasks on this contact&apos;s deals appear here
                    automatically.
                  </p>
                </div>
              ) : (
                <ol className="relative space-y-4 pl-4">
                  {(activityQ.data ?? []).map((a) => (
                    <li key={a.id} className="relative">
                      <span
                        className="absolute -left-4 top-1.5 h-2 w-2 rounded-full"
                        style={{ background: "var(--primary)" }}
                      />
                      <span
                        className="absolute -left-[13px] top-3 bottom-[-16px] w-px"
                        style={{ background: "var(--border)" }}
                      />
                      <p className="text-sm" style={{ color: "var(--foreground)" }}>
                        {a.content || a.type.replace(/_/g, " ")}
                      </p>
                      <p
                        className="mt-0.5 text-[11px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {a.deal_name ? `${a.deal_name} · ` : ""}
                        {new Date(a.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* ── Notes Tab ── */}
          {activeTab === "notes" && (
            <div className="flex flex-col h-full">
              {/* Add note */}
              <div
                className="px-5 py-4 shrink-0"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote();
                  }}
                  className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none resize-none"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    ⌘ Enter to save
                  </span>
                  <button
                    onClick={addNote}
                    disabled={!newNote.trim() || savingNote}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: "var(--primary)", color: "#fff" }}
                  >
                    {savingNote ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Save
                  </button>
                </div>
              </div>

              {/* Notes timeline */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {notesQ.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      style={{ color: "var(--muted-foreground)" }}
                    />
                  </div>
                ) : notesQ.data && notesQ.data.length > 0 ? (
                  notesQ.data.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl p-3.5"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <p
                        className="text-[13px] leading-relaxed"
                        style={{ color: "var(--foreground)" }}
                      >
                        {note.body}
                      </p>
                      <p className="text-[11px] mt-2" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(note.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <MessageSquare
                      className="h-6 w-6"
                      style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
                    />
                    <p className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                      No notes yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
