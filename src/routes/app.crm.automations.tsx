/**
 * AUTOMATIONS — /app/crm/automations
 *
 * Workflow list + builder over the automation_workflows table (Phase 1).
 * A workflow is a trigger + an ordered list of steps. "Test" runs it through
 * the workflow-engine edge function (Phase 2) in dry-run mode; "Activate"
 * flips it live. Prebuilt templates seed common flows.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Play, Trash2, Zap, ArrowLeft, FlaskConical, GripVertical } from "lucide-react";
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
import { invokeEdge } from "@/lib/invokeEdge";

export const Route = createFileRoute("/app/crm/automations")({ component: AutomationsPage });

const TRIGGERS = [
  "contact_created",
  "contact_tagged",
  "lead_stage_changed",
  "form_submitted",
  "appointment_booked",
  "appointment_cancelled",
  "appointment_no_show",
  "message_received",
  "payment_received",
  "manual",
  "schedule",
  "webhook",
] as const;

const STEP_TYPES = [
  ["send_email", "Send Email"],
  ["send_sms", "Send SMS"],
  ["wait", "Wait"],
  ["add_tag", "Add Tag"],
  ["remove_tag", "Remove Tag"],
  ["update_contact_field", "Update Field"],
  ["move_to_stage", "Move to Stage"],
  ["create_task", "Create Task"],
  ["webhook", "Webhook"],
  ["end", "End Workflow"],
] as const;

type Step = { type: string; config: Record<string, unknown> };
type EditStep = Step & { _id: string };

type Workflow = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  steps: Step[];
  is_active: boolean;
  run_count: number;
  status: string;
  last_triggered_at: string | null;
};

const TEMPLATES: { name: string; trigger_type: string; steps: Step[] }[] = [
  {
    name: "New Lead Follow-Up",
    trigger_type: "contact_created",
    steps: [
      {
        type: "send_email",
        config: { subject: "Welcome!", body: "Hi {{first_name}}, thanks for reaching out." },
      },
      { type: "wait", config: { duration: 1, unit: "days" } },
      { type: "send_sms", config: { body: "Hi {{first_name}}, just following up!" } },
      { type: "wait", config: { duration: 3, unit: "days" } },
      { type: "create_task", config: { title: "Call {{first_name}}", task_type: "call" } },
    ],
  },
  {
    name: "Appointment Reminder",
    trigger_type: "appointment_booked",
    steps: [
      {
        type: "send_email",
        config: { subject: "Booking confirmed", body: "You're booked, {{first_name}}." },
      },
      { type: "wait", config: { duration: 24, unit: "hours" } },
      { type: "send_sms", config: { body: "Reminder: your appointment is tomorrow." } },
    ],
  },
  {
    name: "Lead Qualification",
    trigger_type: "form_submitted",
    steps: [
      { type: "add_tag", config: { tag: "lead" } },
      { type: "create_task", config: { title: "Qualify new lead", task_type: "follow_up" } },
      {
        type: "send_email",
        config: { subject: "Thanks!", body: "We got your details, {{first_name}}." },
      },
    ],
  },
  {
    name: "Won Deal Thank You",
    trigger_type: "lead_stage_changed",
    steps: [
      { type: "add_tag", config: { tag: "customer" } },
      {
        type: "send_email",
        config: { subject: "Welcome aboard", body: "Thank you, {{first_name}}!" },
      },
    ],
  },
  {
    name: "Re-engagement",
    trigger_type: "schedule",
    steps: [
      {
        type: "send_email",
        config: { subject: "We miss you", body: "Hi {{first_name}}, anything we can help with?" },
      },
      { type: "wait", config: { duration: 3, unit: "days" } },
      { type: "send_sms", config: { body: "Still here if you need us, {{first_name}}." } },
    ],
  },
];

function AutomationsPage() {
  const { user, currentOrgId } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Workflow | "new" | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("automation_workflows")
      .select(
        "id, name, description, trigger_type, steps, is_active, run_count, status, last_triggered_at",
      )
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false });
    setWorkflows((data as Workflow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function toggleActive(w: Workflow) {
    const next = !w.is_active;
    setWorkflows((prev) =>
      prev.map((x) =>
        x.id === w.id ? { ...x, is_active: next, status: next ? "active" : "paused" } : x,
      ),
    );
    await supabase
      .from("automation_workflows")
      .update({ is_active: next, status: next ? "active" : "paused" })
      .eq("id", w.id);
  }

  async function remove(id: string) {
    setWorkflows((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("automation_workflows").delete().eq("id", id);
  }

  async function createFromTemplate(t: (typeof TEMPLATES)[number]) {
    if (!currentOrgId || !user) return;
    const { data } = await supabase
      .from("automation_workflows")
      .insert({
        organization_id: currentOrgId,
        created_by: user.id,
        name: t.name,
        trigger_type: t.trigger_type,
        steps: t.steps as never,
        status: "draft",
      })
      .select(
        "id, name, description, trigger_type, steps, is_active, run_count, status, last_triggered_at",
      )
      .single();
    if (data) setWorkflows((prev) => [data as Workflow, ...prev]);
    setShowTemplates(false);
  }

  if (editing) {
    return (
      <WorkflowBuilder
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--text-primary]">
              Automations
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">{workflows.length} workflows</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates((s) => !s)}
              className="rounded-xl border border-[--border] px-4 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary]"
            >
              Templates
            </button>
            <button
              onClick={() => setEditing("new")}
              className="flex items-center gap-1.5 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover]"
            >
              <Plus className="h-4 w-4" /> New Workflow
            </button>
          </div>
        </div>

        {showTemplates && (
          <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-[--border] bg-[--bg-surface] p-5 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => createFromTemplate(t)}
                className="flex flex-col items-start gap-1 rounded-xl border border-[--border] p-4 text-left transition-colors hover:border-[--border-strong] hover:bg-[--bg-surface-2]"
              >
                <span className="text-sm font-semibold text-[--text-primary]">{t.name}</span>
                <span className="text-xs text-[--text-muted]">
                  {t.trigger_type.replace(/_/g, " ")} · {t.steps.length} steps
                </span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[--bg-surface-2]" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
            <Zap className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--text-primary]">No workflows yet</p>
            <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
              Automate follow-ups, reminders, and tagging. Start from a template or build your own.
            </p>
            <button
              onClick={() => setShowTemplates(true)}
              className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover]"
            >
              Browse Templates
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
            {workflows.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-3 border-b border-[--border] px-4 py-4 last:border-b-0 hover:bg-[--bg-surface-2]"
              >
                <button onClick={() => setEditing(w)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-[--text-primary]">{w.name}</p>
                  <p className="truncate text-xs text-[--text-muted]">
                    {w.trigger_type.replace(/_/g, " ")} · {w.steps?.length ?? 0} steps ·{" "}
                    {w.run_count} runs
                  </p>
                </button>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    w.is_active
                      ? "border-green-100 bg-[--success-light] text-[--success]"
                      : "border-gray-200 bg-gray-100 text-gray-600"
                  }`}
                >
                  {w.is_active ? "Active" : w.status}
                </span>
                <button
                  onClick={() => toggleActive(w)}
                  className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary]"
                >
                  {w.is_active ? "Pause" : "Activate"}
                </button>
                <button
                  onClick={() => remove(w.id)}
                  className="rounded-lg p-1.5 text-[--text-muted] hover:text-[--danger]"
                  aria-label="Delete workflow"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowBuilder({
  initial,
  orgId,
  userId,
  onClose,
  onSaved,
}: {
  initial: Workflow | null;
  orgId: string | null;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [trigger, setTrigger] = useState(initial?.trigger_type ?? "contact_created");
  // Local editing state carries a stable _id per step for drag-reorder; it's
  // stripped before persisting (workflow-engine reads only type/config).
  const [steps, setSteps] = useState<EditStep[]>(() =>
    (initial?.steps ?? []).map((s) => ({ ...s, _id: crypto.randomUUID() })),
  );
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function addStep(type: string) {
    setSteps((prev) => [...prev, { type, config: {}, _id: crypto.randomUUID() }]);
  }
  function updateStep(i: number, config: Record<string, unknown>) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, config } : s)));
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, j) => j !== i));
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setSteps((prev) => {
        const oldIdx = prev.findIndex((s) => s._id === active.id);
        const newIdx = prev.findIndex((s) => s._id === over.id);
        return oldIdx < 0 || newIdx < 0 ? prev : arrayMove(prev, oldIdx, newIdx);
      });
    }
  }
  const cleanSteps = (): Step[] => steps.map(({ _id: _drop, ...s }) => s);

  async function save(activate: boolean) {
    if (!orgId || !userId || !name.trim()) return;
    setSaving(true);
    const payload = {
      organization_id: orgId,
      created_by: userId,
      name: name.trim(),
      trigger_type: trigger,
      steps: cleanSteps() as never,
      is_active: activate,
      status: activate ? "active" : "draft",
    };
    if (initial) {
      await supabase.from("automation_workflows").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("automation_workflows").insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  async function test() {
    if (!initial) {
      setTestResult("Save the workflow first, then test it.");
      return;
    }
    setTestResult("Running…");
    try {
      const res = await invokeEdge<{ results: { steps_completed: number; steps_total: number }[] }>(
        "workflow-engine",
        { workflow_id: initial.id, mode: "test" },
      );
      const r = res.results?.[0];
      setTestResult(
        r ? `Dry run OK — ${r.steps_completed}/${r.steps_total} steps traced.` : "No result.",
      );
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Test failed.");
    }
  }

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={onClose}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[--text-muted] hover:text-[--text-primary]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to automations
        </button>

        <div className="space-y-5 rounded-2xl border border-[--border] bg-[--bg-surface] p-5 shadow-sm">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
              Workflow name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Lead Follow-Up"
              className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
              Trigger
            </label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none"
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
              Steps
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={steps.map((s) => s._id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {steps.map((s, i) => (
                    <SortableStep
                      key={s._id}
                      id={s._id}
                      index={i}
                      step={s}
                      onChange={(cfg) => updateStep(i, cfg)}
                      onRemove={() => removeStep(i)}
                    />
                  ))}
                  {steps.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[--border] px-4 py-6 text-center text-xs text-[--text-muted]">
                      Add steps below to build the flow.
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STEP_TYPES.map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => addStep(type)}
                  className="rounded-lg border border-[--border] px-2.5 py-1 text-xs font-medium text-[--text-secondary] hover:border-[--border-strong] hover:text-[--text-primary]"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>

          {testResult && (
            <div className="rounded-xl border border-[--border] bg-[--bg-surface-2] px-4 py-3 text-xs text-[--text-secondary]">
              {testResult}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-[--border] pt-4">
            <button
              onClick={() => save(false)}
              disabled={saving || !name.trim()}
              className="rounded-xl border border-[--border] px-5 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving || !name.trim() || steps.length === 0}
              className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover] disabled:opacity-50"
            >
              Activate
            </button>
            <button
              onClick={test}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-[--border] px-4 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary]"
            >
              <FlaskConical className="h-4 w-4" /> Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableStep({
  id,
  index,
  step,
  onChange,
  onRemove,
}: {
  id: string;
  index: number;
  step: Step;
  onChange: (cfg: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <StepEditor
        index={index}
        step={step}
        onChange={onChange}
        onRemove={onRemove}
        handle={
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-[--text-muted] hover:text-[--text-secondary] active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        }
      />
    </div>
  );
}

function StepEditor({
  index,
  step,
  onChange,
  onRemove,
  handle,
}: {
  index: number;
  step: Step;
  onChange: (cfg: Record<string, unknown>) => void;
  onRemove: () => void;
  handle?: ReactNode;
}) {
  const label = STEP_TYPES.find(([t]) => t === step.type)?.[1] ?? step.type;
  const cfg = step.config;
  const set = (k: string, v: unknown) => onChange({ ...cfg, [k]: v });
  const field = (k: string, placeholder: string) => (
    <input
      value={(cfg[k] as string) ?? ""}
      onChange={(e) => set(k, e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[--border] bg-[--bg-surface] px-3 py-2 text-xs text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none"
    />
  );

  return (
    <div className="rounded-xl border border-[--border] bg-[--bg-surface-2] p-3">
      <div className="mb-2 flex items-center gap-2">
        {handle}
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[--accent-light] text-[10px] font-bold text-[--accent]">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-[--text-primary]">{label}</span>
        <button
          onClick={onRemove}
          className="ml-auto text-[--text-muted] hover:text-[--danger]"
          aria-label="Remove step"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5">
        {step.type === "send_email" && field("subject", "Subject (use {{first_name}})")}
        {(step.type === "send_email" || step.type === "send_sms") && field("body", "Message body")}
        {(step.type === "add_tag" || step.type === "remove_tag") && field("tag", "Tag name")}
        {step.type === "update_contact_field" && (
          <>
            {field("field", "Field (e.g. status)")}
            {field("value", "New value")}
          </>
        )}
        {step.type === "move_to_stage" && field("stage", "Stage (e.g. Qualified)")}
        {step.type === "create_task" && field("title", "Task title")}
        {step.type === "webhook" && field("url", "https://…")}
        {step.type === "wait" && (
          <div className="flex gap-1.5">
            {field("duration", "Amount")}
            <select
              value={(cfg.unit as string) ?? "days"}
              onChange={(e) => set("unit", e.target.value)}
              className="rounded-lg border border-[--border] bg-[--bg-surface] px-2 py-2 text-xs text-[--text-primary] focus:outline-none"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
