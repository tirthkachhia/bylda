/**
 * FORMS — /app/crm/forms
 *
 * Lead-capture form builder over the forms / form_submissions tables (Phase 1).
 * Build fields, publish, share the public URL (/f/[id]), and review submissions.
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, ArrowLeft, Trash2, FileText, Copy, ExternalLink, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CustomersNav } from "@/components/app/CustomersNav";

export const Route = createFileRoute("/app/crm/forms")({ component: FormsPage });

type Field = { id: string; type: string; label: string; required: boolean; placeholder?: string };
type FormRow = {
  id: string;
  name: string;
  description: string | null;
  fields: Field[];
  submit_action: string;
  submit_message: string | null;
  is_active: boolean;
  submission_count: number;
};

const FIELD_TYPES = [
  ["short_text", "Short Text"],
  ["long_text", "Long Text"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["number", "Number"],
  ["date", "Date"],
  ["dropdown", "Dropdown"],
  ["checkbox", "Checkbox"],
] as const;

function FormsPage() {
  const { user, currentOrgId } = useAuth();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormRow | "new" | null>(null);
  const [viewing, setViewing] = useState<FormRow | null>(null);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("forms")
      .select(
        "id, name, description, fields, submit_action, submit_message, is_active, submission_count",
      )
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false });
    setForms((data as FormRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function remove(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id));
    await supabase.from("forms").delete().eq("id", id);
  }

  if (editing) {
    return (
      <FormBuilder
        initial={editing === "new" ? null : editing}
        orgId={currentOrgId ?? null}
        userId={user?.id ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <CustomersNav />
        </div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--text-primary]">
              Forms
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">{forms.length} forms</p>
          </div>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover]"
          >
            <Plus className="h-4 w-4" /> New Form
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[--bg-surface-2]" />
            ))}
          </div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
            <FileText className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--text-primary]">No forms yet</p>
            <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
              Capture leads from your site. Build a form and share its public link.
            </p>
            <button
              onClick={() => setEditing("new")}
              className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover]"
            >
              Create Form
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
            {forms.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 border-b border-[--border] px-4 py-4 last:border-b-0 hover:bg-[--bg-surface-2]"
              >
                <button onClick={() => setEditing(f)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-[--text-primary]">{f.name}</p>
                  <p className="truncate text-xs text-[--text-muted]">
                    {f.fields?.length ?? 0} fields · {f.submission_count} submissions
                  </p>
                </button>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    f.is_active
                      ? "border-green-100 bg-[--success-light] text-[--success]"
                      : "border-gray-200 bg-gray-100 text-gray-600"
                  }`}
                >
                  {f.is_active ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => setViewing(f)}
                  className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary]"
                >
                  Submissions
                </button>
                <CopyLinkButton path={`/f/${f.id}`} />
                <button
                  onClick={() => remove(f.id)}
                  className="rounded-lg p-1.5 text-[--text-muted] hover:text-[--danger]"
                  aria-label="Delete form"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewing && <SubmissionsDrawer form={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 rounded-lg border border-[--border] px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary]"
    >
      <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Link"}
    </button>
  );
}

function SortableField({
  field: f,
  onUpdate,
  onRemove,
}: {
  field: Field;
  onUpdate: (patch: Partial<Field>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: f.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-xl border border-[--border] bg-[--bg-surface-2] p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-[--text-muted] hover:text-[--text-secondary] active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="rounded-md bg-[--accent-light] px-2 py-0.5 text-[10px] font-semibold text-[--accent]">
        {FIELD_TYPES.find(([t]) => t === f.type)?.[1] ?? f.type}
      </span>
      <input
        value={f.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        className="flex-1 rounded-lg border border-[--border] bg-[--bg-surface] px-3 py-1.5 text-xs text-[--text-primary] focus:border-[--border-focus] focus:outline-none"
      />
      <label className="flex items-center gap-1 text-xs text-[--text-secondary]">
        <input
          type="checkbox"
          checked={f.required}
          onChange={(e) => onUpdate({ required: e.target.checked })}
        />
        Required
      </label>
      <button
        onClick={onRemove}
        className="text-[--text-muted] hover:text-[--danger]"
        aria-label="Remove field"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FormBuilder({
  initial,
  orgId,
  userId,
  onClose,
  onSaved,
}: {
  initial: FormRow | null;
  orgId: string | null;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [fields, setFields] = useState<Field[]>(initial?.fields ?? []);
  const [submitMessage, setSubmitMessage] = useState(
    initial?.submit_message ?? "Thanks! We'll be in touch.",
  );
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    if (over && a.id !== over.id) {
      setFields((prev) => {
        const oldIdx = prev.findIndex((f) => f.id === a.id);
        const newIdx = prev.findIndex((f) => f.id === over.id);
        return oldIdx < 0 || newIdx < 0 ? prev : arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  function addField(type: string) {
    setFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        label: FIELD_TYPES.find(([t]) => t === type)?.[1] ?? type,
        required: false,
      },
    ]);
  }
  function updateField(id: string, patch: Partial<Field>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  async function save() {
    if (!orgId || !userId || !name.trim()) return;
    setSaving(true);
    const payload = {
      organization_id: orgId,
      created_by: userId,
      name: name.trim(),
      fields,
      submit_action: "message",
      submit_message: submitMessage,
      is_active: active,
    };
    if (initial) await supabase.from("forms").update(payload).eq("id", initial.id);
    else await supabase.from("forms").insert(payload);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={onClose}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[--text-muted] hover:text-[--text-primary]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to forms
        </button>

        <div className="space-y-5 rounded-2xl border border-[--border] bg-[--bg-surface] p-5 shadow-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Form name"
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
          />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
              Fields
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {fields.map((f) => (
                    <SortableField
                      key={f.id}
                      field={f}
                      onUpdate={(patch) => updateField(f.id, patch)}
                      onRemove={() => removeField(f.id)}
                    />
                  ))}
                  {fields.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[--border] px-4 py-6 text-center text-xs text-[--text-muted]">
                      Add fields below.
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FIELD_TYPES.map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => addField(type)}
                  className="rounded-lg border border-[--border] px-2.5 py-1 text-xs font-medium text-[--text-secondary] hover:border-[--border-strong] hover:text-[--text-primary]"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
              Confirmation message
            </label>
            <input
              value={submitMessage}
              onChange={(e) => setSubmitMessage(e.target.value)}
              className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[--text-secondary]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (accepting submissions)
          </label>

          <div className="flex items-center gap-2 border-t border-[--border] pt-4">
            <button
              onClick={save}
              disabled={saving || !name.trim() || fields.length === 0}
              className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover] disabled:opacity-50"
            >
              Save Form
            </button>
            {initial && (
              <a
                href={`/f/${initial.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-[--border] px-4 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary]"
              >
                <ExternalLink className="h-4 w-4" /> Preview
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmissionsDrawer({ form, onClose }: { form: FormRow; onClose: () => void }) {
  const [rows, setRows] = useState<
    { id: string; data: Record<string, unknown>; created_at: string }[] | null
  >(null);

  useEffect(() => {
    void supabase
      .from("form_submissions")
      .select("id, data, created_at")
      .eq("form_id", form.id)
      .order("created_at", { ascending: false })
      .then(({ data }) =>
        setRows(
          (data as { id: string; data: Record<string, unknown>; created_at: string }[]) ?? [],
        ),
      );
  }, [form.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full overflow-y-auto bg-[--bg-surface] shadow-[-8px_0_32px_rgba(0,0,0,0.08)] sm:w-[420px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[--border] px-5 py-4">
          <p className="text-[15px] font-semibold text-[--text-primary]">
            {form.name} — Submissions
          </p>
          <button onClick={onClose} className="text-[--text-muted] hover:text-[--text-primary]">
            ✕
          </button>
        </div>
        <div className="p-5">
          {rows === null ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-[--bg-surface-2]" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-xs text-[--text-muted]">No submissions yet.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[--border] bg-[--bg-surface-2] p-4"
                >
                  <p className="mb-2 text-xs text-[--text-muted]">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                  {Object.entries(r.data).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-sm">
                      <span className="font-medium text-[--text-secondary]">{k}:</span>
                      <span className="text-[--text-primary]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
