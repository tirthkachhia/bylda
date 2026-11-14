import { createLink, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { ChevronDown, LogOut, Menu, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { FigmaPageBrowser, FigmaViewLink } from "@/components/app/FigmaPageViews";
import { figmaPageByKey } from "@/lib/figma-page-catalog";
import { guestStore } from "@/lib/guest";
import { supabase } from "@/integrations/supabase/client";
import { integrationsQuery } from "@/lib/queries";
import { clearLastAppPath } from "@/lib/session-restore";
import { initials } from "@/lib/coaching/calls";
import { behavioralNavigation, workspaceNavigation } from "@/lib/workspace-navigation";
import { WorkspacePicker } from "./WorkspacePicker";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceSearch } from "./coaching/WorkspaceSearch";
import {
  askWorkspace,
  askHistoryQuery,
  type QuestionScope,
  type AskSource,
} from "@/lib/coaching/ask-workspace";
import { animatePage30Panel } from "@/lib/coaching/page30-motion";
import { useWorkspaceView } from "@/lib/workspace-view";
import { useCoachingWorkspaceAccess } from "@/lib/coaching/workspace-access";

const dock = [
  { key: "intelligence", label: "Intelligence", to: "/app" },
  { key: "reports", label: "Reports", to: "/app/reports" },
  { key: "calls", label: "Calls", to: "/app/crm/calls" },
  { key: "inbox", label: "Inbox", to: "/app/notifications" },
  { key: "settings", label: "Settings", to: "/app/settings" },
] as const;

const DockLink = createLink(
  forwardRef<HTMLAnchorElement, ComponentProps<"a"> & { current: boolean }>(function DockAnchor(
    { current, ...props },
    ref,
  ) {
    return <a {...props} ref={ref} aria-current={current ? "page" : undefined} />;
  }),
);

export function LiveWorkspaceShell({ children }: { children: ReactNode }) {
  const { user, profile, currentOrg, currentOrgId, signOut } = useAuth(),
    queryClient = useQueryClient(),
    navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const path = location.pathname,
    view = (location.search as Record<string, unknown>).view;
  const viewPage = path.startsWith("/app/views/")
    ? figmaPageByKey(path.split("/").at(-1) ?? "")
    : undefined;
  const [open, setOpen] = useState(false),
    [leaving, setLeaving] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [draft, setDraft] = useState(""),
    [chat, setChat] = useState<{
      key: string;
      question: string;
      answer?: string;
      count?: number;
      citations?: AskSource[];
      error?: string;
      streaming?: boolean;
    } | null>(null);
  const sidebar = useRef<HTMLElement>(null),
    menuButton = useRef<HTMLButtonElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const dockTabs = useRef<HTMLElement>(null);
  const askRequest = useRef<AbortController | null>(null);
  const composer = useRef<HTMLFormElement>(null);
  const answerPanel = useRef<HTMLElement>(null);
  const connections = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  const access = useCoachingWorkspaceAccess();
  const managerView = useWorkspaceView() === "manager";
  const unread = useQuery({
    queryKey: ["figma-notifications", user?.id, "unread-count"],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const active = viewPage
    ? ((
        {
          home: "home",
          rep: "people",
          people: "people",
          calls: "calls",
          insights: "insights",
          coaching: "coaching",
        } as Record<string, string>
      )[viewPage.group] ?? null)
    : path.replace(/\/$/, "") === "/app" || path === "/app/manager"
      ? view === "start"
        ? "start"
        : "home"
      : path === "/app/crm/calls"
        ? typeof view === "string"
          ? view
          : "calls"
        : (workspaceNavigation.find((item) => item.to === path)?.key ?? null);
  const dockActive =
    active === "home" || active === "insights"
      ? "intelligence"
      : active === "report" || active === "reports"
        ? "reports"
        : active === "notifications"
          ? "inbox"
          : active === "calls" || active === "status"
            ? "calls"
            : active === "settings" || active === "integrations" || active === "playbooks"
              ? "settings"
              : null;
  const routeSearch = location.search as Record<string, unknown>;
  const reportId = typeof routeSearch.reportId === "string" ? routeSearch.reportId : undefined;
  const callId = typeof routeSearch.callId === "string" ? routeSearch.callId : undefined;
  const questionScope: QuestionScope =
    callId && active === "calls"
      ? { kind: "call", id: callId }
      : reportId && dockActive === "reports"
        ? { kind: "report", id: reportId }
        : dockActive === "reports"
          ? { kind: "reports" }
          : dockActive === "calls"
            ? { kind: "calls" }
            : { kind: access.manager ? "workspace" : "personal" };
  const scopeName = dock.find((item) => item.key === dockActive)?.label ?? "Workspace";
  const history = useQuery(
    askHistoryQuery(
      currentOrgId ?? "",
      user?.id ?? "",
      questionScope,
      access.manager ? undefined : access.rep?.id,
    ),
  );
  const chatKey = `${currentOrgId}:${path}:${location.searchStr}`;
  const currentChat = chat?.key === chatKey ? chat : null;
  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
  }, [path, view, reportId, callId, currentOrgId]);
  useEffect(() => () => askRequest.current?.abort(), [chatKey]);
  useEffect(() => {
    const command = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", command);
    return () => window.removeEventListener("keydown", command);
  }, []);
  useEffect(() => {
    const tabs = dockTabs.current;
    if (!tabs) return;
    const update = () => {
      const activeTab = tabs.querySelector<HTMLElement>('[aria-current="page"]');
      tabs.style.setProperty("--dock-lens-opacity", activeTab ? "1" : "0");
      if (!activeTab) return;
      tabs.style.setProperty("--dock-lens-left", `${activeTab.offsetLeft}px`);
      tabs.style.setProperty("--dock-lens-top", `${activeTab.offsetTop}px`);
      tabs.style.setProperty("--dock-lens-width", `${activeTab.offsetWidth}px`);
      tabs.style.setProperty("--dock-lens-height", `${activeTab.offsetHeight}px`);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(tabs);
    return () => observer?.disconnect();
  }, [dockActive, unread.data]);
  const activeQuestion = currentChat?.question;
  useEffect(() => {
    if (!activeQuestion || !answerPanel.current) return;
    const animation = animatePage30Panel(answerPanel.current, composer.current);
    answerPanel.current.focus({ preventScroll: true });
    return () => animation?.cancel();
  }, [activeQuestion]);
  async function ask(question: string) {
    if (!currentOrgId || (!access.manager && !access.rep)) return;
    askRequest.current?.abort();
    const controller = new AbortController();
    askRequest.current = controller;
    setChat({ key: chatKey, question, streaming: true });
    setDraft("");
    try {
      const response = await askWorkspace(
        currentOrgId,
        question,
        questionScope,
        access.manager ? undefined : access.rep?.id,
        controller.signal,
        (answer) => {
          if (!controller.signal.aborted)
            setChat({ key: chatKey, question, answer, streaming: true });
        },
      );
      if (!controller.signal.aborted)
        setChat({
          key: chatKey,
          question,
          answer: response.answer,
          count: response.sources_searched,
          citations: response.citations,
        });
      await queryClient.invalidateQueries({
        queryKey: ["coaching-ask-history", currentOrgId, user?.id],
      });
    } catch (error) {
      if (!controller.signal.aborted)
        setChat({
          key: chatKey,
          question,
          error: error instanceof Error ? error.message : "Question could not be answered.",
        });
    }
  }
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab" && window.matchMedia("(max-width: 780px)").matches) {
        const items = [
          ...(sidebar.current?.querySelectorAll<HTMLElement>(
            "a[href],button:not([disabled]),summary",
          ) ?? []),
        ];
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    sidebar.current?.querySelector<HTMLElement>("a,button")?.focus();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  async function logout() {
    setLeaving(true);
    try {
      await signOut();
      guestStore.disable();
      clearLastAppPath();
      queryClient.clear();
      await navigate({ to: "/auth/sign-in", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
    } finally {
      setLeaving(false);
    }
  }
  const sourceLabel = connections.isError
    ? "Connection check failed"
    : connections.isPending
      ? "Checking sources…"
      : `${connections.data?.filter((i) => i.is_connected && ["readymode", "close_io", "hubspot", "salesforce", "gohighlevel", "google_calendar", "zoom", "gong", "aircall", "googlemeet"].includes(i.integration_key)).length ?? 0} sources connected`;
  return (
    <div className="bylda light revenue-workspace v1-workspace page30-workspace figma-surface flex h-dvh overflow-hidden bg-by-surface-canvas text-by-text-primary">
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4"
      >
        Skip to content
      </a>
      <nav
        aria-label="Workspace rail"
        className="page30-rail page30-glass flex shrink-0 flex-col items-center gap-3 py-3"
      >
        <Link
          to="/app"
          aria-label="Bylda home"
          className="mb-3 flex size-10 items-center justify-center"
        >
          <img
            src="/figma/workspace.png"
            alt=""
            width="38"
            height="38"
            className="rounded-[10px] object-contain"
          />
        </Link>
        <Link
          to="/app"
          search={{ view: "start" }}
          aria-label="Home"
          className={`flex size-[38px] items-center justify-center rounded-[10px] ${active === "home" ? "bg-by-surface-sidebar-active" : ""}`}
        >
          <img src="/figma/rail-home.svg" alt="" />
        </Link>
        <button
          type="button"
          aria-label="Open workspace search"
          className="flex size-[38px] items-center justify-center rounded-[10px]"
          onClick={() => setSearchOpen(true)}
        >
          <img src="/figma/rail-search.svg" alt="" />
        </button>
        <Link
          to="/app/notifications"
          aria-label="Open notifications"
          className="flex size-[38px] items-center justify-center rounded-[10px]"
        >
          <img src={unread.data ? "/figma/notifications.svg" : "/figma/bell.svg"} alt="" />
        </Link>
        <FigmaViewLink
          screen="ask-bylda"
          className="flex size-[38px] items-center justify-center rounded-[10px]"
        >
          <img src="/figma/rail-insights.svg" alt="" />
          <span className="sr-only">Ask Bylda</span>
        </FigmaViewLink>
        <Link
          to="/app/settings"
          aria-label="Settings"
          className="mt-auto flex size-[38px] items-center justify-center rounded-[10px]"
        >
          <img src="/figma/rail-settings.svg" alt="" />
        </Link>
        <Link
          to="/app/settings"
          search={{ tab: "profile" }}
          aria-label="My profile"
          title={profile?.full_name ?? user?.email ?? "My account"}
          className="page30-chip flex size-[34px] items-center justify-center"
        >
          {initials(profile?.full_name ?? user?.email ?? "B")}
        </Link>
      </nav>
      {open && (
        <button
          type="button"
          aria-label="Dismiss navigation"
          className="page30-sidebar-scrim fixed inset-0 z-30 bg-by-surface-scrim"
          onClick={() => {
            setOpen(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        inert={!open}
        aria-hidden={!open}
        aria-label="Workspace navigation"
        role={undefined}
        className="page30-drawer min-h-0 shrink-0"
        data-expanded={open}
      >
        <div className="page30-drawer-body">
          <div className="mb-3 flex items-center justify-between px-2">
            <Link to="/app" className="text-[15px] tracking-[-.15px]">
              BYLDA
            </Link>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => {
                setOpen(false);
                menuButton.current?.focus();
              }}
              className="p-1"
            >
              <X size={17} />
            </button>
          </div>
          <WorkspacePicker />
          {managerView && access.manager && (
            <div className="my-3 grid gap-2 text-xs">
              <Link to="/app/manager" onClick={() => setOpen(false)}>
                Manager home
              </Link>
              <Link to="/app/settings" search={{ tab: "teams" }} onClick={() => setOpen(false)}>
                My team · Add agents
              </Link>
            </div>
          )}
          <p className="mb-3 text-[10px] text-by-text-secondary">{sourceLabel}</p>
          <FigmaPageBrowser />
          <nav aria-label="Workspace" className="space-y-1">
            {behavioralNavigation
              .filter((item) => access.manager || !["people", "insights"].includes(item.key))
              .map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  search={"view" in item ? ({ view: item.view } as never) : undefined}
                  aria-current={active === item.key ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${active === item.key ? "bg-by-surface-sidebar-active font-medium" : "hover:bg-by-surface-sidebar-hover"}`}
                >
                  <img src={`/figma/${item.asset}.svg`} alt="" />
                  {item.label}
                </Link>
              ))}
          </nav>
          <section className="mt-6 space-y-1 text-xs" aria-label="Pinned views">
            <h2 className="px-3 py-2 text-[11px] uppercase text-by-text-secondary">Pinned views</h2>
            {["Needs review", "High coaching value", "Price objections"].map((label) => (
              <FigmaViewLink
                key={label}
                screen="calls-saved-views"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-by-text-secondary"
              >
                {label}
                <span>—</span>
              </FigmaViewLink>
            ))}
          </section>
          <section className="mt-5 text-xs" aria-label="Conversations">
            <h2 className="px-3 py-2 text-[11px] uppercase text-by-text-secondary">
              Conversations
            </h2>
            <FigmaViewLink screen="rooms" className="flex w-full px-3 py-2">
              Rooms and messages
            </FigmaViewLink>
          </section>
          <nav aria-label="Workspace configuration" className="mt-auto space-y-1 pt-8">
            <Link
              to="/app/crm/calls"
              search={{ view: "playbooks" }}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${view === "playbooks" && path === "/app/crm/calls" ? "bg-by-surface-sidebar-active" : ""}`}
            >
              <img src="/figma/nav-insights.svg" alt="" />
              Methodology
            </Link>
            <Link
              to="/app/integrations"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px]"
            >
              <img src="/figma/nav-integrations.svg" alt="" />
              Integrations
            </Link>
            <Link
              to="/app/settings"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px]"
            >
              <img src="/figma/nav-settings.svg" alt="" />
              Settings
            </Link>
            <button
              type="button"
              disabled={leaving}
              onClick={() => void logout()}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-by-text-secondary disabled:opacity-40"
            >
              <LogOut size={14} />
              {leaving ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        </div>
      </aside>
      <div className="page30-content flex min-w-0 flex-1 flex-col">
        <header className="page30-toolbar">
          <button
            ref={menuButton}
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2"
          >
            <Menu size={19} />
          </button>
          <Link to="/app" className="page30-toolbar-brand">
            BYLDA
          </Link>
          {currentOrg?.name && <span className="page30-workspace-name">{currentOrg.name}</span>}
          {!access.pending && !access.error && (
            <details className="page30-role-picker">
              <summary className="page30-chip page30-role">
                {access.manager ? "Manager view" : "Rep view"}{" "}
                <ChevronDown size={13} aria-hidden="true" />
              </summary>
              <div className="page30-dialog page30-role-menu">
                <WorkspacePicker />
              </div>
            </details>
          )}
          <button
            ref={searchButton}
            type="button"
            className="page30-glass page30-search"
            aria-label="Search workspace"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={16} aria-hidden="true" />
            <span>
              {access.manager
                ? "Search team calls, reps and reports…"
                : "Search my calls and reports…"}
            </span>
            <kbd className="page30-search-shortcut">⌘K</kbd>
          </button>
          <Link
            to="/app/crm/calls"
            search={{ view: "calls", upload: true }}
            className="figma-button page30-upload"
          >
            + Upload
          </Link>
        </header>
        <main ref={main} id="workspace-content" className="min-h-0 flex-1 overflow-y-auto">
          <div className="page30-view" hidden={!!currentChat}>
            {children}
          </div>
          {currentChat && (
            <section
              ref={answerPanel}
              tabIndex={-1}
              className="page30-context-answer"
              data-design-screen="contextual-chat"
            >
              <header className="page30-section-header">
                <div>
                  <p className="page30-label">Bylda / Contextual chat</p>
                  <h1>Ask about {scopeName.toLowerCase()}</h1>
                </div>
                <button
                  className="figma-button"
                  type="button"
                  onClick={() => {
                    askRequest.current?.abort();
                    setChat(null);
                  }}
                >
                  Back to {scopeName}
                </button>
              </header>
              <article className="page30-glass page30-report-card">
                <p className="page30-label">You asked</p>
                <h2>{currentChat.question}</h2>
                <p className="page30-label mt-5">Bylda</p>
                {currentChat.error ? (
                  <div role="alert">
                    <p>{currentChat.error}</p>
                    <button
                      className="figma-button mt-2"
                      onClick={() => void ask(currentChat.question)}
                    >
                      Try again
                    </button>
                  </div>
                ) : currentChat.answer !== undefined ? (
                  <div
                    aria-busy={currentChat.streaming}
                    aria-live={currentChat.streaming ? "off" : "polite"}
                  >
                    <p className="whitespace-pre-wrap">{currentChat.answer}</p>
                    {!!currentChat.citations?.length && (
                      <ul className="mt-4 space-y-3" aria-label="Answer evidence">
                        {currentChat.citations.map((source) => (
                          <li key={source.id} className="rounded-lg border p-3 text-sm">
                            <Link
                              to="/app/crm/calls"
                              search={{
                                view: "calls",
                                callId: source.call_id,
                                runId: source.run_id,
                                turnId: source.turn_id,
                                tab: "transcript",
                                ...(source.start_s !== null ? { at: source.start_s } : {}),
                              }}
                              className="underline"
                              onClick={() => setChat(null)}
                            >
                              [{source.id}] Open exact {source.speaker} turn
                            </Link>
                            <blockquote className="mt-1 text-by-text-secondary">
                              {source.text}
                            </blockquote>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!!currentChat.count && (
                      <p className="page30-muted mt-3">
                        {currentChat.count} saved {currentChat.count === 1 ? "source" : "sources"}{" "}
                        searched
                      </p>
                    )}
                  </div>
                ) : (
                  <p role="status" className="page30-pending">
                    Reading saved sources…
                  </p>
                )}
                {callId && (
                  <button
                    className="figma-button mt-3"
                    onClick={() => {
                      askRequest.current?.abort();
                      setChat(null);
                    }}
                  >
                    Open call evidence
                  </button>
                )}
                {reportId && !callId && (
                  <button
                    className="figma-button mt-3"
                    onClick={() => {
                      askRequest.current?.abort();
                      setChat(null);
                    }}
                  >
                    Open saved report
                  </button>
                )}
              </article>
            </section>
          )}
        </main>
        <footer className="page30-dock">
          <nav
            ref={dockTabs}
            aria-label="Intelligence workspace"
            className="page30-glass page30-dock-tabs"
          >
            <span className="page30-dock-lens" aria-hidden="true" />
            {dock.map(({ key, label, to }) => (
              <DockLink
                key={key}
                to={key === "settings" && access.manager ? "/app/integrations" : to}
                search={
                  key === "settings" ? { tab: access.manager ? "delivery" : "profile" } : undefined
                }
                current={dockActive === key}
                onClick={() => {
                  askRequest.current?.abort();
                  setChat(null);
                }}
              >
                <img src={`/figma/page30-${key}.svg`} alt="" />
                <span>
                  {label}
                  {key === "inbox" && unread.data ? ` (${unread.data})` : ""}
                </span>
              </DockLink>
            ))}
          </nav>
          <form
            ref={composer}
            className="page30-glass page30-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim().length >= 2) void ask(draft.trim());
            }}
          >
            <span className="page30-chip">
              <img src="/figma/page30-scope.svg" alt="" /> {scopeName}
            </span>
            <input
              value={draft}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Question for Bylda"
              placeholder={
                dockActive ? `Ask about ${scopeName.toLowerCase()}…` : "Ask about this workspace…"
              }
            />
            <button
              type="button"
              className="page30-history"
              onClick={() => setHistoryOpen(true)}
              aria-label="Previous questions"
            >
              History
            </button>
            <button
              type="submit"
              className="page30-composer-arrow"
              aria-label="Ask Bylda"
              disabled={
                draft.trim().length < 2 || access.pending || (!access.manager && !access.rep)
              }
            >
              <img src="/figma/page30-arrow.svg" alt="" />
            </button>
          </form>
        </footer>
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent
            className="page30-dialog max-h-[85dvh] max-w-2xl overflow-y-auto"
            aria-describedby={undefined}
          >
            <DialogTitle>Previous questions</DialogTitle>
            {history.isPending ? (
              <p role="status">Loading questions…</p>
            ) : history.error ? (
              <p role="alert">
                Questions could not load.{" "}
                <button className="underline" onClick={() => void history.refetch()}>
                  Retry
                </button>
              </p>
            ) : !history.data?.length ? (
              <p>No saved questions in this view yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.data.map((entry) => (
                  <li key={entry.id}>
                    <button
                      className="figma-button w-full text-left"
                      onClick={() => {
                        askRequest.current?.abort();
                        setChat({
                          key: chatKey,
                          question: entry.question,
                          answer: entry.answer,
                          citations: entry.citations,
                          count: entry.citations.length,
                        });
                        setHistoryOpen(false);
                      }}
                    >
                      {entry.question}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent
            className="page30-dialog max-h-[85dvh] max-w-2xl overflow-y-auto"
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              searchButton.current?.focus();
            }}
          >
            <DialogTitle className="sr-only">Search workspace</DialogTitle>
            <WorkspaceSearch key={currentOrgId} embedded />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
