import { Link, useNavigate } from "@tanstack/react-router";
import {
  figmaEmptyPages,
  type FigmaEmptyPage,
  type FigmaPageGroup,
} from "@/lib/figma-page-catalog";

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
