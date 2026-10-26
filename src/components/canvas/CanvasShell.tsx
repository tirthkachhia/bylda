import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Layers3,
  PhoneCall,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
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
    <TooltipProvider delayDuration={200}>
      <div className="bylda-canvas relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f9fd] font-sans text-[#111318]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_8%,rgba(107,151,229,0.28),transparent_34%),radial-gradient(ellipse_at_12%_0%,rgba(176,164,232,0.18),transparent_32%)]" />
        <header className="relative z-20 flex h-14 shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onHome} className="rounded-xl" aria-label="Morning Brief">
              <Logo className="text-[#111318]" markClassName="h-8 w-8 rounded-[9px]" />
            </button>
            {canBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex h-8 items-center gap-1.5 rounded-full px-2 text-[12px] text-[#60656e] hover:bg-white/70"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <div className="text-[12px] font-medium text-[#60656e]">{title}</div>
          </div>
          <div className="flex items-center gap-2">
            {alert && (
              <span className="rounded-full bg-[#eaf1fb] px-2.5 py-1 text-[10px] font-semibold text-[#3275d8]">
                {alert}
              </span>
            )}
            <Link
              to="/app/settings"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#60656e] hover:bg-white/70"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-2 sm:px-8">
          {children}
        </main>

        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-[720px]">
            {openMenu && (
              <div className="mb-2 overflow-hidden rounded-[22px] border border-black/[0.08] bg-white/95 shadow-[0_18px_40px_rgba(17,19,24,0.08)] backdrop-blur-xl">
                {DOCK.find((item) => item.id === openMenu)?.items.map((item) => (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => {
                      onOpen(item.view);
                      setOpenMenu(null);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-3 text-left text-[13px] text-[#111318] hover:bg-[#eaf1fb]",
                      currentView === item.view && "bg-[#eaf1fb] font-semibold",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/90 p-1.5 shadow-[0_18px_40px_rgba(17,19,24,0.1)] backdrop-blur-xl">
              <div className="flex items-center px-1">
                {DOCK.map((item) => {
                  const Icon = item.icon;
                  const active = item.items.some((entry) => entry.view === currentView);
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={item.label}
                          onClick={() => {
                            onOpen(item.items[0].view);
                            setOpenMenu((current) => (current === item.id ? null : item.id));
                          }}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full text-[#60656e] transition",
                            active || openMenu === item.id
                              ? "bg-[#111318] text-white"
                              : "hover:bg-[#eaf1fb]",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#111318] text-white">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              <form
                className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = query.trim();
                  if (!value) return;
                  onAsk(value);
                  setQuery("");
                  setOpenMenu(null);
                }}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-[#8a9099]" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask Bylda"
                  className="h-10 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#8a9099]"
                />
                <kbd className="hidden rounded border border-black/[0.08] px-1.5 py-0.5 font-mono text-[9px] text-[#8a9099] sm:inline">
                  ⌘K
                </kbd>
                <button type="submit" className="text-[#3275d8]" aria-label="Ask Bylda">
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
