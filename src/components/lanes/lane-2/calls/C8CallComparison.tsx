import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  DataBoundary,
  StateEmpty,
  StateError,
  SystemState,
  Tag,
  systemStates,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useCalls,
  useCallComparison,
  useViewer,
  type Call,
  type CallReview,
  type Viewer,
} from "@/lib/data";
import {
  LocalSelect,
  LocalSettingsTable,
  cell,
} from "@/components/lanes/lane-5/settings/LocalSettings";
import { durationLabel } from "./callIndexModel";
import { alignedTranscript } from "./uploadComparisonModel";

export function C8CallComparison() {
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>{(person) => <ComparisonCalls viewer={person} />}</DataBoundary>
  );
}
function ComparisonCalls({ viewer }: { viewer: Viewer }) {
  const calls = useCalls();
  return (
    <DataBoundary
      query={calls}
      empty={<StateEmpty title="No calls to compare." />}
      error={(error) =>
        error instanceof ForbiddenForRoleError ? (
          <SystemState
            {...systemStates.permissionDenied()}
            title="You don’t have access to this comparison."
            body="Reps can compare only their own calls."
            actions={[]}
          />
        ) : (
          <StateError onRetry={() => void calls.refetch()} />
        )
      }
    >
      {(rows) => (
        <ComparisonPicker
          key={`${viewer.id}:${viewer.role}`}
          viewer={viewer}
          calls={viewer.role === "rep" ? rows.filter((call) => call.repId === viewer.id) : rows}
        />
      )}
    </DataBoundary>
  );
}
function ComparisonPicker({ viewer, calls }: { viewer: Viewer; calls: Call[] }) {
  const [left, setLeft] = useState(calls[0]?.id ?? "");
  const [right, setRight] = useState(calls[1]?.id ?? "");
  const [notice, setNotice] = useState("");
  const safeLeft = calls.some((call) => call.id === left) ? left : "";
  const safeRight = calls.some((call) => call.id === right) ? right : "";
  return (
    <section className="flex min-w-0 flex-col gap-5 px-8 py-6 max-lg:px-4">
      <p className="type-mono-micro text-by-text-tertiary">CALLS / COMPARE</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-editorial-h1">Compare calls</h1>
          <p className="type-ui-small mt-2 text-by-text-secondary">
            Read two call transcripts side by side. Matching objections hasn’t been verified.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!safeLeft || !safeRight}
            onClick={() => {
              setLeft(right);
              setRight(left);
            }}
          >
            Swap calls
          </Button>
          <Button onClick={() => setNotice("Sharing comparisons with a team isn’t available yet.")}>
            Share with team
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        {(
          [
            ["Left call", left, setLeft],
            ["Right call", right, setRight],
          ] as const
        ).map(([label, value, change]) => (
          <LocalSelect
            key={label}
            label={label}
            value={
              calls.findIndex((call) => call.id === value) < 0
                ? "Choose a call"
                : `${calls.findIndex((call) => call.id === value) + 1}. ${calls.find((call) => call.id === value)?.repName} × ${calls.find((call) => call.id === value)?.account.name}`
            }
            options={[
              "Choose a call",
              ...calls.map((call, index) => `${index + 1}. ${call.repName} × ${call.account.name}`),
            ]}
            onChange={(option) => change(calls[Number.parseInt(option) - 1]?.id ?? "")}
          />
        ))}
      </div>
      {notice && (
        <p role="status" className="type-ui-small text-by-text-secondary">
          {notice}
        </p>
      )}
      {!safeLeft || !safeRight ? (
        <StateEmpty title="Choose two calls." body="Only calls you can access appear here." />
      ) : safeLeft === safeRight ? (
        <StateEmpty title="Choose two different calls." />
      ) : (
        <ComparisonResult
          key={`${viewer.id}:${viewer.role}:${safeLeft}:${safeRight}`}
          viewer={viewer}
          left={safeLeft}
          right={safeRight}
        />
      )}
    </section>
  );
}
function ComparisonResult({
  viewer,
  left,
  right,
}: {
  viewer: Viewer;
  left: string;
  right: string;
}) {
  const query = useCallComparison(left, right);
  return (
    <DataBoundary
      query={query}
      empty={
        <StateEmpty
          title="Comparison unavailable."
          body="One of these calls is no longer available."
        />
      }
      error={(error) =>
        error instanceof ForbiddenForRoleError ? (
          <SystemState
            {...systemStates.permissionDenied()}
            title="You don’t have access to this comparison."
            body="Reps can compare only their own calls."
            actions={[]}
          />
        ) : (
          <StateError title="Comparison couldn’t load." onRetry={() => void query.refetch()} />
        )
      }
    >
      {(comparison) => {
        if (!comparison) return <StateEmpty title="Comparison unavailable." />;
        if (
          viewer.role === "rep" &&
          [comparison.left, comparison.right].some((review) => review.call.repId !== viewer.id)
        )
          return (
            <SystemState
              {...systemStates.permissionDenied()}
              title="You don’t have access to this comparison."
              body="Reps can compare only their own calls."
              actions={[]}
            />
          );
        if (comparison.left.call.id !== left || comparison.right.call.id !== right)
          return <StateEmpty title="Comparison changed." body="Choose the calls again." />;
        return (
          <>
            <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
              <TranscriptCard review={comparison.left} />
              <TranscriptCard review={comparison.right} />
            </div>
            <div className="rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4">
              <h2 className="type-ui-label">BEHAVIOR AFTER OBJECTION</h2>
              <p className="type-ui-small mt-3 text-by-text-secondary">
                Aligned behavior metrics, confidence and sample counts aren’t available. Behavioral
                differences and suggested actions are withheld. Whole-call aggregates aren’t
                substituted for the objection window.
              </p>
            </div>
          </>
        );
      }}
    </DataBoundary>
  );
}
function TranscriptCard({ review }: { review: CallReview }) {
  const { call } = review;
  const { anchor, segments } = alignedTranscript(review);
  return (
    <article className="min-w-0 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-5">
      <div className="flex items-center gap-3">
        <Avatar name={call.repName} size={28} />
        <h2 className="type-ui-body-strong flex-1">
          {call.repName} × {call.account.name}
        </h2>
        <Tag>{call.outcome?.replaceAll("_", " ") ?? "Outcome unavailable"}</Tag>
      </div>
      <p className="type-mono-data mt-3 text-by-text-secondary">
        {call.stageAtCall ?? "Stage unavailable"} · {durationLabel(call.durationSec)}
      </p>
      <p className="type-ui-small mt-3 text-by-text-secondary">
        {anchor === undefined
          ? "No objection anchor available. Showing the raw transcript."
          : "Raw transcript from the first detected objection. Each call uses its own anchor."}
      </p>
      {call.status !== "ready" || review.analysis.analysisStatus !== "completed" ? (
        <StateEmpty title="Call analysis isn’t complete." body={`Call status: ${call.status}.`} />
      ) : !segments.length ? (
        <StateEmpty title="No transcript available." />
      ) : (
        <LocalSettingsTable headings={["Time", "Speaker / transcript"]}>
          {segments.slice(0, 5).map((segment) => (
            <tr key={segment.id} className="border-b border-by-border-engraved last:border-0">
              <td className={cell}>
                {anchor === undefined
                  ? durationLabel(segment.tStart)
                  : `${(segment.tStart - anchor).toFixed(1)}s`}
              </td>
              <td className={cell}>
                <p className="type-mono-micro text-by-text-tertiary">{segment.speakerName}</p>
                <p className="type-ui-small mt-1">{segment.text}</p>
              </td>
            </tr>
          ))}
        </LocalSettingsTable>
      )}
      <Button asChild variant="ghost" className="mt-3">
        <Link to="/app/calls/$callId/transcript" params={{ callId: call.id }} search={true}>
          Open full transcript
        </Link>
      </Button>
    </article>
  );
}
