import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, cn, StateError, StateLoading, Tag } from "@/components/bylda";
import {
  useConnectSource,
  useDataSources,
  useOnboarding,
  useRetentionPolicy,
  type DataSource,
} from "@/lib/data";
import { errorMessage } from "./authForm";
import {
  FieldLabel,
  InsetNote,
  OnboardingLayout,
  StepActions,
  StepHeader,
} from "./OnboardingLayout";

/**
 * A8 · Onboarding — Connect calls (integration states)
 * Figma 15:302 (page 1:5) · Lane 4 — Dravin · route /welcome/connect · Flow 4
 *
 * The catalog below is product copy (what Bylda can connect to). Every status, count and
 * error comes from `useDataSources`; a source it doesn't return is "Not connected".
 * Bylda never writes to the CRM in V1.
 */

type Group = "calls" | "outcomes";
type Entry = {
  key: string;
  name: string;
  description: string;
  group: Group;
  /** Not an OAuth source — a file upload / import. */
  file?: { label: string; note: string; to?: "/app/calls/upload" };
};

const CATALOG: Entry[] = [
  { key: "zoom", name: "Zoom", description: "Meeting recorder", group: "calls" },
  { key: "gong", name: "Gong", description: "Recorder + transcripts", group: "calls" },
  { key: "aircall", name: "Aircall", description: "Dialer", group: "calls" },
  { key: "google_meet", name: "Google Meet", description: "Meeting recorder", group: "calls" },
  {
    key: "upload",
    name: "Upload files",
    description: "mp3, m4a, wav, mp4, vtt, txt",
    group: "calls",
    file: { label: "Upload", note: "Up to 2 GB per file", to: "/app/calls/upload" },
  },
  { key: "hubspot", name: "HubSpot", description: "CRM", group: "outcomes" },
  { key: "salesforce", name: "Salesforce", description: "CRM", group: "outcomes" },
  {
    key: "csv",
    name: "CSV",
    description: "Deal outcomes import",
    group: "outcomes",
    file: { label: "Import", note: "For teams without a CRM" },
  },
];

const DESCRIPTION: Record<DataSource["category"], string> = {
  recorder: "Recorder",
  dialer: "Dialer",
  meetings: "Meeting recorder",
  crm: "CRM",
};

/** Catalog + anything else the workspace already has connected. */
function entries(sources: DataSource[]): Entry[] {
  const extra = sources
    .filter((s) => !CATALOG.some((c) => c.key === s.key))
    .map<Entry>((s) => ({
      key: s.key,
      name: s.name,
      description: DESCRIPTION[s.category],
      group: s.category === "crm" ? "outcomes" : "calls",
    }));
  return [...CATALOG, ...extra];
}

export function A8OnboardingConnectCalls() {
  const navigate = useNavigate();
  const sources = useDataSources();
  const onboarding = useOnboarding();
  const retention = useRetentionPolicy();
  const connect = useConnectSource();
  /** Started in this session; the source list hasn't caught up yet. */
  const [pending, setPending] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const list = sources.data ?? [];
  const byKey = new Map(list.map((s) => [s.key, s]));
  // A source the onboarding record says is connected counts even before the list syncs.
  const connectedKeys = new Set([
    ...list.filter((s) => s.status === "connected").map((s) => s.key),
    ...(onboarding.data?.connectedSources ?? []),
  ]);
  const hasCallSource = entries(list).some(
    (e) => e.group === "calls" && !e.file && connectedKeys.has(e.key),
  );

  async function onConnect(e: Entry) {
    setNote(null);
    setPending((cur) => [...cur, e.key]);
    try {
      const res = (await connect.mutateAsync(e.key)) as { url?: string | null } | undefined;
      if (res?.url) window.location.assign(res.url);
    } catch (err) {
      setPending((cur) => cur.filter((k) => k !== e.key));
      setNote(`${e.name}: ${errorMessage(err)}`);
    }
  }

  const cancel = (key: string) => setPending((cur) => cur.filter((k) => k !== key));

  function row(e: Entry) {
    const src = byKey.get(e.key);
    const connected = connectedKeys.has(e.key);
    const status = src?.status ?? (connected ? "connected" : "not_connected");
    const isPending = pending.includes(e.key) && status !== "connected";
    return (
      <SourceRow
        key={e.key}
        entry={e}
        source={src}
        status={e.file ? "file" : isPending ? "pending" : status}
        onConnect={() => void onConnect(e)}
        onCancel={() => cancel(e.key)}
        onImport={() =>
          // GAP: no outcomes CSV import in the data layer yet (LANE_REQUESTS.md #19).
          setNote("CSV outcome import isn’t live yet. Connect a CRM, or skip this for now.")
        }
      />
    );
  }

  return (
    <OnboardingLayout step={2} width={760} top={56}>
      <StepHeader
        eyebrow="Step 3 of 5"
        title="Where do your calls live?"
        lead="Bylda needs audio or transcripts. CRM is optional but lets Bylda link behavior to deal outcomes."
      />
      {sources.isLoading ? (
        <StateLoading label="Loading your connections" />
      ) : sources.error ? (
        <StateError
          body={sources.error instanceof Error ? sources.error.message : "Try again in a moment."}
          onRetry={() => void sources.refetch()}
        />
      ) : (
        <>
          <SourceGroup label="Call source · required">
            {entries(list)
              .filter((e) => e.group === "calls")
              .map(row)}
          </SourceGroup>
          <SourceGroup label="Outcomes · recommended">
            {entries(list)
              .filter((e) => e.group === "outcomes")
              .map(row)}
          </SourceGroup>
          {note ? (
            <InsetNote label="Heads up" role="status">
              {note}
            </InsetNote>
          ) : null}
          <p className="type-mono-micro text-by-text-tertiary">
            Bylda never writes to your CRM in V1.
            {retention.data
              ? ` Audio is processed, then retained for ${retention.data.recordingsDays} days (change in Settings → Retention).`
              : null}
          </p>
          <StepActions>
            <Button variant="ghost" asChild>
              <Link to="/welcome/teach">Back</Link>
            </Button>
            <Button
              disabled={!hasCallSource}
              onClick={() => void navigate({ to: "/welcome/invite-team" })}
            >
              Continue — invite team
            </Button>
            {!hasCallSource ? (
              <span className="type-ui-small text-by-text-tertiary">
                Connect a call source to continue.
              </span>
            ) : null}
          </StepActions>
        </>
      )}
    </OnboardingLayout>
  );
}

function SourceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <ul className="flex w-full flex-col rounded-by-card border border-by-border-engraved bg-by-surface-raised px-4 py-1">
        {children}
      </ul>
    </section>
  );
}

type RowStatus = DataSource["status"] | "pending" | "file";

function SourceRow({
  entry,
  source,
  status,
  onConnect,
  onCancel,
  onImport,
}: {
  entry: Entry;
  source: DataSource | undefined;
  status: RowStatus;
  onConnect: () => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const detail =
    status === "file"
      ? entry.file?.note
      : status === "error"
        ? (source?.error ?? "Sync stopped")
        : status === "pending"
          ? "Waiting for approval…"
          : status === "connected" && source && source.callsSynced > 0
            ? `${source.callsSynced} ${entry.group === "calls" ? "recordings" : "records"} synced${
                source.waiting > 0 ? ` · ${source.waiting} waiting` : ""
              }`
            : entry.group === "outcomes" && status === "not_connected"
              ? "Needed to link calls to outcomes"
              : null;

  return (
    <li className="flex w-full items-center gap-3.5 border-b border-by-border-engraved py-3 last:border-b-0">
      <span
        aria-hidden
        className="type-mono-micro flex size-8 shrink-0 items-center justify-center rounded-by-tile border border-by-border-engraved bg-by-surface-inset uppercase text-by-text-secondary"
      >
        {entry.name.slice(0, 2)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-ui-body-strong text-by-text-primary">{entry.name}</span>
        <span
          className={cn(
            "type-ui-small whitespace-pre-wrap",
            status === "error" ? "text-by-feedback-error" : "text-by-text-secondary",
          )}
        >
          {entry.description}
          {detail ? <span>{`  ·  ${detail}`}</span> : null}
        </span>
      </span>
      {status === "connected" ? (
        <Tag tone="improve">Connected</Tag>
      ) : status === "error" ? (
        <>
          <Tag tone="regress">Error</Tag>
          <Button variant="secondary" onClick={onConnect}>
            Reconnect
          </Button>
        </>
      ) : status === "pending" ? (
        <>
          <Tag tone="attention">Connecting</Tag>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </>
      ) : status === "file" ? (
        <>
          <Tag>Available</Tag>
          {entry.file?.to ? (
            <Button variant="ghost" asChild>
              <Link to={entry.file.to}>{entry.file.label}</Link>
            </Button>
          ) : (
            <Button variant="ghost" onClick={onImport}>
              {entry.file?.label}
            </Button>
          )}
        </>
      ) : (
        <>
          <Tag>Not connected</Tag>
          <Button variant="secondary" onClick={onConnect}>
            Connect
          </Button>
        </>
      )}
    </li>
  );
}
