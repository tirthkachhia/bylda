import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Sparkles,
  ArrowRight,
  Rocket,
  Zap,
  KanbanSquare,
  Inbox,
  Workflow,
  UserCheck,
  BarChart3,
  Settings as SettingsIcon,
  CreditCard,
  FileText,
  History,
  Lightbulb,
  Target,
  Mail,
  Megaphone,
  ScrollText,
  Globe,
  CornerDownLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toolRunsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { parseOperatorIntent } from "@/lib/operatorIntent";

type Group = "Action" | "Recent" | "Tool" | "Page";

type Item = {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Where to navigate */
  to: string;
  /** Tool slug for /app/launchpad/$tool routes */
  toolSlug?: string;
  /** Optional search params (used by /app/launchpad/$tool to prefill) */
  search?: { context?: string; title?: string };
  /** Match keywords / regex for static filtering */
  match: RegExp;
};

const STATIC_TOOLS: Item[] = [
  {
    id: "t-validate",
    group: "Tool",
    label: "Idea Validator",
    hint: "Pressure-test an idea",
    icon: Lightbulb,
    to: "/app/launchpad/$tool",
    toolSlug: "idea-validator",
    match: /validat|idea|test/i,
  },
  {
    id: "t-pitch",
    group: "Tool",
    label: "Pitch Generator",
    hint: "Investor-ready pitch",
    icon: ScrollText,
    to: "/app/launchpad/$tool",
    toolSlug: "pitch-generator",
    match: /pitch|deck|investor/i,
  },
  {
    id: "t-gtm",
    group: "Tool",
    label: "GTM Strategy",
    hint: "Channels, ICP, messaging",
    icon: Target,
    to: "/app/launchpad/$tool",
    toolSlug: "gtm-strategy",
    match: /gtm|go-?to-?market|strategy|channel/i,
  },
  {
    id: "t-offer",
    group: "Tool",
    label: "Offer Builder",
    hint: "Irresistible offer",
    icon: Megaphone,
    to: "/app/launchpad/$tool",
    toolSlug: "offer",
    match: /offer|pricing|package/i,
  },
  {
    id: "t-ops",
    group: "Tool",
    label: "Ops Plan",
    hint: "Workflows, automations, KPIs",
    icon: Workflow,
    to: "/app/launchpad/$tool",
    toolSlug: "ops-plan",
    match: /ops|operations|plan|workflow/i,
  },
  {
    id: "t-followup",
    group: "Tool",
    label: "Follow-Up Sequence",
    hint: "Multi-touch emails",
    icon: Mail,
    to: "/app/launchpad/$tool",
    toolSlug: "followup",
    match: /follow|sequence|email/i,
  },
  {
    id: "t-audit",
    group: "Tool",
    label: "Website Auditor",
    hint: "Live site audit",
    icon: Globe,
    to: "/app/launchpad/$tool",
    toolSlug: "website-audit",
    match: /website|audit|seo|site/i,
  },
  {
    id: "t-first10",
    group: "Tool",
    label: "First 10 Customers",
    hint: "Acquisition roadmap",
    icon: Rocket,
    to: "/app/launchpad/$tool",
    toolSlug: "first-10-customers",
    match: /first|10|customers|acquisition/i,
  },
];

const STATIC_PAGES: Item[] = [
  {
    id: "p-pipeline",
    group: "Page",
    label: "Pipeline (CRM)",
    icon: KanbanSquare,
    to: "/app/bylda/crm",
    match: /pipeline|crm|deals|kanban/i,
  },
  {
    id: "p-leads",
    group: "Page",
    label: "Lead Capture",
    icon: Inbox,
    to: "/app/bylda/leads",
    match: /lead|capture|inbound/i,
  },
  {
    id: "p-flows",
    group: "Page",
    label: "Automation Workflows",
    icon: Workflow,
    to: "/app/bylda/workflows",
    match: /automation|workflow|trigger/i,
  },
  {
    id: "p-onboard",
    group: "Page",
    label: "Client Onboarding",
    icon: UserCheck,
    to: "/app/bylda/clients",
    match: /onboard|client|kickoff/i,
  },
  {
    id: "p-reports",
    group: "Page",
    label: "Reporting",
    icon: BarChart3,
    to: "/app/bylda/reports",
    match: /report|analytics|metrics|kpi/i,
  },
  {
    id: "p-launchpad",
    group: "Page",
    label: "Bylda",
    icon: Rocket,
    to: "/app/launchpad",
    match: /launchpad|tools/i,
  },
  { id: "p-bylda", group: "Page", label: "Bylda OS", icon: Zap, to: "/app/bylda", match: /bylda/i },
  {
    id: "p-history",
    group: "Page",
    label: "Run history",
    icon: History,
    to: "/app/launchpad/history",
    match: /history|past|runs/i,
  },
  {
    id: "p-assets",
    group: "Page",
    label: "Assets",
    icon: FileText,
    to: "/app/assets",
    match: /asset|outputs|library/i,
  },
  {
    id: "p-billing",
    group: "Page",
    label: "Billing & plans",
    icon: CreditCard,
    to: "/app/billing",
    match: /billing|plan|upgrade|invoice/i,
  },
  {
    id: "p-settings",
    group: "Page",
    label: "Settings",
    icon: SettingsIcon,
    to: "/app/settings",
    match: /settings|account|integration/i,
  },
];

// Map server tool_key (edge function name) → Launchpad tool slug
const TOOL_KEY_TO_SLUG: Record<string, string> = {
  "validate-idea": "idea-validator",
  "generate-pitch": "pitch-generator",
  "generate-gtm-strategy": "gtm-strategy",
  "generate-offer": "offer",
  "generate-ops-plan": "ops-plan",
  "generate-followup-sequence": "followup",
  "analyze-website": "website-audit",
};

function prettyToolName(toolKey: string): string {
  const slug = TOOL_KEY_TO_SLUG[toolKey] ?? toolKey;
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AiOperator({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement | null>(null);

  const { currentOrgId } = useAuth();
  const recentQ = useQuery({
    ...toolRunsQuery(currentOrgId ?? "", 8),
    enabled: !!currentOrgId && open,
  });

  // Build dynamic Action(s) from natural language
  const dynamicActions = useMemo<Item[]>(() => {
    const intent = parseOperatorIntent(q);
    if (!intent) return [];
    return [
      {
        id: "intent-" + intent.toolSlug,
        group: "Action",
        label: intent.label,
        hint: intent.hint,
        icon: Sparkles,
        to: "/app/launchpad/$tool",
        toolSlug: intent.toolSlug,
        search: intent.search,
        match: /.*/,
      },
    ];
  }, [q]);

  // Recent run items — clicking restores the original input via search params
  const recentItems = useMemo<Item[]>(() => {
    if (q.trim()) return [];
    const runs = recentQ.data ?? [];
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const r of runs) {
      const slug = TOOL_KEY_TO_SLUG[r.tool_key];
      if (!slug) continue;
      const input = (r.input as Record<string, unknown> | null) ?? {};
      const ctx =
        (typeof input.context === "string" && input.context) ||
        (typeof input.idea === "string" && input.idea) ||
        (typeof input.business === "string" && input.business) ||
        (typeof input.url === "string" && input.url) ||
        "";
      const dedupeKey = slug + ":" + ctx.slice(0, 30);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const titleHint = ctx
        ? ctx.slice(0, 56) + (ctx.length > 56 ? "…" : "")
        : new Date(r.created_at).toLocaleDateString();

      out.push({
        id: "recent-" + r.id,
        group: "Recent",
        label: prettyToolName(r.tool_key),
        hint: titleHint,
        icon: History,
        to: "/app/launchpad/$tool",
        toolSlug: slug,
        search: ctx ? { context: ctx, title: ctx.slice(0, 60) } : {},
        match: /.*/,
      });
      if (out.length >= 4) break;
    }
    return out;
  }, [q, recentQ.data]);

  // Filter static lists by query
  const filtered = useMemo<Item[]>(() => {
    const term = q.trim();
    if (!term) {
      return [...recentItems, ...STATIC_TOOLS, ...STATIC_PAGES];
    }
    const t = term.toLowerCase();
    const matches = (it: Item) =>
      it.match.test(term) ||
      it.label.toLowerCase().includes(t) ||
      (it.hint?.toLowerCase().includes(t) ?? false);
    return [...dynamicActions, ...STATIC_TOOLS.filter(matches), ...STATIC_PAGES.filter(matches)];
  }, [q, dynamicActions, recentItems]);

  // Group in stable order
  const grouped = useMemo(() => {
    const order: Group[] = ["Action", "Recent", "Tool", "Page"];
    const out: { group: Group; items: Item[] }[] = [];
    for (const g of order) {
      const items = filtered.filter((i) => i.group === g);
      if (items.length) out.push({ group: g, items });
    }
    return out;
  }, [filtered]);

  // Flat list for keyboard nav
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q]);
  useEffect(() => {
    if (!open) {
      setQ("");
      setActiveIdx(0);
    }
  }, [open]);

  const execute = (it: Item) => {
    onOpenChange(false);
    setQ("");
    if (it.to === "/app/launchpad/$tool" && it.toolSlug) {
      navigate({
        to: "/app/launchpad/$tool",
        params: { tool: it.toolSlug },
        search: it.search ?? {},
      });
    } else {
      navigate({ to: it.to });
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = flat[activeIdx];
      if (it) execute(it);
    }
  };

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-active="true"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  let renderIdx = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask the Operator… e.g. ‘validate a SaaS for dentists’"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
          {grouped.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">
              <p>No matches.</p>
              <p className="mt-1 text-[11.5px]">
                Try “build my GTM for solo lawyers”, “audit https://my.site”, or “first 10 customers
                for an AI bookkeeper”.
              </p>
            </div>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} className="mb-1">
                <div className="px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {group}
                </div>
                {items.map((it) => {
                  renderIdx++;
                  const active = renderIdx === activeIdx;
                  const Icon = it.icon;
                  const showsPrefill = !!it.search?.context;
                  return (
                    <button
                      key={it.id}
                      data-active={active}
                      onMouseEnter={() => setActiveIdx(renderIdx)}
                      onClick={() => execute(it)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition",
                        active
                          ? "bg-surface-2 text-foreground"
                          : "text-foreground/85 hover:bg-surface-2/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                          active
                            ? group === "Action"
                              ? "bg-accent/15 text-accent"
                              : "bg-primary/15 text-primary"
                            : "bg-surface-2 text-muted-foreground",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{it.label}</span>
                        {it.hint && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {it.hint}
                          </span>
                        )}
                      </span>
                      {showsPrefill && (
                        <span className="hidden sm:inline rounded-full bg-accent/10 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-accent">
                          Prefill
                        </span>
                      )}
                      {active ? (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-surface-2/40 px-4 py-2 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">
              ↑↓
            </kbd>{" "}
            navigate
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">
              ↵
            </kbd>{" "}
            open
          </span>
          <span>Operator routes you, prefills context, and resumes recent runs.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
