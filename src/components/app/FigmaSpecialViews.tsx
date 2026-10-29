import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FigmaField, FigmaRow, Inactive } from "./FigmaPrimitives";
import { FigmaEmptyView, FigmaViewLink } from "./FigmaPageViews";
import { figmaPageByKey } from "@/lib/figma-page-catalog";
import { FigmaNotifications } from "./FigmaNotifications";
import { figmaSpecialScreens } from "@/lib/figma-screen-manifest";

export function FigmaSpecialView({ screen }: { screen: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");
  if (!figmaSpecialScreens.some((key) => key === screen))
    return (
      <section className="figma-panel">
        <h1>View unavailable</h1>
        <p className="my-4">This page could not be found.</p>
        <Link to="/app" className="figma-button">
          Back to Home
        </Link>
      </section>
    );
  const room = screen === "new-room",
    assignment = screen === "assign-coaching",
    notifications = screen === "notification-drawer",
    ask = screen === "ask-bylda";
  const title = room
    ? "Create a room"
    : assignment
      ? "Assign coaching"
      : notifications
        ? "Notifications"
        : ask
          ? "Ask Bylda"
          : "Search";
  const back = room ? "rooms" : assignment ? "coaching-active" : "manager-feed";
  function close() {
    setOpen(false);
    void navigate({ to: "/app/views/$screen", params: { screen: back } });
  }
  return (
    <>
      <FigmaEmptyView page={figmaPageByKey(back)!} navigation={false} />
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          className={`figma-surface figma-design-dialog ${ask || notifications ? "figma-design-drawer" : ""} ${screen === "command-search" ? "figma-command-dialog" : ""}`}
          data-design-screen={screen}
        >
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {notifications
              ? "Your account notifications."
              : "This view is not connected yet. Nothing entered here is saved or sent."}
          </DialogDescription>
          {assignment ? (
            <>
              <FigmaField label="Rep">
                <select disabled>
                  <option>Select a rep</option>
                </select>
              </FigmaField>
              <div className="figma-form-card">
                <h2>Behavior focus · suggested by Bylda</h2>
                <p>—</p>
                <Inactive>Change</Inactive>
              </div>
              <h2>Evidence attached</h2>
              <div className="figma-form-card">No evidence attached.</div>
              <Inactive>+ Add another clip</Inactive>
              <FigmaField label="Your note to the rep">
                <textarea disabled rows={3} placeholder="Coaching notes are not available yet" />
              </FigmaField>
              <div className="figma-form-card">
                <h2>How Bylda will measure this</h2>
                {["Metric", "Baseline", "Target", "Judged after", "Also watching"].map((t) => (
                  <FigmaRow key={t} label={t}>
                    <span>—</span>
                  </FigmaRow>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FigmaField label="Check-in">
                  <input disabled placeholder="—" />
                </FigmaField>
                <FigmaField label="Also post to">
                  <input disabled placeholder="—" />
                </FigmaField>
              </div>
              <footer>
                <button className="figma-button" onClick={close}>
                  Cancel
                </button>
                <Inactive>Assign focus</Inactive>
              </footer>
            </>
          ) : room ? (
            <>
              <FigmaField label="Type">
                <div className="flex flex-wrap gap-2">
                  {[
                    "Team room",
                    "Deal room",
                    "Topic / watch room",
                    "Coaching (private)",
                    "Announcements",
                  ].map((t) => (
                    <Inactive key={t}>{t}</Inactive>
                  ))}
                </div>
              </FigmaField>
              <FigmaField label="Name">
                <input disabled placeholder="# room-name" />
              </FigmaField>
              <FigmaField label="Description">
                <input disabled placeholder="What this room is for" />
              </FigmaField>
              <h2>What should Bylda post here?</h2>
              {[
                "Daily brief for these members",
                "New patterns & regressions",
                "Strong / weak call examples",
                "Coaching assigned & results",
                "Friday digest",
              ].map((t) => (
                <FigmaRow key={t} label={t}>
                  <input type="checkbox" disabled aria-label={t} />
                </FigmaRow>
              ))}
              <FigmaField label="Members">
                <input disabled placeholder="Select members" />
              </FigmaField>
              <FigmaRow label="Also mirror to Slack">
                <input type="checkbox" disabled aria-label="Also mirror to Slack" />
              </FigmaRow>
              <footer>
                <button className="figma-button" onClick={close}>
                  Cancel
                </button>
                <Inactive>Create room</Inactive>
              </footer>
            </>
          ) : notifications ? (
            <FigmaNotifications variant="drawer" />
          ) : ask ? (
            <>
              <p>Answers from calls and evidence will appear here.</p>
              <div className="figma-answer-empty">No answer available yet.</div>
              <h2>Try</h2>
              {[
                "Who needs coaching this week?",
                "Compare reps on discovery",
                "What changed after coaching?",
              ].map((t) => (
                <Inactive key={t}>{t}</Inactive>
              ))}
              <div className="mt-auto">
                <FigmaField label="Ask about calls, reps, behaviors…">
                  <textarea disabled rows={2} placeholder="Ask Bylda is not available yet" />
                </FigmaField>
                <Inactive>Ask</Inactive>
              </div>
            </>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void navigate({
                    to: "/app/crm/calls",
                    search: { view: "calls", q: search } as never,
                  });
                }}
              >
                <label className="sr-only" htmlFor="command-query">
                  Search calls
                </label>
                <input
                  id="command-query"
                  className="figma-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search calls…"
                  autoFocus
                />
                <button type="submit" className="figma-button mt-3">
                  Search calls
                </button>
              </form>
              <h2>Ask Bylda</h2>
              <Inactive>Ask about your team</Inactive>
              <h2>People</h2>
              <Link to="/app/people">Browse people →</Link>
              <h2>Behaviors & patterns</h2>
              <FigmaViewLink screen="emerging-patterns">View patterns →</FigmaViewLink>
              <h2>Calls</h2>
              <Link to="/app/crm/calls">Browse calls →</Link>
              <h2>Actions</h2>
              <FigmaViewLink screen="assign-coaching">Open coaching form →</FigmaViewLink>
              <FigmaViewLink screen="search-results">Natural-language results →</FigmaViewLink>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
