import { useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button, cn, DataBoundary, StateEmpty, StateError } from "@/components/bylda";
import { useCalls, usePaletteItems, useSearch, useViewer, type Viewer } from "@/lib/data";
import { LocalField, LocalSettingsNote } from "@/components/lanes/lane-5/settings/LocalSettings";
import { safePaletteItems, verifiedSearchCalls, visibleFilters } from "./searchModel";
const retryError = (retry: () => unknown) => (
  <StateError body="This search is unavailable. Try again." onRetry={() => void retry()} />
);
export function LocalSearchGate({ children }: { children: (viewer: Viewer) => ReactNode }) {
  const q = useViewer();
  return (
    <DataBoundary query={q} error={() => retryError(q.refetch)}>
      {children}
    </DataBoundary>
  );
}
export function LocalPalette({ viewer, onClose }: { viewer: Viewer; onClose: () => void }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("all");
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const q = usePaletteItems(text);
  const calls = useCalls(viewer.role === "rep" ? { repId: viewer.id } : {});
  const rows = safePaletteItems(
    q.error || q.isLoading || calls.error || calls.isLoading ? [] : (q.data ?? []),
    calls.data ?? [],
    viewer,
  ).filter((i) => kind === "all" || i.kind === kind);
  return (
    <div
      ref={root}
      className="text-by-text-primary"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setSelected((i) =>
            rows.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length : 0,
          );
        }
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          root.current
            ?.querySelector<HTMLAnchorElement>(
              `[data-palette-index="${Math.min(selected, rows.length - 1)}"]`,
            )
            ?.click();
        }
        if (e.key === "Tab") {
          const nodes = Array.from(
            root.current?.querySelectorAll<HTMLElement>("input,button,a[href],select") ?? [],
          ).filter((n) => !n.hasAttribute("disabled"));
          const index = nodes.indexOf(document.activeElement as HTMLElement);
          if (e.shiftKey && index <= 0) {
            e.preventDefault();
            nodes.at(-1)?.focus();
          } else if (!e.shiftKey && index === nodes.length - 1) {
            e.preventDefault();
            nodes[0]?.focus();
          }
        }
      }}
    >
      <div className="flex items-center gap-3 border-b border-by-border-engraved p-4">
        <div className="flex-1">
          <LocalField
            label="Search calls, people and behaviors"
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSelected(0);
            }}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="flex gap-2 px-4 py-2" aria-label="Filter by type">
        {(viewer.role === "rep" ? ["all", "call"] : ["all", "call", "person", "behavior"]).map(
          (k) => (
            <Button
              key={k}
              variant={kind === k ? "primary" : "ghost"}
              size="sm"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setSelected(0);
              }}
            >
              {k === "all"
                ? "All"
                : k === "person"
                  ? "People"
                  : k === "call"
                    ? "Calls"
                    : "Behaviors"}
            </Button>
          ),
        )}
      </div>
      <div className="max-h-96 overflow-auto px-3 pb-3">
        <DataBoundary query={calls} error={() => retryError(calls.refetch)}>
          {() => (
            <DataBoundary query={q} error={() => retryError(q.refetch)}>
              {() =>
                rows.length ? (
                  rows.map((item, i) => (
                    <Link
                      key={item.id}
                      search={true}
                      to={item.href}
                      data-palette-index={i}
                      onClick={onClose}
                      onFocus={() => setSelected(i)}
                      className={cn(
                        "flex items-center gap-4 rounded-by-control px-3 py-3 focus:outline-none focus:ring-2 focus:ring-by-focus-ring",
                        i === Math.min(selected, rows.length - 1) && "bg-by-surface-inset",
                      )}
                    >
                      <span className="type-mono-micro w-16 text-by-text-tertiary">
                        {item.kind.toUpperCase()}
                      </span>
                      <span className="type-ui-body">{item.label}</span>
                    </Link>
                  ))
                ) : (
                  <StateEmpty title="No accessible navigation results." />
                )
              }
            </DataBoundary>
          )}
        </DataBoundary>
      </div>
      <div className="type-mono-micro border-t border-by-border-engraved px-4 py-3 text-by-text-tertiary">
        ↑ ↓ navigate · Enter open · Esc close · Tab move between controls
      </div>
    </div>
  );
}
export function LocalSearchScreen({
  viewer,
  compact = false,
}: {
  viewer: Viewer;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [days, setDays] = useState("30");
  const [submitted, setSubmitted] = useState({ query: "", days: 30 });
  const form = useRef<HTMLFormElement>(null);
  const q = useSearch(submitted.query, submitted.days);
  const calls = useCalls(viewer.role === "rep" ? { repId: viewer.id } : {});
  const validDays = Number.isSafeInteger(Number(days)) && Number(days) > 0;
  const edit = () => form.current?.querySelector<HTMLInputElement>("input")?.focus();
  const controls = (
    <form
      ref={form}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim() && validDays) setSubmitted({ query: draft.trim(), days: Number(days) });
      }}
    >
      <LocalField
        label={compact ? "Ask about your calls" : "Search question"}
        value={draft}
        placeholder="Search by account, rep or outcome…"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <LocalField
            label="Window in days"
            type="number"
            min="1"
            step="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!draft.trim() || !validDays || q.isLoading}>
          Search
        </Button>
      </div>
      {!validDays && (
        <p role="alert" className="type-ui-small">
          Enter a positive whole number of days.
        </p>
      )}
    </form>
  );
  const results = !submitted.query ? (
    <StateEmpty
      title="Ask a question to find calls."
      body="Every available result opens an accessible call."
    />
  ) : (
    <DataBoundary query={{ ...q, isEmpty: false }} error={() => retryError(q.refetch)}>
      {(response) =>
        response.query !== submitted.query || response.windowDays !== submitted.days ? (
          <StateEmpty title="Search response does not match this question." />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-mono-micro text-by-text-tertiary">BYLDA READ THIS AS</span>
              {visibleFilters(response, viewer).map((f, i) => (
                <Button
                  key={i}
                  variant="secondary"
                  size="sm"
                  onClick={edit}
                  aria-label={`Edit question for ${f.field} filter`}
                >
                  {f.field === "rep" && viewer.role === "rep"
                    ? "Rep: Me"
                    : `${f.field}: ${f.label}`}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={edit}>
                Edit question
              </Button>
            </div>
            {!compact && (
              <LocalSettingsNote title="Evidence coverage">
                Only call metadata can be verified here. Searches involving objections, behaviors,
                stages or dates cannot be verified and show no results. Behavioral answers are
                unavailable. Results use loaded call dates; coverage and relevance are unconfirmed.
              </LocalSettingsNote>
            )}
            <DataBoundary query={calls} error={() => retryError(calls.refetch)}>
              {(loaded) => {
                const rows = verifiedSearchCalls(response, loaded, viewer);
                return (
                  <section
                    className="overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised"
                    aria-label="Search results"
                  >
                    <h2 className="type-ui-label border-b border-by-border-engraved p-4">
                      {rows.length} ACCESSIBLE CALLS LOADED
                    </h2>
                    {rows.length ? (
                      rows.map((call) => (
                        <Link
                          key={call.id}
                          search={true}
                          to="/app/calls/$callId"
                          params={{ callId: call.id }}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-by-border-engraved px-4 py-4 last:border-0 hover:bg-by-surface-hover focus:outline-none focus:ring-2 focus:ring-by-focus-ring"
                        >
                          <div>
                            <p className="type-ui-body-strong">{call.account.name}</p>
                            <p className="type-mono-micro text-by-text-tertiary">
                              {new Date(call.startedAt).toLocaleDateString()} · {call.type}
                            </p>
                          </div>
                          <span className="type-ui-small text-by-text-secondary">
                            {viewer.role === "rep" ? "My call" : call.repName}
                          </span>
                          <span className="type-ui-small">Open call →</span>
                        </Link>
                      ))
                    ) : (
                      <StateEmpty
                        title="No verified calls for these filters."
                        body="Edit your question or window to search again."
                      />
                    )}
                  </section>
                );
              }}
            </DataBoundary>
          </div>
        )
      }
    </DataBoundary>
  );
  const note = (
    <LocalSettingsNote title="How this works">
      Edit your question to rerun filters. Saving views and watching patterns are unavailable. Ask
      can find calls; answers, sharing and coaching suggestions are unavailable.
    </LocalSettingsNote>
  );
  return compact ? (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {note}
      <div className="flex-1">{results}</div>
      <div className="flex flex-wrap gap-2">
        <span className="type-ui-label w-full text-by-text-tertiary">TRY AN ACCOUNT</span>
        {Array.from(
          new Set(
            (calls.error || calls.isLoading ? [] : (calls.data ?? []))
              .filter((c) => viewer.role !== "rep" || c.repId === viewer.id)
              .map((c) => c.account.name),
          ),
        )
          .slice(0, 3)
          .map((name) => (
            <Button
              key={name}
              variant="secondary"
              size="sm"
              onClick={() => {
                setDraft(name);
                edit();
              }}
            >
              {name}
            </Button>
          ))}
      </div>
      {controls}
    </div>
  ) : (
    <div className="flex min-h-full max-lg:flex-col">
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-9">
        {controls}
        {results}
      </main>
      <aside className="flex w-by-context shrink-0 flex-col gap-5 rounded-by-card border-l border-by-border-engraved bg-by-surface-raised p-6 max-lg:w-full">
        <h2 className="type-ui-label">REFINE</h2>
        <Button variant="secondary" onClick={edit}>
          Edit question and window
        </Button>
        <h2 className="type-ui-label">SAVE</h2>
        <Button variant="secondary" disabled>
          Save as view in Calls
        </Button>
        <Button variant="ghost" disabled>
          Turn into pattern watch
        </Button>
        {note}
      </aside>
    </div>
  );
}
