import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Avatar, AppBadge, Button, Wordmark } from "@/components/bylda";
import { useSearch, useMyCalls, useViewer } from "@/lib/data";
import { LocalRepOnly, LocalBoundary, LocalMobileFrame, LocalLabel } from "./LocalMobile";
export function B9MobileAskByldaBYLDACoach() {
  return (
    <LocalMobileFrame coach>
      <LocalRepOnly>
        <LocalAsk />
      </LocalRepOnly>
    </LocalMobileFrame>
  );
}
function LocalAsk() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const search = useSearch(query);
  const calls = useMyCalls();
  const viewer = useViewer().data;
  const run = (value: string) => {
    if (value.trim()) {
      setQuery(value.trim());
      setDraft("");
    }
  };
  return (
    <>
      <header className="flex flex-col gap-1 border-b border-by-border-engraved bg-by-surface-raised px-[18px] py-3">
        <Wordmark className="text-by-text-tertiary" />
        <div className="flex items-center gap-2">
          <Link to="/m/brief" search={true} aria-label="Back to brief">
            ‹
          </Link>
          <div>
            <h1 className="type-ui-title">BYLDA Coach</h1>
            <p className="type-ui-small text-by-text-tertiary">Answers link to your calls</p>
          </div>
        </div>
      </header>
      <section className="flex flex-1 flex-col gap-4 px-4 py-3.5 pb-28">
        {query && (
          <div className="flex items-start gap-2.5">
            <Avatar name={viewer?.name ?? "You"} size={28} />
            <div className="flex flex-col gap-1">
              <p className="type-ui-body-strong">You</p>
              <p className="type-ui-body break-words">{query}</p>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-by-control bg-by-surface-rail font-cinzel text-by-text-on-dark">
            B
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <p className="type-ui-body-strong">BYLDA Coach</p>
              <AppBadge />
            </div>
            {!query ? (
              <p className="type-ui-body">
                Find evidence in your calls. Ask a question or search an account.
              </p>
            ) : (
              <LocalBoundary query={calls} emptyTitle="No calls to search.">
                {(own) => (
                  <LocalBoundary
                    query={search}
                    emptyTitle="No matching calls. Try another question."
                  >
                    {(response) => (
                      <>
                        <p className="type-ui-small text-by-text-secondary">
                          These are matching calls. A coaching answer isn’t available yet.
                        </p>
                        <div aria-label="Search filters" className="flex flex-col gap-2">
                          {response.filters.map((filter, index) => (
                            <label
                              key={`${index}-${filter.field}`}
                              className="type-ui-small flex flex-col gap-1 text-by-text-secondary"
                            >
                              <span className="sr-only">{filter.field}</span>
                              <input
                                aria-label={`Edit ${filter.field} filter`}
                                defaultValue={filter.label}
                                key={query + index}
                                className="type-ui-small w-full rounded-by-control border border-by-border-control bg-by-surface-raised px-2.5 py-1.5 text-by-text-primary"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") run(e.currentTarget.value);
                                }}
                                onBlur={(e) => {
                                  if (
                                    e.currentTarget.value !== filter.label &&
                                    e.currentTarget.value.trim()
                                  )
                                    run(e.currentTarget.value);
                                }}
                              />
                            </label>
                          ))}
                        </div>
                        {response.results
                          .filter((r) =>
                            own.some((c) => c.id === r.callId && c.repId === viewer?.id),
                          )
                          .map((r) => (
                            <Link
                              key={r.callId}
                              to="/m/calls/$callId"
                              params={{ callId: r.callId }}
                              search={true}
                              className="flex flex-col gap-1 rounded-by-control border border-by-border-engraved bg-by-surface-inset px-3.5 py-3"
                            >
                              <p className="type-ui-body-strong">{r.title}</p>
                              <p className="type-ui-small">{r.snippet}</p>
                              {r.timestamp && <LocalLabel>{r.timestamp}</LocalLabel>}
                            </Link>
                          ))}
                        {!response.results.some((r) =>
                          own.some((c) => c.id === r.callId && c.repId === viewer?.id),
                        ) && <p className="type-ui-small">No matching calls of your own.</p>}
                      </>
                    )}
                  </LocalBoundary>
                )}
              </LocalBoundary>
            )}
          </div>
        </div>
        <LocalLabel>TRY</LocalLabel>
        <div className="flex flex-wrap gap-1.5">
          {["Show my pricing calls", "Find an account"].map((q) => (
            <Button key={q} variant="secondary" size="sm" onClick={() => run(q)}>
              {q}
            </Button>
          ))}
        </div>
      </section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(draft);
        }}
        className="fixed bottom-0 left-1/2 flex w-full max-w-[390px] -translate-x-1/2 items-center gap-2.5 rounded-b-[28px] border-t border-by-border-engraved bg-by-surface-raised px-3.5 pb-7 pt-3"
      >
        <input
          aria-label="Message"
          placeholder="Message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="type-ui-small min-w-0 flex-1 rounded-by-control border border-by-border-engraved bg-by-surface-inset px-3 py-2"
        />
        <Button type="submit" variant="ghost" disabled={!draft.trim()} aria-label="Send question">
          Send
        </Button>
      </form>
    </>
  );
}
