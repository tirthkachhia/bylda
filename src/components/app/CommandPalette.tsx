// Universal command palette (⌘K). Beyond the static app catalog (actions,
// pages, tools) it searches LIVE content when you type: your casefiles
// (tool_runs), your course modules & steps (the mission spine), and mentors —
// one search across the things you actually have, not a per-module silo.
//
// CRM entities (contacts, tasks) are intentionally NOT here yet: they ride
// behind the in-flight CRM write-path work. Everything searched here is safe
// to ship independently.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, ArrowUpRight } from "lucide-react";
import { LAUNCHPAD_TOOLS } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatLabel } from "@/lib/casefile";
import { MENTOR_ROSTER } from "@/lib/mentors";

type ItemTag = "action" | "casefile" | "course" | "mentor" | "page" | "tool";
type Item = { id: string; label: string; path: string; tag: ItemTag; sublabel?: string };

const NAV_ITEMS: Item[] = [
  { id: "home", label: "Home", path: "/app/mission-control", tag: "page" },
  { id: "bylda-home", label: "Bylda Home (Operate)", path: "/app/bylda-home", tag: "page" },
  { id: "course", label: "Your Course", path: "/app/launchpad/course", tag: "page" },
  { id: "workbench", label: "Workbench (Tools)", path: "/app/launchpad/", tag: "page" },
  { id: "contacts", label: "Customers · Contacts", path: "/app/contacts", tag: "page" },
  { id: "pipeline", label: "Customers · Pipeline", path: "/app/bylda/crm", tag: "page" },
  { id: "automations", label: "Automations", path: "/app/automations", tag: "page" },
  { id: "builder", label: "Automation Builder", path: "/app/builder", tag: "page" },
  { id: "integrations", label: "Integrations", path: "/app/integrations", tag: "page" },
  { id: "reports", label: "Insights · Reports", path: "/app/bylda/reports", tag: "page" },
  { id: "assets", label: "Library · Assets", path: "/app/assets", tag: "page" },
  { id: "memory", label: "Library · Memory", path: "/app/memory", tag: "page" },
  { id: "settings", label: "Settings", path: "/app/settings", tag: "page" },
  { id: "billing", label: "Billing", path: "/app/billing", tag: "page" },
];

const ACTION_ITEMS: Item[] = [
  { id: "act-briefing", label: "Generate AI briefing", path: "/app/bylda-home", tag: "action" },
  {
    id: "act-context",
    label: "Update business context",
    path: "/app/settings?tab=context",
    tag: "action",
  },
  {
    id: "act-review",
    label: "Generate weekly review",
    path: "/app/bylda/reports",
    tag: "action",
  },
  { id: "act-automation", label: "Deploy an automation", path: "/app/automations", tag: "action" },
  { id: "act-mission", label: "Continue my mission", path: "/app/mission-control", tag: "action" },
];

const TOOL_ITEMS: Item[] = LAUNCHPAD_TOOLS.map((t) => ({
  id: t.slug,
  label: t.name,
  path: `/app/launchpad/${t.slug}`,
  tag: "tool" as const,
}));

const MENTOR_ITEMS: Item[] = MENTOR_ROSTER.map((m) => ({
  id: `mentor-${m.id}`,
  label: m.name,
  sublabel: m.domain,
  path: "/app/launchpad/mentors",
  tag: "mentor" as const,
}));

const STATIC_PREVIEW = [...ACTION_ITEMS, ...NAV_ITEMS, ...TOOL_ITEMS];

// Group render order + the little monospace badge each row shows.
const GROUPS: { tag: ItemTag; heading: string; badge: string; accent: boolean }[] = [
  { tag: "action", heading: "Actions", badge: "act", accent: true },
  { tag: "casefile", heading: "Casefiles", badge: "case", accent: true },
  { tag: "course", heading: "Your course", badge: "step", accent: true },
  { tag: "mentor", heading: "Mentors", badge: "chat", accent: false },
  { tag: "page", heading: "Navigation", badge: "page", accent: false },
  { tag: "tool", heading: "AI Tools", badge: "tool", accent: true },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user, currentOrgId } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [casefiles, setCasefiles] = useState<Item[]>([]);
  const [courseItems, setCourseItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load the founder's live content once each time the palette opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      if (currentOrgId) {
        const { data } = await supabase
          .from("tool_runs")
          .select("id, tool_key, title, status, created_at")
          .eq("organization_id", currentOrgId)
          .eq("status", "succeeded")
          .order("created_at", { ascending: false })
          .limit(40);
        if (!cancelled) {
          const rows = (data ?? []) as { id: string; tool_key: string; title: string | null }[];
          setCasefiles(
            rows.map((r) => ({
              id: `case-${r.id}`,
              label: r.title || formatLabel(r.tool_key),
              sublabel: "Casefile",
              path: `/app/launchpad/outputs/${r.id}`,
              tag: "casefile" as const,
            })),
          );
        }
      }

      if (user?.id) {
        // Columns are newer than the generated Supabase types.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { data: ws } = await db
          .from("workspaces")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (ws && !cancelled) {
          const { data: mods } = await db
            .from("missions")
            .select("id, title, sort_order")
            .eq("workspace_id", ws.id)
            .not("generated_from_casefile_id", "is", null)
            .order("sort_order", { ascending: true });
          const modules = (mods ?? []) as { id: string; title: string }[];
          let items: Item[] = modules.map((m) => ({
            id: `mod-${m.id}`,
            label: m.title,
            sublabel: "Module",
            path: "/app/launchpad/course",
            tag: "course" as const,
          }));
          if (modules.length > 0) {
            const { data: steps } = await db
              .from("mission_steps")
              .select("id, title, mission_id")
              .in(
                "mission_id",
                modules.map((m) => m.id),
              )
              .order("sort_order", { ascending: true });
            const titleByModule = new Map(modules.map((m) => [m.id, m.title]));
            items = items.concat(
              ((steps ?? []) as { id: string; title: string; mission_id: string }[]).map((s) => ({
                id: `step-${s.id}`,
                label: s.title,
                sublabel: titleByModule.get(s.mission_id) ?? "Course step",
                path: "/app/launchpad/course",
                tag: "course" as const,
              })),
            );
          }
          if (!cancelled) setCourseItems(items);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, currentOrgId, user?.id]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const q = query.trim().toLowerCase();
  const match = (it: Item) =>
    it.label.toLowerCase().includes(q) || (it.sublabel?.toLowerCase().includes(q) ?? false);

  // Empty query → a small static preview. Typing → search across everything,
  // including live casefiles, course steps, and mentors.
  const filtered: Item[] = q
    ? [
        ...ACTION_ITEMS,
        ...casefiles,
        ...courseItems,
        ...MENTOR_ITEMS,
        ...NAV_ITEMS,
        ...TOOL_ITEMS,
      ].filter(match)
    : STATIC_PREVIEW.slice(0, 12);

  const handleSelect = useCallback(
    (path: string) => {
      const [pathname, search] = path.split("?");
      const searchParams = search
        ? Object.fromEntries(new URLSearchParams(search).entries())
        : undefined;
      navigate({ to: pathname as never, search: searchParams as never });
      onClose();
    },
    [navigate, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter" && filtered[selected]) {
        handleSelect(filtered[selected].path);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selected, handleSelect, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: "12vh", background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-[520px] overflow-hidden rounded-2xl border"
        style={{
          background: "var(--popover)",
          borderColor: "var(--border)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: "var(--border)" }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search casefiles, course, tools, mentors…"
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "var(--foreground)" }}
          />
          <kbd
            className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
          {filtered.length === 0 ? (
            <div
              className="py-10 text-center text-[12px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-3 p-1.5">
              {GROUPS.map((g) => {
                const rows = filtered.filter((i) => i.tag === g.tag);
                if (rows.length === 0) return null;
                return (
                  <div key={g.tag}>
                    <div
                      className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: g.accent ? "var(--primary)" : "var(--muted-foreground)" }}
                    >
                      {g.heading}
                    </div>
                    {rows.map((item) => {
                      const globalIdx = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item.path)}
                          onMouseEnter={() => setSelected(globalIdx)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
                          style={{
                            background: globalIdx === selected ? "var(--surface-2)" : "transparent",
                            color: "var(--foreground)",
                          }}
                        >
                          <span
                            className="w-8 shrink-0 font-mono text-[10px]"
                            style={{
                              color: g.accent ? "var(--primary)" : "var(--muted-foreground)",
                            }}
                          >
                            {g.badge}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.sublabel && (
                            <span
                              className="shrink-0 truncate text-[11px]"
                              style={{ color: "var(--text-faint)", maxWidth: 120 }}
                            >
                              {item.sublabel}
                            </span>
                          )}
                          {globalIdx === selected && (
                            <ArrowUpRight
                              className="h-3.5 w-3.5 shrink-0"
                              style={{ color: "var(--muted-foreground)" }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 border-t px-4 py-2.5 text-[10px]"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="font-mono">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
