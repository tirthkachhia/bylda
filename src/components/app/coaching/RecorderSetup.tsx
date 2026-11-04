import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getCallIngestUrl } from "@/lib/queries";
import { Link } from "@tanstack/react-router";
export function RecorderSetup({ name, onClose }: { name: string; onClose: () => void }) {
  const { currentOrgId } = useAuth();
  const q = useQuery({
    queryKey: ["recorder-webhook", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: () => getCallIngestUrl(currentOrgId ?? undefined),
  });
  return (
    <section className="rounded-xl border p-4 space-y-3" aria-label={`Configure ${name}`}>
      <h2>{name} · transcript ingestion</h2>
      <p className="text-xs">
        Use a recorder export or automation to post a completed call and transcript to this
        authenticated workspace webhook. This configuration does not claim a native recorder sync is
        running.
      </p>
      {q.error ? (
        <p role="alert">
          Webhook configuration could not load.{" "}
          <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : q.isPending ? (
        <p>Loading webhook…</p>
      ) : q.data?.configured ? (
        <>
          <label className="figma-field">
            Private ingestion URL
            <input
              aria-label="Private call ingestion URL"
              readOnly
              value={q.data.url ?? ""}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <pre className="overflow-auto text-xs">
            {JSON.stringify(
              {
                provider: name.toLowerCase().replaceAll(" ", "_"),
                provider_call_id: "your-stable-recording-id",
                connected: true,
                duration: 300,
                started_at: "2026-11-03T12:00:00Z",
                transcript: "Your recorder's actual transcript",
                recording_url: "https://your-recorder.example/recording",
              },
              null,
              2,
            )}
          </pre>
          <p className="text-xs">
            Send actual transcript text, a stable provider call ID and duration. Calls shorter than
            45 seconds may be retained without analysis. Keep the webhook URL private.
          </p>
        </>
      ) : (
        <p role="alert">
          Configure INBOUND_WEBHOOK_SECRET on the backend to enable authenticated ingestion. You can
          upload recordings now.
        </p>
      )}
      <Link className="figma-button" to="/app/crm/calls" search={{ upload: true }}>
        Upload recordings or TXT
      </Link>
      <button className="figma-button ml-2" onClick={onClose}>
        Close setup
      </button>
    </section>
  );
}
