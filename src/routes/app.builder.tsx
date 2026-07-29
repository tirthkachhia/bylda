import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect, createContext, useContext } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PALETTE_BLOCKS,
  CATEGORY_META,
  BLOCK_COLOR,
  BLOCK_CATEGORIES,
  getPaletteBlock,
  buildSentencePreview,
  isBranchingType,
  makeBranches,
  countBlocksDeep,
  findBlockDeep,
  updateBlockDeep,
  removeBlockDeep,
  insertBlockDeep,
  moveBlockDeep,
  type BlockCategory,
  type BlockType,
  type WorkflowBlock,
  type WorkflowBranch,
} from "@/lib/automation-blocks";
import {
  AUTOMATION_RECIPES,
  RECIPE_BY_SLUG,
  RECIPE_CATEGORY_META,
  type AutomationRecipe,
  type RecipeBlock,
} from "@/lib/automation-recipes";
import {
  AUDIENCE_META,
  publishTemplate,
  myTemplatesQuery,
  clientContactsQuery,
  type AudienceScope,
  type AutomationTemplate,
} from "@/lib/automation-templates";
import { runWorkflow, type RunResult } from "@/lib/automation-run";
import {
  Zap,
  Play,
  Clock,
  Save,
  Plus,
  X,
  GripVertical,
  FlaskConical,
  Radio,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  LayoutTemplate,
  Upload,
  Search,
  FolderOpen,
  Globe,
  Users,
  User,
  Building2,
} from "lucide-react";

export const Route = createFileRoute("/app/builder")({
  validateSearch: (search: Record<string, unknown>): { recipe?: string; template?: string } => ({
    recipe: typeof search.recipe === "string" ? search.recipe : undefined,
    template: typeof search.template === "string" ? search.template : undefined,
  }),
  component: BuilderPage,
});

/* ─── Local types ───────────────────────────────────────── */
type RunMode = "build" | "test" | "live";

const makeId = () => `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function recipeToBlocks(recipe: AutomationRecipe): WorkflowBlock[] {
  return recipe.blocks.map((b: RecipeBlock) => ({
    id: makeId(),
    type: b.type,
    label: b.label ?? "",
    config: { ...(b.config ?? {}) },
    // Recipes are linear; give any branch block empty lanes so they're editable.
    ...(isBranchingType(b.type) ? { branches: makeBranches(b.type) } : {}),
  }));
}

/**
 * Re-key persisted blocks so drag/drop ids stay unique within this session.
 * Recurses through branch lanes so published branching workflows round-trip.
 */
function rehydrateBlocks(raw: unknown): WorkflowBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is WorkflowBlock => !!b && typeof (b as WorkflowBlock).type === "string")
    .map((b) => {
      const block = b as WorkflowBlock;
      const next: WorkflowBlock = {
        id: makeId(),
        type: block.type,
        label: block.label ?? "",
        config: { ...(block.config ?? {}) },
      };
      if (Array.isArray(block.branches) && block.branches.length > 0) {
        next.branches = block.branches.map((br) => ({
          id: br.id,
          label: br.label,
          blocks: rehydrateBlocks(br.blocks),
        }));
      } else if (isBranchingType(block.type)) {
        next.branches = makeBranches(block.type);
      }
      return next;
    });
}

/* ─── Palette Block (draggable from palette) ──────────────── */
function PaletteItem({ block }: { block: (typeof PALETTE_BLOCKS)[number] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${block.type}`,
    data: { type: block.type, fromPalette: true },
  });
  const colors = BLOCK_COLOR[block.color];
  const Icon = block.icon;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border p-2.5 cursor-grab active:cursor-grabbing select-none transition-all",
        colors.bg,
        colors.border,
        isDragging && "opacity-40",
      )}
    >
      <div
        className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", colors.bg)}
      >
        <Icon className={cn("h-4 w-4", colors.text)} />
      </div>
      <div className="min-w-0">
        <div className={cn("text-[12px] font-semibold leading-tight", colors.text)}>
          {block.label}
        </div>
        <div className="text-[10.5px] text-muted-foreground leading-tight mt-px truncate">
          {block.description}
        </div>
      </div>
    </div>
  );
}

/* ─── Builder context (shared block handlers for recursion) ─ */
interface BuilderCtxValue {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAddInBranch: (containerId: string, branchId: string) => void;
}
const BuilderCtx = createContext<BuilderCtxValue | null>(null);
const useBuilderCtx = () => {
  const ctx = useContext(BuilderCtx);
  if (!ctx) throw new Error("BuilderCtx missing");
  return ctx;
};

/* ─── Presentational block card ──────────────────────────── */
function BlockBody({
  block,
  isSelected,
  onSelect,
  onDelete,
  isFirst,
  controls,
  isDragging,
}: {
  block: WorkflowBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isFirst: boolean;
  controls: React.ReactNode;
  isDragging?: boolean;
}) {
  const def = getPaletteBlock(block.type);
  const colors = BLOCK_COLOR[def?.color ?? "blue"];
  const Icon = def?.icon ?? Zap;
  const branching = isBranchingType(block.type);

  return (
    <>
      {!isFirst && (
        <div className="flex justify-center py-1">
          <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
        </div>
      )}
      <div
        onClick={onSelect}
        className={cn(
          "group relative rounded-xl border-2 p-3 cursor-pointer transition-all select-none",
          colors.bg,
          isSelected
            ? "border-primary shadow-md shadow-primary/10"
            : cn(colors.border, "hover:border-primary/40"),
          isDragging && "opacity-50 shadow-xl",
          branching && "border-dashed",
        )}
      >
        <div className="flex items-start gap-3">
          {controls}

          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              colors.bg,
              "border",
              colors.border,
            )}
          >
            <Icon className={cn("h-4.5 w-4.5", colors.text)} />
          </div>

          <div className="flex-1 min-w-0">
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-widest opacity-60",
                colors.text,
              )}
            >
              {def?.category.toUpperCase() ?? "STEP"}
            </span>
            <div className="text-[13.5px] font-semibold text-foreground mt-0.5">
              {block.label || def?.label}
            </div>
            {Object.keys(block.config).length > 0 && (
              <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
                {Object.values(block.config).filter(Boolean).slice(0, 2).join(" · ")}
              </div>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Branch lanes (the Yes/No · A/B columns under a branch block) ─ */
const LANE_TONE: Record<string, { ring: string; text: string; dot: string }> = {
  yes: {
    ring: "border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
  },
  a: {
    ring: "border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
  },
  no: { ring: "border-rose-300 dark:border-rose-800", text: "text-rose-600", dot: "bg-rose-500" },
  b: {
    ring: "border-violet-300 dark:border-violet-800",
    text: "text-violet-600",
    dot: "bg-violet-500",
  },
};

function BranchLane({ block, branch }: { block: WorkflowBlock; branch: WorkflowBranch }) {
  const { onAddInBranch } = useBuilderCtx();
  const { setNodeRef, isOver } = useDroppable({ id: `branch::${block.id}::${branch.id}` });
  const tone = LANE_TONE[branch.id] ?? LANE_TONE.yes;

  return (
    <div className={cn("rounded-xl border bg-surface-1/30 p-2", tone.ring)}>
      <div className="flex items-center gap-1.5 px-1 pb-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
        <span className={cn("text-[10.5px] font-bold uppercase tracking-widest", tone.text)}>
          {branch.label}
        </span>
        <span className="text-[10px] text-muted-foreground/60">· {branch.blocks.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "rounded-lg border-2 border-dashed transition-all min-h-[52px] p-1.5",
          isOver ? "border-primary bg-primary/5" : "border-border/50",
        )}
      >
        {branch.blocks.length === 0 ? (
          <div className="flex items-center justify-center py-2 text-center text-[11px] text-muted-foreground/70">
            Drop steps for the {branch.label} path
          </div>
        ) : (
          branch.blocks.map((cb, i) => <NestedBlock key={cb.id} block={cb} isFirst={i === 0} />)
        )}
      </div>

      <button
        onClick={() => onAddInBranch(block.id, branch.id)}
        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
      >
        <Plus className="h-3 w-3" /> Add step
      </button>
    </div>
  );
}

function BranchLanes({ block }: { block: WorkflowBlock }) {
  const branches = block.branches ?? [];
  if (branches.length === 0) return null;
  return (
    <div className="ml-6 mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {branches.map((br) => (
        <BranchLane key={br.id} block={block} branch={br} />
      ))}
    </div>
  );
}

/* ─── Nested block (inside a branch lane — reordered via ↑/↓) ─ */
function NestedBlock({ block, isFirst }: { block: WorkflowBlock; isFirst: boolean }) {
  const { selectedId, onSelect, onDelete, onMove } = useBuilderCtx();
  const controls = (
    <div className="mt-0.5 flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-60">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMove(block.id, -1);
        }}
        className="hover:text-primary"
      >
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMove(block.id, 1);
        }}
        className="hover:text-primary"
      >
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
  return (
    <div className="relative">
      <BlockBody
        block={block}
        isSelected={selectedId === block.id}
        onSelect={() => onSelect(block.id)}
        onDelete={() => onDelete(block.id)}
        isFirst={isFirst}
        controls={controls}
      />
      {isBranchingType(block.type) && <BranchLanes block={block} />}
    </div>
  );
}

/* ─── Top-level block (drag-to-reorder on the trunk) ─────── */
function SortableTopBlock({ block, isFirst }: { block: WorkflowBlock; isFirst: boolean }) {
  const { selectedId, onSelect, onDelete } = useBuilderCtx();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const controls = (
    <div
      {...listeners}
      {...attributes}
      className="mt-0.5 flex h-5 w-5 shrink-0 cursor-grab active:cursor-grabbing items-center justify-center opacity-0 group-hover:opacity-50"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </div>
  );
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <BlockBody
        block={block}
        isSelected={selectedId === block.id}
        onSelect={() => onSelect(block.id)}
        onDelete={() => onDelete(block.id)}
        isFirst={isFirst}
        controls={controls}
        isDragging={isDragging}
      />
      {isBranchingType(block.type) && <BranchLanes block={block} />}
    </div>
  );
}

/* ─── Canvas Drop Zone ───────────────────────────────────── */
function CanvasDropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex-1 rounded-2xl border-2 border-dashed transition-all min-h-[400px] p-4",
        isOver ? "border-primary bg-primary/5" : "border-border/60 bg-surface-1/30",
      )}
    >
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Plus className="h-7 w-7 text-primary/60" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-foreground">
              Drag a block here to start
            </div>
            <div className="text-[13px] text-muted-foreground mt-1">
              Start with a <span className="text-orange-500 font-medium">Trigger</span> — the event
              that kicks things off, or load a recipe.
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/* ─── Properties Panel ───────────────────────────────────── */
function PropertiesPanel({
  block,
  onChange,
}: {
  block: WorkflowBlock;
  onChange: (id: string, updates: Partial<WorkflowBlock>) => void;
}) {
  const def = getPaletteBlock(block.type);
  if (!def) return null;
  const colors = BLOCK_COLOR[def.color];
  const Icon = def.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className={cn("flex items-center gap-3 rounded-xl border p-3", colors.bg, colors.border)}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
            colors.border,
          )}
        >
          <Icon className={cn("h-5 w-5", colors.text)} />
        </div>
        <div>
          <div className={cn("text-[11px] font-bold uppercase tracking-widest", colors.text)}>
            {def.category}
          </div>
          <div className="text-[14px] font-semibold text-foreground">{def.label}</div>
        </div>
      </div>

      {/* Custom label */}
      <div>
        <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
          Step name (optional)
        </label>
        <input
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          placeholder={def.label}
          value={block.label}
          onChange={(e) => onChange(block.id, { label: e.target.value })}
        />
      </div>

      {/* Config fields */}
      {def.configFields.map((field) => (
        <div key={field.key}>
          <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
            {field.label}
          </label>
          {field.type === "select" ? (
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              value={block.config[field.key] ?? ""}
              onChange={(e) =>
                onChange(block.id, { config: { ...block.config, [field.key]: e.target.value } })
              }
            >
              <option value="">Choose one…</option>
              {field.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
              placeholder={field.placeholder}
              value={block.config[field.key] ?? ""}
              onChange={(e) =>
                onChange(block.id, { config: { ...block.config, [field.key]: e.target.value } })
              }
            />
          ) : (
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              placeholder={field.placeholder}
              value={block.config[field.key] ?? ""}
              onChange={(e) =>
                onChange(block.id, { config: { ...block.config, [field.key]: e.target.value } })
              }
            />
          )}
        </div>
      ))}

      <div className="rounded-xl border border-border/60 bg-surface-1/50 p-3 text-[11.5px] text-muted-foreground">
        <span className="font-semibold text-foreground">How it works: </span>
        {def.description}
      </div>
    </div>
  );
}

/* ─── Recipes / Load panel ───────────────────────────────── */
function StartFromPanel({
  orgId,
  onClose,
  onLoad,
}: {
  orgId: string | null;
  onClose: () => void;
  onLoad: (blocks: WorkflowBlock[], name: string) => void;
}) {
  const [tab, setTab] = useState<"recipes" | "mine">("recipes");
  const myQ = useQuery({ ...myTemplatesQuery(orgId ?? ""), enabled: !!orgId && tab === "mine" });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4.5 w-4.5 text-primary" />
            <div className="text-[15px] font-bold text-foreground">Start from a workflow</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 shrink-0">
          {(
            [
              ["recipes", "Prebuilt recipes"],
              ["mine", "My published templates"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all",
                tab === k
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "recipes" ? (
            <div className="space-y-5">
              {Object.entries(RECIPE_CATEGORY_META).map(([cat, meta]) => {
                const recipes = AUTOMATION_RECIPES.filter((r) => r.category === cat);
                if (recipes.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                      {meta.label}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {recipes.map((r) => (
                        <button
                          key={r.slug}
                          onClick={() => onLoad(recipeToBlocks(r), r.name)}
                          className="text-left rounded-xl border border-border p-3.5 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="text-[22px] leading-none">{r.emoji}</span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                                {r.name}
                              </div>
                              <div className="text-[11.5px] text-muted-foreground mt-0.5 line-clamp-2">
                                {r.description}
                              </div>
                              <div className="text-[10.5px] text-muted-foreground/70 mt-1.5 flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {r.blocks.length} steps · {r.triggerSummary}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              {myQ.isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (myQ.data ?? []).length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-9 w-9 mx-auto text-muted-foreground/30 mb-3" />
                  <div className="text-[13px] font-semibold text-foreground">
                    No published templates yet
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-1">
                    Build a workflow and hit <strong>Publish</strong> to save it here.
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {(myQ.data as AutomationTemplate[]).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onLoad(rehydrateBlocks(t.blocks), t.name)}
                      className="text-left rounded-xl border border-border p-3.5 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <div className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                        {t.name}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5 line-clamp-2">
                        {t.description || t.trigger_summary}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-muted-foreground/70">
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">
                          {AUDIENCE_META[t.audience_scope].short}
                        </span>
                        <span>{(t.blocks ?? []).length} steps</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Publish modal ──────────────────────────────────────── */
const PUBLISH_CATEGORIES = [
  "lead-nurture",
  "booking",
  "sales",
  "retention",
  "reputation",
  "onboarding",
  "general",
];

function PublishModal({
  blocks,
  defaultName,
  orgId,
  userId,
  onClose,
  onPublished,
}: {
  blocks: WorkflowBlock[];
  defaultName: string;
  orgId: string;
  userId: string;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [tags, setTags] = useState("");
  const [scope, setScope] = useState<AudienceScope>("self");
  const [contactId, setContactId] = useState<string>("");
  const [contactSearch, setContactSearch] = useState("");
  const [publishing, setPublishing] = useState(false);

  const contactsQ = useQuery({
    ...clientContactsQuery(userId),
    enabled: scope === "client",
  });

  const firstTrigger = blocks.find((b) => b.type.startsWith("trigger_"));
  const triggerSummary = firstTrigger
    ? buildSentencePreview([firstTrigger])
    : "Manual / no trigger set";
  const triggerIcon = firstTrigger ? (getPaletteBlock(firstTrigger.type)?.icon ?? Zap) : Zap;

  const contacts = (contactsQ.data ?? []).filter((c) => {
    if (!contactSearch) return true;
    const s = contactSearch.toLowerCase();
    return (
      `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase().includes(s) ||
      (c.company ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s)
    );
  });
  const selectedContact = (contactsQ.data ?? []).find((c) => c.id === contactId);

  const canPublish =
    name.trim().length > 0 && blocks.length > 0 && (scope !== "client" || !!contactId);

  const handlePublish = async () => {
    if (!canPublish) {
      if (!name.trim()) toast.error("Give your template a name");
      else if (blocks.length === 0) toast.error("Add at least one step first");
      else if (scope === "client" && !contactId) toast.error("Pick a client to publish for");
      return;
    }
    setPublishing(true);
    try {
      const targetLabel =
        scope === "client" && selectedContact
          ? `${selectedContact.first_name ?? ""} ${selectedContact.last_name ?? ""}`.trim() ||
            selectedContact.company ||
            selectedContact.email ||
            "Client"
          : null;
      await publishTemplate({
        organization_id: orgId,
        created_by: userId,
        name: name.trim(),
        description: description.trim(),
        category,
        blocks,
        trigger_summary: triggerSummary,
        audience_scope: scope,
        target_contact_id: scope === "client" ? contactId : null,
        target_label: targetLabel,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast.success(
        scope === "marketplace"
          ? "Published to the marketplace 🎉"
          : scope === "client"
            ? "Published for your client"
            : "Template published",
      );
      onPublished();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const TriggerIcon = triggerIcon;
  const scopeIcon: Record<AudienceScope, React.ComponentType<{ className?: string }>> = {
    self: User,
    client: Building2,
    all_clients: Users,
    marketplace: Globe,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-5 border-b border-border bg-background">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Upload className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <div className="text-[15px] font-bold text-foreground">Publish automation</div>
              <div className="text-[12px] text-muted-foreground">
                Save it as a template and choose who it's for
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Trigger summary */}
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-1/40 px-3.5 py-2.5">
            <TriggerIcon className="h-4 w-4 text-orange-500 shrink-0" />
            <div className="text-[12.5px] text-muted-foreground">
              <span className="font-semibold text-foreground">{blocks.length} steps</span> ·{" "}
              {triggerSummary}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Template name
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13.5px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              placeholder="e.g. Speed-to-Lead SMS + Email"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              What does it do?
            </label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13.5px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
              placeholder="One line on what this automation accomplishes…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Category + tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                Category
              </label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 capitalize"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {PUBLISH_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                Tags
              </label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                placeholder="sms, follow-up"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          {/* Audience scope */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
              Who is this for?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(AUDIENCE_META) as AudienceScope[]).map((s) => {
                const ScopeIcon = scopeIcon[s];
                const active = scope === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <ScopeIcon
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-[12.5px] font-semibold",
                          active ? "text-primary" : "text-foreground",
                        )}
                      >
                        {AUDIENCE_META[s].label}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {AUDIENCE_META[s].description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Client picker */}
          {scope === "client" && (
            <div className="rounded-xl border border-border bg-surface-1/40 p-3 space-y-2">
              <label className="text-[12px] font-semibold text-foreground block">
                Pick the client
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  placeholder="Search your contacts…"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
              </div>
              {contactsQ.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-[12px] text-muted-foreground py-3 text-center">
                  No contacts found. Add clients under Contacts first.
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {contacts.slice(0, 50).map((c) => {
                    const label =
                      `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                      c.company ||
                      c.email ||
                      "Unnamed";
                    return (
                      <button
                        key={c.id}
                        onClick={() => setContactId(c.id)}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                          contactId === c.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-surface-2 text-foreground",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium truncate">{label}</div>
                          {c.company && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {c.company}
                            </div>
                          )}
                        </div>
                        {contactId === c.id && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 p-4 border-t border-border bg-background">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-[13px] font-medium text-foreground hover:bg-surface-1 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || !canPublish}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {publishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Builder Page ──────────────────────────────────── */
function BuilderPage() {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [workflowName, setWorkflowName] = useState("My first workflow");
  const [blocks, setBlocks] = useState<WorkflowBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<RunMode>("build");
  const [draggingType, setDraggingType] = useState<BlockType | null>(null);
  const [activePaletteCategory, setActivePaletteCategory] = useState<BlockCategory>("trigger");
  const [saving, setSaving] = useState(false);
  const [showStartFrom, setShowStartFrom] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const selectedBlock = selectedId ? findBlockDeep(blocks, selectedId) : null;

  // Deep-link: ?recipe=slug loads a prebuilt recipe; ?template=id loads a published template.
  useEffect(() => {
    if (search.recipe && RECIPE_BY_SLUG[search.recipe]) {
      const r = RECIPE_BY_SLUG[search.recipe];
      setBlocks(recipeToBlocks(r));
      setWorkflowName(r.name);
      navigate({ to: "/app/builder", search: {}, replace: true });
    } else if (search.template) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("automation_templates")
        .select("name, blocks")
        .eq("id", search.template)
        .single()
        .then(({ data }: { data: { name: string; blocks: unknown } | null }) => {
          if (data) {
            setBlocks(rehydrateBlocks(data.blocks));
            setWorkflowName(data.name);
          }
          navigate({ to: "/app/builder", search: {}, replace: true });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addBlock = useCallback(
    (type: BlockType, container?: { containerId: string; branchId: string }) => {
      const def = getPaletteBlock(type);
      if (!def) return;
      const newBlock: WorkflowBlock = {
        id: makeId(),
        type,
        label: "",
        config: {},
        ...(isBranchingType(type) ? { branches: makeBranches(type) } : {}),
      };
      setBlocks((prev) =>
        insertBlockDeep(
          prev,
          container?.containerId ?? null,
          container?.branchId ?? null,
          newBlock,
        ),
      );
      setSelectedId(newBlock.id);
    },
    [],
  );

  const updateBlock = useCallback((id: string, updates: Partial<WorkflowBlock>) => {
    setBlocks((prev) => updateBlockDeep(prev, id, updates));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => removeBlockDeep(prev, id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setBlocks((prev) => moveBlockDeep(prev, id, dir));
  }, []);

  const loadBlocks = useCallback(
    (next: WorkflowBlock[], name: string) => {
      if (blocks.length > 0 && !window.confirm("Replace the current canvas with this workflow?"))
        return;
      setBlocks(next);
      setWorkflowName(name);
      setSelectedId(null);
      setShowStartFrom(false);
      toast.success(`Loaded "${name}"`);
    },
    [blocks.length],
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.fromPalette) setDraggingType(data.type as BlockType);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingType(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overId = String(over.id);

    // Dropping a palette block: into a branch lane, or onto the trunk.
    if (activeData?.fromPalette) {
      const type = activeData.type as BlockType;
      if (overId.startsWith("branch::")) {
        const [, containerId, branchId] = overId.split("::");
        addBlock(type, { containerId, branchId });
      } else {
        addBlock(type);
      }
      return;
    }

    // Reorder on the trunk (only when both ends are top-level blocks).
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      setBlocks((prev) => arrayMove(prev, oldIdx, newIdx));
    }
  }

  const executeRun = async (runMode: "test" | "live", contactId: string | null) => {
    if (!currentOrgId) return;
    if (blocks.length === 0) {
      toast.error("Add at least one block first");
      return;
    }
    setRunning(true);
    setRunResult(null);
    setMode(runMode === "live" ? "live" : "test");
    try {
      const result = await runWorkflow({
        blocks,
        orgId: currentOrgId,
        workflowName,
        contactId,
        mode: runMode,
      });
      setRunResult(result);
      setShowRun(false);
      if (result.status === "failed") {
        toast.error("Run finished with errors — see the trace");
      } else if (result.simulated) {
        toast.success(
          runMode === "test"
            ? "Test run complete — steps simulated"
            : "Run complete — some steps simulated (add provider keys to go fully live)",
        );
      } else {
        toast.success("Workflow executed live ✓");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const saveWorkflow = async () => {
    if (!currentOrgId) return;
    if (blocks.length === 0) {
      toast.error("Add at least one block before saving");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");
      const payload = {
        user_id: authUser.id,
        org_id: currentOrgId,
        name: workflowName,
        description: buildSentencePreview(blocks),
        blocks: JSON.parse(JSON.stringify(blocks)),
        mode,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("workflow_builders").insert(payload);
      if (error) throw error;
      toast.success("Workflow saved!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const visiblePalette = PALETTE_BLOCKS.filter((b) => b.category === activePaletteCategory);
  const categories = BLOCK_CATEGORIES;
  const sentence = buildSentencePreview(blocks);

  const builderCtx: BuilderCtxValue = {
    selectedId,
    onSelect: (id) => setSelectedId((s) => (s === id ? null : id)),
    onDelete: deleteBlock,
    onMove: moveBlock,
    onAddInBranch: (containerId, branchId) => {
      const firstAction = PALETTE_BLOCKS.find((b) => b.category === "action");
      if (firstAction) addBlock(firstAction.type, { containerId, branchId });
    },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-[calc(100vh-52px)] overflow-hidden">
        {/* ── Top bar ── */}
        <div
          className="shrink-0 flex items-center gap-3 px-5 py-3 border-b"
          style={{ background: "var(--background)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <input
              className="text-[15px] font-bold bg-transparent outline-none border-none min-w-0 max-w-[260px] text-foreground"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
            />
            <div className="h-4 w-px bg-border" />
            <div className="text-[12px] text-muted-foreground truncate max-w-sm hidden md:block">
              {sentence}
            </div>
          </div>

          {/* Start from / templates */}
          <button
            onClick={() => setShowStartFrom(true)}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-medium text-foreground hover:border-primary/40 hover:text-primary transition-all"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates
          </button>

          {/* Mode tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-surface-1/50">
            {(["build", "test", "live"] as RunMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  if (m === "build") {
                    setMode("build");
                  } else {
                    setMode(m);
                    setShowRun(true);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-all",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "test" ? (
                  <FlaskConical className="h-3.5 w-3.5" />
                ) : m === "live" ? (
                  <Radio className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-foreground hover:bg-surface-2 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>

          <button
            onClick={() => {
              if (blocks.length === 0) {
                toast.error("Add at least one step before publishing");
                return;
              }
              setShowPublish(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary/90 transition-all"
          >
            <Upload className="h-3.5 w-3.5" />
            Publish
          </button>
        </div>

        {/* ── Main 3-panel layout ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left: Block Palette ── */}
          <div
            className="hidden lg:flex w-[220px] shrink-0 flex-col border-r"
            style={{ background: "var(--sidebar)", borderColor: "var(--sidebar-border)" }}
          >
            {/* Category tabs */}
            <div
              className="flex flex-col gap-px p-2 border-b"
              style={{ borderColor: "var(--sidebar-border)" }}
            >
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setActivePaletteCategory(cat)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-left transition-all",
                      activePaletteCategory === cat
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        activePaletteCategory === cat ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                    />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* Blocks */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 pb-0.5">
                Drag onto canvas →
              </div>
              {visiblePalette.map((block) => (
                <PaletteItem key={block.type} block={block} />
              ))}
            </div>
          </div>

          {/* ── Center: Canvas ── */}
          <div className="flex-1 overflow-y-auto p-4">
            {runResult && (
              <div className="mb-4 rounded-xl border border-border bg-surface-1/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FlaskConical className="h-3.5 w-3.5 text-blue-500" />
                    {runResult.mode === "live" ? "Live run" : "Test run"}
                    <span className="text-muted-foreground/60 normal-case font-medium">
                      {runResult.steps_completed}/{runResult.steps_total} steps ·{" "}
                      {runResult.duration_ms}ms
                    </span>
                  </div>
                  <button
                    onClick={() => setRunResult(null)}
                    className="text-muted-foreground/60 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {runResult.trace.map((step, i) => {
                  const color =
                    step.status === "ok"
                      ? "text-emerald-600"
                      : step.status === "error"
                        ? "text-destructive"
                        : step.status === "simulated"
                          ? "text-amber-600"
                          : "text-muted-foreground";
                  return (
                    <div
                      key={`${step.block_id}-${i}`}
                      className={cn("flex items-start gap-2 text-[12.5px]", color)}
                      style={{ paddingLeft: (step.depth ?? 0) * 16 }}
                    >
                      {step.status === "ok" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-px" />
                      ) : step.status === "error" ? (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                      ) : step.status === "simulated" ? (
                        <FlaskConical className="h-3.5 w-3.5 shrink-0 mt-px" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0 mt-px" />
                      )}
                      <span className="leading-snug">{step.detail}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <BuilderCtx.Provider value={builderCtx}>
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <CanvasDropZone isEmpty={blocks.length === 0}>
                  {blocks.length === 0 && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10">
                      <button
                        onClick={() => setShowStartFrom(true)}
                        className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-[12.5px] font-semibold text-primary hover:bg-primary/20 transition-all"
                      >
                        <Sparkles className="h-4 w-4" /> Start from a recipe
                      </button>
                    </div>
                  )}
                  <div className="space-y-0">
                    {blocks.map((block, idx) => (
                      <SortableTopBlock key={block.id} block={block} isFirst={idx === 0} />
                    ))}
                  </div>

                  {/* Add block button at bottom */}
                  {blocks.length > 0 && (
                    <div className="flex flex-col items-center gap-1 mt-2 pt-2">
                      <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
                      <div className="relative group">
                        <button
                          className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-2.5 text-[12.5px] font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
                          onClick={() => {
                            const firstAction = PALETTE_BLOCKS.find((b) => b.category === "action");
                            if (firstAction) addBlock(firstAction.type);
                          }}
                        >
                          <Plus className="h-4 w-4" /> Add next step
                        </button>
                      </div>
                    </div>
                  )}
                </CanvasDropZone>
              </SortableContext>
            </BuilderCtx.Provider>

            {/* Mobile palette (shown below canvas on small screens) */}
            <div className="lg:hidden mt-4">
              <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Add blocks
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActivePaletteCategory(cat)}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all",
                      activePaletteCategory === cat
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {CATEGORY_META[cat].label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {visiblePalette.map((block) => {
                  const Icon = block.icon;
                  const colors = BLOCK_COLOR[block.color];
                  return (
                    <button
                      key={block.type}
                      onClick={() => addBlock(block.type)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2.5 text-left",
                        colors.bg,
                        colors.border,
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", colors.text)} />
                      <span className={cn("text-[12px] font-semibold", colors.text)}>
                        {block.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right: Properties ── */}
          <div
            className="hidden lg:flex w-[260px] shrink-0 flex-col border-l"
            style={{ borderColor: "var(--sidebar-border)", background: "var(--sidebar)" }}
          >
            {selectedBlock ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">
                  Configure step
                </div>
                <PropertiesPanel block={selectedBlock} onChange={updateBlock} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary/60" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-foreground">Click any block</div>
                  <div className="text-[12px] text-muted-foreground mt-1">
                    Select a step on the canvas to configure it here.
                  </div>
                </div>
              </div>
            )}

            {/* Sentence preview at bottom */}
            <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--sidebar-border)" }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">
                What this workflow does
              </div>
              <div className="text-[12px] text-muted-foreground leading-relaxed">{sentence}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggingType &&
          (() => {
            const def = getPaletteBlock(draggingType);
            if (!def) return null;
            const colors = BLOCK_COLOR[def.color];
            const Icon = def.icon;
            return (
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border-2 p-3 shadow-xl cursor-grabbing w-[200px]",
                  colors.bg,
                  colors.border,
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", colors.text)} />
                <span className={cn("text-[13px] font-semibold", colors.text)}>{def.label}</span>
              </div>
            );
          })()}
      </DragOverlay>

      {/* Modals */}
      {showStartFrom && (
        <StartFromPanel
          orgId={currentOrgId}
          onClose={() => setShowStartFrom(false)}
          onLoad={loadBlocks}
        />
      )}
      {showPublish && currentOrgId && user && (
        <PublishModal
          blocks={blocks}
          defaultName={workflowName}
          orgId={currentOrgId}
          userId={user.id}
          onClose={() => setShowPublish(false)}
          onPublished={() => {
            setShowPublish(false);
            navigate({ to: "/app/workflow-templates" });
          }}
        />
      )}
      {showRun && user && (
        <RunModal
          userId={user.id}
          running={running}
          onClose={() => setShowRun(false)}
          onRun={executeRun}
        />
      )}
    </DndContext>
  );
}

/* ─── Run modal — pick test/live + an optional contact ───── */
function RunModal({
  userId,
  running,
  onClose,
  onRun,
}: {
  userId: string;
  running: boolean;
  onClose: () => void;
  onRun: (mode: "test" | "live", contactId: string | null) => void;
}) {
  const [runMode, setRunMode] = useState<"test" | "live">("test");
  const [contactId, setContactId] = useState<string>("");
  const [contactSearch, setContactSearch] = useState("");

  const contactsQ = useQuery({ ...clientContactsQuery(userId) });
  const contacts = (contactsQ.data ?? []).filter((c) => {
    if (!contactSearch) return true;
    const s = contactSearch.toLowerCase();
    return (
      `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase().includes(s) ||
      (c.company ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Play className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <div className="text-[15px] font-bold text-foreground">Run workflow</div>
              <div className="text-[12px] text-muted-foreground">
                Execute the steps and see a live trace
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Test vs Live */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["test", "Test", "Simulate every step. Nothing is sent.", FlaskConical],
                ["live", "Live", "Actually send / update. Uses your providers.", Radio],
              ] as const
            ).map(([m, label, desc, Icon]) => {
              const active = runMode === m;
              return (
                <button
                  key={m}
                  onClick={() => setRunMode(m)}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-[13px] font-semibold",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>
                </button>
              );
            })}
          </div>

          {/* Contact */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Run against a contact (optional)
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                placeholder="Search your contacts…"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              <button
                onClick={() => setContactId("")}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors",
                  contactId === ""
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-2 text-muted-foreground",
                )}
              >
                <User className="h-3.5 w-3.5" /> No contact — sample run
              </button>
              {contacts.slice(0, 40).map((c) => {
                const label =
                  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                  c.company ||
                  c.email ||
                  "Unnamed";
                return (
                  <button
                    key={c.id}
                    onClick={() => setContactId(c.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                      contactId === c.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-surface-2 text-foreground",
                    )}
                  >
                    <span className="text-[12.5px] font-medium truncate">{label}</span>
                    {contactId === c.id && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {runMode === "live" && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-[12px] text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
              Live mode performs real sends and CRM updates. Steps without configured provider keys
              are simulated and labelled in the trace.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-[13px] font-medium text-foreground hover:bg-surface-1 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onRun(runMode, contactId || null)}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run {runMode}
          </button>
        </div>
      </div>
    </div>
  );
}
