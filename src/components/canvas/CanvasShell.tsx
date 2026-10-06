import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Layers3,
  PhoneCall,
  Search,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/bylda/shell/AppShell";
import { cn } from "@/lib/utils";
import type { CanvasView } from "./types";

const DOCK = [
  {
    id: "today",
    label: "Today",
    icon: CalendarDays,
    items: [
      { view: "brief" as const, label: "Morning Brief" },
      { view: "upcoming" as const, label: "Upcoming Calls" },
      { view: "actions" as const, label: "Priority Actions" },
      { view: "changes" as const, label: "Recent Changes" },
    ],
  },
  {
    id: "deals",
    label: "Deals",
    icon: Layers3,
    items: [
      { view: "deals" as const, label: "Focus Deals" },
      { view: "pipeline" as const, label: "Pipeline Intelligence" },
      { view: "risks" as const, label: "Risks & Signals" },
      { view: "stakeholders" as const, label: "Stakeholders" },
      { view: "commitments" as const, label: "Commitments" },
    ],
  },
  {
    id: "conversations",
    label: "Conversations",
    icon: PhoneCall,
    items: [
      { view: "calls" as const, label: "Calls & Meetings" },
      { view: "objections" as const, label: "Objections" },
      { view: "signals" as const, label: "Buying Signals" },
      { view: "coaching" as const, label: "Coaching" },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    icon: CheckSquare,
    items: [
      { view: "nba" as const, label: "Next Best Actions" },
      { view: "followups" as const, label: "Follow-Ups" },
      { view: "tasks" as const, label: "Tasks" },
      { view: "approvals" as const, label: "Approvals" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    items: [
      { view: "performance" as const, label: "My Performance" },
      { view: "team" as const, label: "Team Intelligence" },
      { view: "patterns" as const, label: "Patterns & Trends" },
    ],
  },
];

export function CanvasShell({
  title,
  canBack,
  alert,
  currentView,
  onBack,
  onHome,
  onAsk,
  onOpen,
  children,
}: {
  title: string;
  canBack: boolean;
  alert?: string | null;
  currentView: CanvasView;
  onBack: () => void;
  onHome: () => void;
  onAsk: (query: string) => void;
  onOpen: (view: CanvasView) => void;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <AppShell
      title={title}
      sidebarExtra={
        <div className="mt-4 border-t border-by-border-rail pt-3">
          {DOCK.map((group) => (
            <section key={group.id} className="mb-2">
              <p className="type-ui-label px-3 py-2 text-by-text-on-dark-muted">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => onOpen(item.view)}
                  className={cn(
                    "type-ui-small block w-full rounded-by-control px-3 py-2 text-left text-by-text-sidebar hover:bg-by-surface-sidebar-hover",
                    currentView === item.view &&
                      "bg-by-surface-sidebar-active text-by-text-on-dark",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </section>
          ))}
        </div>
      }
      headerExtra={
        <div className="flex items-center gap-2">
          {canBack && (
            <button
              type="button"
              onClick={onBack}
              className="type-ui-small flex items-center gap-1 text-by-text-secondary"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          )}
          <button type="button" onClick={onHome} className="type-ui-small text-by-text-secondary">
            Today
          </button>
          {alert && (
            <span className="type-ui-small hidden text-by-text-secondary sm:inline">{alert}</span>
          )}
          <form
            className="flex max-w-[280px] items-center gap-2 rounded-by-control border border-by-border-engraved bg-by-surface-inset px-3"
            onSubmit={(event) => {
              event.preventDefault();
              const value = query.trim();
              if (!value) return;
              onAsk(value);
              setQuery("");
            }}
          >
            <Search size={14} className="text-by-text-tertiary" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Bylda"
              className="type-ui-small h-9 min-w-0 w-full bg-transparent outline-none"
            />
            <button type="submit" aria-label="Ask Bylda" className="text-by-text-secondary">
              <Sparkles size={14} />
            </button>
          </form>
        </div>
      }
    >
      <div className="bylda-canvas px-4 py-6 sm:px-8">{children}</div>
    </AppShell>
  );
}
