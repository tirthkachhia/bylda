import { Link, useNavigate } from "@tanstack/react-router";
import {
  figmaEmptyPages,
  type FigmaEmptyPage,
  type FigmaPageGroup,
} from "@/lib/figma-page-catalog";
import { Inactive } from "./FigmaPrimitives";

const groupHome = {
  home: "/app",
  calls: "/app/crm/calls",
  people: "/app/people",
  insights: "/app/insights",
  coaching: "/app/coaching",
  conversations: "/app/views/rooms",
  reports: "/app/reports",
  rep: "/app/views/rep-home",
  setup: "/onboarding",
  search: "/app/views/search-results",
  integrations: "/app/integrations",
  notifications: "/app/notifications",
  methodology: "/app/crm/calls?view=playbooks",
} as const;

/** Navigation only: opening a design view never creates a backend object. */
export function FigmaViewLink({
  screen,
  children,
  className = "figma-button",
  current = false,
}: {
  screen: string;
  children: React.ReactNode;
  className?: string;
  current?: boolean;
}) {
  if (screen.startsWith("setup-"))
    return screen === "setup-workspace" ? (
      <Link to="/onboarding" className={className}>
        {children}
      </Link>
    ) : (
      <Link to="/setup/$step" params={{ step: screen.slice(6) }} className={className}>
        {children}
      </Link>
    );
  return (
    <Link
      to="/app/views/$screen"
      params={{ screen }}
      className={className}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export function FigmaPageBrowser() {
  const navigate = useNavigate();
  return (
    <label className="figma-browse-views">
      <span className="sr-only">Browse views</span>
      <select
        aria-label="Browse views"
        value=""
        onChange={(event) => {
          const screen = event.target.value;
          if (!screen) return;
          if (screen.startsWith("setup-"))
            void navigate({ to: "/setup/$step", params: { step: screen.slice(6) } });
          else void navigate({ to: "/app/views/$screen", params: { screen } });
        }}
      >
        <option value="">Browse views…</option>
        {[
          "home",
          "calls",
          "people",
          "insights",
          "coaching",
          "conversations",
          "reports",
          "rep",
          "search",
          "integrations",
          "notifications",
          "methodology",
        ].map((group) => (
          <optgroup key={group} label={group[0].toUpperCase() + group.slice(1)}>
            {figmaEmptyPages
              .filter((p) => p.group === group)
              .map((p) => (
                <option key={p.key} value={p.key}>
                  {viewLabel(p)}
                </option>
              ))}
          </optgroup>
        ))}
        <optgroup label="Panels & forms">
          {[
            ["assign-coaching", "Assign coaching"],
            ["new-room", "Create a room"],
            ["command-search", "Search"],
            ["ask-bylda", "Ask Bylda"],
            ["notification-drawer", "Notifications drawer"],
          ].map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </optgroup>
        <optgroup label="Workspace setup">
          {["methodology", "connect", "invite", "analysis", "insight"].map((key) => (
            <option key={key} value={`setup-${key}`}>
              {key[0].toUpperCase() + key.slice(1)}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

export function FigmaViewNav({
  items,
  selected,
  label = "Page views",
}: {
  items: readonly (readonly [string, string])[];
  selected?: string;
  label?: string;
}) {
  return (
    <nav className="figma-tabs" aria-label={label}>
      {items.map(([key, title]) => (
        <FigmaViewLink key={key} screen={key} className="" current={selected === key}>
          {title}
        </FigmaViewLink>
      ))}
    </nav>
  );
}

export function FigmaViewPicker({
  group,
  selected = "",
}: {
  group: FigmaPageGroup;
  selected?: string;
}) {
  const navigate = useNavigate();
  return (
    <label className="figma-view-picker">
      <span>View</span>
      <select
        aria-label="Page view"
        value={selected}
        onChange={(event) => {
          if (event.target.value)
            void navigate({ to: "/app/views/$screen", params: { screen: event.target.value } });
        }}
      >
        <option value="">Choose a view</option>
        {figmaEmptyPages
          .filter((p) => p.group === group)
          .map((p) => (
            <option key={p.key} value={p.key}>
              {viewLabel(p)}
            </option>
          ))}
      </select>
    </label>
  );
}

function viewLabel(page: FigmaEmptyPage) {
  return `${page.title}${page.subtitle && !page.subtitle.startsWith("Day 0") ? ` · ${safeSubtitle(page)}` : ""}`;
}
function safeSubtitle(page: FigmaEmptyPage) {
  const overrides: Record<string, string> = {
    "call-review": "Review",
    "rep-profile-manager": "Manager view",
    "behavior-change-result": "Result",
    "coaching-detail-active": "Active focus",
    "rep-coaching": "Rep view",
    "weekly-rep-report": "Rep report",
    "team-report": "Selected period",
    "team-detail": "Overview",
    "team-room": "Team room",
    "deal-room": "Deal room",
    "direct-message": "Conversation",
    "room-conversation": "Conversation",
    "room-daily-brief": "Daily brief",
    "room-coaching": "Coaching",
    "room-insights": "Insights",
    "room-calls": "Calls",
    "room-reports": "Reports",
    "room-files": "Files",
    "room-about": "About",
  };
  return overrides[page.key] ?? (page.subtitle.startsWith("Day 0") ? "" : page.subtitle);
}

export function FigmaSetupChecklist() {
  return (
    <aside className="figma-setup-checklist">
      <h2>Get started</h2>
      <p>Set up your workspace</p>
      {[
        ["Connect your calls", "Link a supported recorder or dialer.", "/app/integrations"],
        ["Invite your team", "Add your teammates to your workspace.", "/app/settings?tab=users"],
        [
          "Teach Bylda how you sell",
          "Describe your sales process and what good looks like.",
          "/app/crm/calls?view=playbooks",
        ],
      ].map(([title, detail, href], i) => (
        <a key={title} href={href} className={i === 0 ? "is-first" : ""}>
          <span>{i + 1}</span>
          <div>
            <strong>{title}</strong>
            <p>{detail}</p>
          </div>
        </a>
      ))}
    </aside>
  );
}

/** The shared Day 0 card/skeleton in the linked Figma. No API or inferred metrics. */
export function FigmaEmptyView({
  page,
  navigation = true,
}: {
  page: FigmaEmptyPage;
  navigation?: boolean;
}) {
  const siblings: Record<string, readonly (readonly [string, string])[]> = {
    insights: [
      ["intelligence-overview", "Overview"],
      ["emerging-patterns", "Emerging patterns"],
      ["objections", "Objections"],
      ["team-behaviors", "Team behaviors"],
      ["outcome-patterns", "Outcomes"],
      ["rep-patterns", "Rep patterns"],
      ["prospect-patterns", "Prospect patterns"],
      ["behavior-outcome", "Behavior × outcome"],
    ],
    conversations: [
      ["rooms", "Directory"],
      ["room-conversation", "Conversation"],
      ["room-insights", "Insights"],
      ["room-calls", "Calls"],
      ["room-reports", "Reports"],
      ["room-files", "Files"],
      ["room-about", "About"],
    ],
    coaching: [
      ["coaching-active", "Active"],
      ["coaching-follow-up", "Needs follow-up"],
      ["coaching-completed", "Completed"],
      ["coaching-overview", "Overview"],
      ["coaching-evidence", "Evidence"],
      ["coaching-progress", "Progress"],
      ["coaching-discussion", "Discussion"],
      ["behavior-change-result", "Result"],
    ],
    reports: [
      ["daily-manager-brief", "Daily brief"],
      ["weekly-manager-report", "Weekly manager"],
      ["sales-behavior-report", "Sales behavior"],
      ["weekly-rep-report", "Rep report"],
      ["team-report", "Team report"],
      ["behavior-report", "Behavior report"],
    ],
    people: [
      ["team-overview", "Teams"],
      ["rep-comparison", "Compare reps"],
      ["rep-profile-overview", "Rep overview"],
      ["rep-profile-calls", "Rep calls"],
      ["rep-profile-trends", "Rep trends"],
      ["team-detail", "Team overview"],
      ["team-reps", "Team reps"],
      ["team-detail-behaviors", "Team behaviors"],
      ["team-calls", "Team calls"],
      ["team-settings", "Team settings"],
    ],
    home: [
      ["manager-feed", "Feed"],
      ["manager-team-updates", "Team updates"],
      ["manager-calls", "Calls"],
      ["manager-coaching", "Coaching"],
      ["manager-reports", "Reports"],
      ["manager-mentions", "Mentions"],
      ["workspace-health", "Workspace health"],
    ],
    rep: [
      ["rep-home", "Daily brief"],
      ["my-progress", "My progress"],
      ["rep-coaching", "Coaching"],
      ["rep-call-review", "Call review"],
    ],
    calls: [
      ["calls-saved-views", "Saved views"],
      ["calls-filters", "All calls"],
      ["call-overview", "Overview"],
      ["call-analysis", "Analysis"],
      ["call-coaching", "Coaching"],
    ],
  };
  return (
    <div
      className={`figma-surface figma-day-zero ${page.contextPanel ? "has-context" : ""}`}
      data-figma-frame={page.id}
      data-figma-day0={page.day0Id}
      data-design-screen={page.key}
    >
      <section className="figma-panel">
        <header className="figma-page-heading">
          <div>
            <h1>{page.title}</h1>
            {safeSubtitle(page) && <p>{safeSubtitle(page)}</p>}
          </div>
          {navigation && <FigmaViewPicker group={page.group} selected={page.key} />}
        </header>
        {navigation && siblings[page.group] && (
          <FigmaViewNav items={siblings[page.group]} selected={page.key} />
        )}
        <div className="figma-day-zero-card" data-unavailable="true" data-node-id={page.bodyNode}>
          <img src="/figma/empty-state.svg" alt="" />
          <h2>{page.emptyTitle}</h2>
          <p>{page.description}</p>
          {page.primaryLabel === "Connect calls" ? (
            <Link className="figma-button figma-button-primary" to="/app/integrations">
              Connect calls
            </Link>
          ) : page.primaryLabel === "Invite your team" ? (
            <Link
              className="figma-button figma-button-primary"
              to="/app/settings"
              search={{ tab: "users" }}
            >
              Invite your team
            </Link>
          ) : page.primaryLabel === "Build your playbook" ? (
            <Link
              className="figma-button figma-button-primary"
              to="/app/crm/calls"
              search={{ view: "playbooks" }}
            >
              Build your playbook
            </Link>
          ) : page.primaryLabel === "Finish setup" ? (
            <Link className="figma-button figma-button-primary" to="/onboarding">
              Finish setup
            </Link>
          ) : page.primaryLabel === "Notification settings" ? (
            <Link className="figma-button" to="/app/settings" search={{ tab: "notifications" }}>
              Notification settings
            </Link>
          ) : page.primaryLabel === "Create a room" ? (
            <FigmaViewLink screen="new-room" className="figma-button figma-button-primary">
              Create a room
            </FigmaViewLink>
          ) : (
            <Inactive>{page.primaryLabel}</Inactive>
          )}
        </div>
        <p className="figma-view-status">
          This view is not connected yet. Actions and data that are not available stay inactive.
        </p>
        <p className="figma-preview-label">What will appear here</p>
        <div
          className="figma-day-zero-preview"
          aria-label="Empty layout preview"
          data-unavailable="true"
        >
          {[200, 240, 280].map((width) => (
            <div key={width}>
              <img src="/figma/empty-avatar.svg" alt="" />
              <span style={{ width }} />
            </div>
          ))}
        </div>
        {navigation && (
          <div className="figma-page-return">
            <a href={groupHome[page.group]} className="figma-button">
              Back to {page.group === "conversations" ? "rooms" : page.group}
            </a>
            {page.group === "coaching" && (
              <FigmaViewLink screen="assign-coaching">Assign coaching</FigmaViewLink>
            )}
          </div>
        )}
      </section>
      {page.contextPanel && <FigmaSetupChecklist />}
    </div>
  );
}
