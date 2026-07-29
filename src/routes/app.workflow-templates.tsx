import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  myTemplatesQuery,
  marketplaceTemplatesQuery,
  installTemplate,
  archiveTemplate,
  activeAutomationsQuery,
  activateAutomation,
  deactivateAutomation,
  canAutoFire,
  templateSchedule,
  AUDIENCE_META,
  type AutomationTemplate,
  type AudienceScope,
  type ActiveAutomation,
} from "@/lib/automation-templates";
import { describeSchedule, formatUntil } from "@/lib/automation-schedule";
import { AUTOMATION_RECIPES } from "@/lib/automation-recipes";
import { nudgeAutomationDispatch } from "@/lib/automation-run";
import {
  Workflow,
  Blocks,
  Upload,
  Globe,
  Users,
  User,
  Building2,
  Download,
  Trash2,
  Search,
  Sparkles,
  ArrowRight,
  Zap,
  Pencil,
  Store,
  FolderOpen,
  Power,
  PowerOff,
  Clock,
} from "lucide-react";

/**
 * Honest schedule status for a template card. Live schedules show when they
 * run and when the next fire is due; "Custom" schedules state plainly that
 * they can't auto-run yet instead of pretending to be live.
 */
function scheduleNoteFor(t: AutomationTemplate, activeRow?: ActiveAutomation): string | null {
  const raw = templateSchedule(t);
  if (!raw) return null;
  const described = describeSchedule(raw);
  if (!described)
    return "Custom schedules can't run automatically yet — pick a preset in the Builder.";
  if (!activeRow) return `Runs ${described} once activated.`;
  return activeRow.next_run_at
    ? `Runs ${described} · next ${formatUntil(new Date(activeRow.next_run_at))}`
    : `Runs ${described} · arming…`;
}

export const Route = createFileRoute("/app/workflow-templates")({
  component: WorkflowTemplatesPage,
});

const SCOPE_ICON: Record<AudienceScope, React.ComponentType<{ className?: string }>> = {
  self: User,
  client: Building2,
  all_clients: Users,
  marketplace: Globe,
};

function AudienceBadge({ scope, label }: { scope: AudienceScope; label?: string | null }) {
  const Icon = SCOPE_ICON[scope];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
      <Icon className="h-3 w-3" />
      {scope === "client" && label ? label : AUDIENCE_META[scope].short}
    </span>
  );
}

function TemplateCard({
  template,
  owned,
  onEdit,
  onInstall,
  onArchive,
  onToggleActive,
  active,
  autoFire,
  busy,
  scheduleNote,
  onSchedule,
}: {
  template: AutomationTemplate;
  owned: boolean;
  onEdit: () => void;
  onInstall: () => void;
  onArchive: () => void;
  onToggleActive: () => void;
  active: boolean;
  autoFire: boolean;
  busy: boolean;
  /** Human line about when this runs (schedule templates only). */
  scheduleNote?: string | null;
  /** True when the template has a schedule the dispatcher can actually run. */
  onSchedule?: boolean;
}) {
  const steps = Array.isArray(template.blocks) ? template.blocks.length : 0;
  return (
    <div className="bylda-card rounded-2xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Workflow className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-foreground truncate">
              {template.name}
            </div>
            <div className="text-[11px] text-muted-foreground capitalize">
              {template.category.replace(/-/g, " ")}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <AudienceBadge scope={template.audience_scope} label={template.target_label} />
          {owned && active && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          )}
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">
        {template.description || template.trigger_summary}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {steps} steps
        </span>
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {template.install_count} installs
        </span>
      </div>

      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {owned && (
        <button
          onClick={onToggleActive}
          disabled={busy}
          title={
            autoFire
              ? active
                ? "Turn off — stop firing automatically"
                : "Turn on — fire automatically on its trigger"
              : "This trigger can't auto-fire yet; activate to run it manually"
          }
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-all disabled:opacity-50",
            active
              ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          <span className="flex items-center gap-1.5">
            {active ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
            {active
              ? onSchedule
                ? "Active — on schedule"
                : "Active — firing on trigger"
              : autoFire
                ? "Activate (auto-fire)"
                : "Activate"}
          </span>
          <span
            className={cn(
              "relative h-4 w-7 rounded-full transition-colors",
              active ? "bg-emerald-500" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                active ? "left-3.5" : "left-0.5",
              )}
            />
          </span>
        </button>
      )}

      {owned && scheduleNote && (
        <div
          className={cn(
            "flex items-start gap-1.5 text-[11px] leading-relaxed",
            onSchedule ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400",
          )}
        >
          <Clock className="mt-0.5 h-3 w-3 shrink-0" />
          {scheduleNote}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onInstall}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          <Download className="h-3.5 w-3.5" />
          {owned ? "Open" : "Install"}
        </button>
        {owned ? (
          <>
            <button
              onClick={onEdit}
              title="Edit in builder"
              className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-2 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onArchive}
              title="Archive"
              className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-2 text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={onEdit}
            title="Preview in builder"
            className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-2 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function WorkflowTemplatesPage() {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgId = currentOrgId ?? "";

  const [tab, setTab] = useState<"mine" | "marketplace">("mine");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const mineQ = useQuery({ ...myTemplatesQuery(orgId), enabled: !!orgId && tab === "mine" });
  const marketQ = useQuery({ ...marketplaceTemplatesQuery(), enabled: tab === "marketplace" });
  const activeQ = useQuery({ ...activeAutomationsQuery(orgId), enabled: !!orgId });
  const activeByTemplate = new Map(
    (activeQ.data ?? []).filter((a) => a.is_active).map((a) => [a.template_id, a]),
  );

  const list = (tab === "mine" ? mineQ.data : marketQ.data) ?? [];
  const filtered = list.filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(s) ||
      t.description.toLowerCase().includes(s) ||
      t.tags.some((tag) => tag.toLowerCase().includes(s))
    );
  });

  const openInBuilder = (id: string) => navigate({ to: "/app/builder", search: { template: id } });

  const handleInstall = async (t: AutomationTemplate) => {
    if (!orgId) return;
    setBusyId(t.id);
    try {
      await installTemplate(t.id, orgId);
      await qc.invalidateQueries({ queryKey: ["automation_templates"] });
      toast.success(
        t.audience_scope === "marketplace" ? `Installed "${t.name}"` : `Opening "${t.name}"`,
      );
      openInBuilder(t.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Install failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (t: AutomationTemplate) => {
    if (!window.confirm(`Archive "${t.name}"? It will no longer be available to install.`)) return;
    setBusyId(t.id);
    try {
      await archiveTemplate(t.id);
      await qc.invalidateQueries({ queryKey: ["automation_templates", "mine", orgId] });
      toast.success("Template archived");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (t: AutomationTemplate) => {
    if (!orgId || !user) return;
    const isActive = activeByTemplate.has(t.id);
    setBusyId(t.id);
    try {
      if (isActive) {
        await deactivateAutomation(t.id, orgId);
        toast.success(`"${t.name}" turned off`);
      } else {
        await activateAutomation(t, orgId, user.id);
        nudgeAutomationDispatch(); // drain queued events + arm schedules right away
        const schedule = describeSchedule(templateSchedule(t));
        if (schedule) {
          toast.success(`"${t.name}" is live — runs ${schedule}`);
        } else if (templateSchedule(t)) {
          toast.warning(
            `"${t.name}" activated, but custom schedules can't run automatically yet — pick a preset in the Builder`,
          );
        } else {
          toast.success(
            canAutoFire(t)
              ? `"${t.name}" is live — it'll fire automatically on its trigger`
              : `"${t.name}" activated`,
          );
        }
      }
      await qc.invalidateQueries({ queryKey: ["active_automations", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    } finally {
      setBusyId(null);
    }
  };

  const loading = tab === "mine" ? mineQ.isLoading : marketQ.isLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-primary/70 mb-1">
            <Store className="h-3 w-3" /> Automation Templates
          </div>
          <h1 className="text-2xl font-bold text-foreground">Workflow templates</h1>
          <p className="text-[13px] mt-0.5 text-muted-foreground">
            Build an automation once, then publish it for yourself, a client, all your clients, or
            the whole marketplace.
          </p>
        </div>
        <Link
          to="/app/builder"
          className="shrink-0 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-primary/90 transition-all"
        >
          <Blocks className="h-4 w-4" /> Build new workflow
        </Link>
      </div>

      {/* Quick-start recipes */}
      <div className="rounded-2xl border border-border bg-surface-1/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="text-[13px] font-bold text-foreground">Start from a proven recipe</div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {AUTOMATION_RECIPES.slice(0, 4).map((r) => (
            <Link
              key={r.slug}
              to="/app/builder"
              search={{ recipe: r.slug }}
              className="text-left rounded-xl border border-border bg-background p-3 hover:border-primary/40 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-2">
                <span className="text-[20px] leading-none">{r.emoji}</span>
                <div className="text-[12.5px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {r.name}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                {r.description}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-border p-0.5 bg-surface-1/50 w-fit">
          {(
            [
              ["mine", "My templates", FolderOpen],
              ["marketplace", "Marketplace", Globe],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-all",
                tab === k
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bylda-card rounded-2xl h-44 animate-pulse bg-surface-2/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          {tab === "mine" ? (
            <>
              <Upload className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <div className="text-[14px] font-semibold text-foreground">
                You haven't published any automations yet
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-1 mb-4">
                Open the builder, create a workflow, and hit Publish to choose who it's for.
              </p>
              <Link
                to="/app/builder"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary/90 transition-all"
              >
                <Blocks className="h-4 w-4" /> Open builder <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <Globe className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <div className="text-[14px] font-semibold text-foreground">
                No marketplace templates yet
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-1">
                Be the first — publish a workflow to the marketplace from the builder.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const owned = tab === "mine" || t.organization_id === orgId;
            return (
              <TemplateCard
                key={t.id}
                template={t}
                owned={owned}
                active={activeByTemplate.has(t.id)}
                autoFire={canAutoFire(t)}
                busy={busyId === t.id}
                scheduleNote={scheduleNoteFor(t, activeByTemplate.get(t.id))}
                onSchedule={describeSchedule(templateSchedule(t)) !== null}
                onEdit={() => openInBuilder(t.id)}
                onInstall={() => (owned ? openInBuilder(t.id) : handleInstall(t))}
                onArchive={() => handleArchive(t)}
                onToggleActive={() => handleToggleActive(t)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
