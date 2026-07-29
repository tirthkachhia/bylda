/**
 * TASK CENTER — /app/crm/tasks
 *
 * CRM tasks backed by the `tasks` table (Phase 1). Grouped by due date,
 * filterable by status / priority / type. Inline create, one-click complete.
 * Tasks created here also surface on deal/contact drawers (shared table).
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Check,
  Phone,
  Mail,
  CalendarClock,
  Users as UsersIcon,
  CheckSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CustomersNav } from "@/components/app/CustomersNav";

export const Route = createFileRoute("/app/crm/tasks")({ component: TasksPage });

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "completed" | "cancelled";
  task_type: "task" | "call" | "email" | "follow_up" | "meeting";
  created_at: string;
};

const TYPE_ICON: Record<Task["task_type"], typeof Phone> = {
  task: CheckSquare,
  call: Phone,
  email: Mail,
  follow_up: CalendarClock,
  meeting: UsersIcon,
};

const PRIORITY_BADGE: Record<Task["priority"], string> = {
  high: "bg-[--danger-light] text-[--danger] border-red-100",
  medium: "bg-[--warning-light] text-[--warning] border-amber-100",
  low: "bg-[--info-light] text-[--info] border-blue-100",
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function bucketFor(due: string | null): string {
  if (!due) return "No Date";
  const today = startOfDay(new Date());
  const day = startOfDay(new Date(due));
  const dayMs = 86_400_000;
  if (day < today) return "Overdue";
  if (day === today) return "Today";
  if (day === today + dayMs) return "Tomorrow";
  if (day <= today + 7 * dayMs) return "This Week";
  return "Later";
}

const BUCKET_ORDER = ["Overdue", "Today", "Tomorrow", "This Week", "Later", "No Date"];

function TasksPage() {
  const { user, currentOrgId } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, due_date, priority, status, task_type, created_at")
      .eq("organization_id", currentOrgId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500);
    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const statusOk =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? t.status === "open" || t.status === "in_progress"
            : t.status === statusFilter;
      const prioOk = priorityFilter === "all" ? true : t.priority === priorityFilter;
      return statusOk && prioOk;
    });
  }, [tasks, statusFilter, priorityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      const b = t.status === "completed" ? "Completed" : bucketFor(t.due_date);
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(t);
    }
    const order = [...BUCKET_ORDER, "Completed"];
    return order.filter((b) => map.has(b)).map((b) => [b, map.get(b)!] as const);
  }, [filtered]);

  async function toggleComplete(t: Task) {
    const nextStatus = t.status === "completed" ? "open" : "completed";
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: nextStatus } : x)));
    await supabase
      .from("tasks")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", t.id);
  }

  async function addTask(form: {
    title: string;
    task_type: Task["task_type"];
    priority: Task["priority"];
    due_date: string;
  }) {
    if (!currentOrgId || !user || !form.title.trim()) return;
    const { data } = await supabase
      .from("tasks")
      .insert({
        organization_id: currentOrgId,
        created_by: user.id,
        title: form.title.trim(),
        task_type: form.task_type,
        priority: form.priority,
        due_date: form.due_date || null,
      })
      .select("id, title, description, due_date, priority, status, task_type, created_at")
      .single();
    if (data) setTasks((prev) => [data as Task, ...prev]);
    setShowAdd(false);
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
              Tasks
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">
              {filtered.filter((t) => t.status !== "completed").length} open
            </p>
          </div>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="flex items-center gap-1.5 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover]"
          >
            <Plus className="h-4 w-4" /> Add Task
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              ["active", "Active"],
              ["open", "Open"],
              ["in_progress", "In Progress"],
              ["completed", "Completed"],
              ["all", "All statuses"],
            ]}
          />
          <FilterSelect
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              ["all", "All priorities"],
              ["high", "High"],
              ["medium", "Medium"],
              ["low", "Low"],
            ]}
          />
        </div>

        {showAdd && <AddTaskForm onAdd={addTask} onCancel={() => setShowAdd(false)} />}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[--bg-surface-2]" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
            <CheckSquare className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--text-primary]">No tasks yet</p>
            <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
              Create your first task, or let Bylda add follow-ups from the CRM.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover]"
            >
              Add Task
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([bucket, items]) => (
              <div key={bucket}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                  {bucket} · {items.length}
                </h2>
                <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
                  {items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={() => toggleComplete(t)}
                      overdue={bucket === "Overdue"}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-2 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function TaskRow({
  task,
  onToggle,
  overdue,
}: {
  task: Task;
  onToggle: () => void;
  overdue: boolean;
}) {
  const Icon = TYPE_ICON[task.task_type];
  const done = task.status === "completed";
  return (
    <div className="flex items-center gap-3 border-b border-[--border] px-4 py-3.5 last:border-b-0 hover:bg-[--bg-surface-2]">
      <button
        onClick={onToggle}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          done
            ? "border-[--success] bg-[--success] text-white"
            : "border-[--border-strong] hover:border-[--accent]"
        }`}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <Icon className="h-4 w-4 shrink-0 text-[--text-muted]" />
      <span
        className={`flex-1 truncate text-sm ${
          done ? "text-[--text-muted] line-through" : "text-[--text-primary]"
        }`}
      >
        {task.title}
      </span>
      <span
        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_BADGE[task.priority]}`}
      >
        {task.priority}
      </span>
      {task.due_date && (
        <span
          className={`hidden text-xs sm:block ${overdue ? "text-[--danger]" : "text-[--text-muted]"}`}
        >
          {new Date(task.due_date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
    </div>
  );
}

function AddTaskForm({
  onAdd,
  onCancel,
}: {
  onAdd: (form: {
    title: string;
    task_type: Task["task_type"];
    priority: Task["priority"];
    due_date: string;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<Task["task_type"]>("task");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");

  return (
    <div className="mb-4 rounded-2xl border border-[--border] bg-[--bg-surface] p-5 shadow-sm">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAdd({ title, task_type: taskType, priority, due_date: dueDate });
        }}
        placeholder="Task title…"
        className="mb-3 w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as Task["task_type"])}
          className="rounded-xl border border-[--border] bg-[--bg-surface] px-3 py-2 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none"
        >
          <option value="task">Task</option>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="follow_up">Follow-up</option>
          <option value="meeting">Meeting</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Task["priority"])}
          className="rounded-xl border border-[--border] bg-[--bg-surface] px-3 py-2 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-xl border border-[--border] bg-[--bg-surface] px-3 py-2 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none"
        />
        <div className="ml-auto flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl border border-[--border] px-4 py-2 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary]"
          >
            Cancel
          </button>
          <button
            onClick={() => onAdd({ title, task_type: taskType, priority, due_date: dueDate })}
            disabled={!title.trim()}
            className="rounded-xl bg-[--accent] px-5 py-2 text-sm font-semibold text-white hover:bg-[--accent-hover] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
