import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  sopDocumentsQuery,
  upsertSopDocument,
  deleteSopDocument,
  type SopDocument,
  type SopStatus,
} from "@/lib/queries";
import { blockIfGuest } from "@/lib/guest";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  FileText,
  X,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/app/sop-library")({
  component: SopLibraryPage,
});

const STATUS_STYLES: Record<SopStatus, { label: string; bg: string; text: string }> = {
  published: { label: "Published", bg: "rgba(52,211,153,0.1)", text: "#34D399" },
  draft: { label: "Draft", bg: "rgba(251,146,60,0.08)", text: "#FB923C" },
  archived: { label: "Archived", bg: "rgba(150,150,150,0.08)", text: "var(--muted-foreground)" },
};

const FILTER_OPTIONS: { key: SopStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
];

function SopLibraryPage() {
  const { currentOrgId, user } = useAuth();
  const orgId = currentOrgId ?? "";
  const qc = useQueryClient();

  const [filter, setFilter] = useState<SopStatus | "all">("all");
  const [editing, setEditing] = useState<SopDocument | null | "new">(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sopQ = useQuery({ ...sopDocumentsQuery(orgId), enabled: !!orgId });
  const docs = sopQ.data ?? [];
  const visible = filter === "all" ? docs : docs.filter((d) => d.status === filter);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDelete = async (id: string) => {
    if (blockIfGuest("Sign up to manage SOPs.")) return;
    setDeleting(id);
    try {
      await deleteSopDocument(id);
      await qc.invalidateQueries({ queryKey: ["sop_documents", orgId] });
      toast.success("SOP deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete SOP");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(52,211,153,0.07) 0%, rgba(125,211,252,0.04) 100%)",
          border: "1px solid rgba(52,211,153,0.18)",
        }}
      >
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div
              className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest mb-1"
              style={{ color: "rgba(52,211,153,0.7)" }}
            >
              <BookOpen className="h-3 w-3" />
              SOP Library
            </div>
            <h1
              className="font-display text-[22px] font-bold leading-tight"
              style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
            >
              Standard Operating Procedures
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
              {docs.length > 0
                ? `${docs.filter((d) => d.status === "published").length} published · ${docs.filter((d) => d.status === "draft").length} draft`
                : "Document your processes to scale with consistency"}
            </p>
          </div>
          <button
            onClick={() => {
              if (blockIfGuest("Sign up to create SOPs.")) return;
              setEditing("new");
            }}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium shrink-0"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34D399",
              border: "1px solid rgba(52,211,153,0.25)",
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New SOP
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* SOP list */}
      {sopQ.isLoading ? (
        <div className="text-center text-[13px] text-muted-foreground py-8">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="bylda-card rounded-xl p-12 text-center">
          <FileText className="h-8 w-8 mx-auto mb-3 opacity-25" />
          <p className="text-[13px] text-muted-foreground mb-4">
            {filter === "all"
              ? "No SOPs yet — create your first standard operating procedure"
              : `No ${filter} SOPs`}
          </p>
          <button
            onClick={() => {
              if (blockIfGuest("Sign up to create SOPs.")) return;
              setEditing("new");
            }}
            className="rounded-xl px-4 py-2 text-[12.5px] font-medium"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34D399",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
          >
            Create your first SOP
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((doc) => {
            const st = STATUS_STYLES[doc.status];
            const isExp = expanded.has(doc.id);
            return (
              <div key={doc.id} className="bylda-card rounded-xl overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/10 transition-colors"
                  onClick={() => toggleExpanded(doc.id)}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{doc.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {doc.category && (
                        <span
                          className="text-[10.5px]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {doc.category}
                        </span>
                      )}
                      <span
                        className="text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5"
                        style={{ background: st.bg, color: st.text }}
                      >
                        {st.label}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                        v{doc.version}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditing(doc)}
                      className="rounded-lg p-1.5 transition hover:bg-muted/30"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => void handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                      className="rounded-lg p-1.5 transition hover:bg-red-500/10 disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" style={{ color: "#F87171" }} />
                    </button>
                  </div>

                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isExp && "rotate-180",
                    )}
                  />
                </div>

                {/* Expanded content */}
                {isExp && doc.content && (
                  <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "var(--border)" }}>
                    <pre
                      className="mt-3 text-[12px] leading-relaxed whitespace-pre-wrap"
                      style={{ color: "var(--muted-foreground)", fontFamily: "inherit" }}
                    >
                      {doc.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create drawer */}
      {editing !== null && (
        <SopEditor
          doc={editing === "new" ? null : editing}
          orgId={orgId}
          userId={user?.id ?? ""}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["sop_documents", orgId] });
          }}
        />
      )}
    </div>
  );
}

/* ─── Editor modal ───────────────────────────────────────────────────── */

function SopEditor({
  doc,
  orgId,
  userId,
  onClose,
  onSaved,
}: {
  doc: SopDocument | null;
  orgId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(doc?.title ?? "");
  const [category, setCategory] = useState(doc?.category ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const [status, setStatus] = useState<SopStatus>(doc?.status ?? "draft");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await upsertSopDocument(orgId, userId, {
        id: doc?.id,
        title: title.trim(),
        category: category.trim() || undefined,
        content,
        status,
      });
      toast.success(doc ? "SOP updated" : "SOP created");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save SOP");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[16px] font-bold">{doc ? "Edit SOP" : "New SOP"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted/30 transition">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Client onboarding checklist"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
              Category
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Sales, Operations, Finance"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
              Status
            </label>
            <div className="flex gap-2">
              {(["draft", "published", "archived"] as SopStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11.5px] font-medium capitalize transition",
                    status === s ? "ring-1 ring-current" : "opacity-60",
                  )}
                  style={{
                    background: STATUS_STYLES[s].bg,
                    color: STATUS_STYLES[s].text,
                  }}
                >
                  {s === "published" && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Step 1: ...\nStep 2: ...\n..."
              rows={8}
              className="w-full rounded-lg px-3 py-2 text-[12.5px] font-mono outline-none resize-none transition"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[12.5px] font-medium"
            style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-[12.5px] font-medium disabled:opacity-50"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34D399",
              border: "1px solid rgba(52,211,153,0.25)",
            }}
          >
            {saving ? "Saving…" : doc ? "Save changes" : "Create SOP"}
          </button>
        </div>
      </div>
    </div>
  );
}
