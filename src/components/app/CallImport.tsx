import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { validateCallFile } from "@/lib/call-upload";
import { supabase } from "@/integrations/supabase/client";

export function CallImport({
  organizationId,
  onImported,
}: {
  organizationId: string;
  onImported: (callId?: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [complete, setComplete] = useState(false);
  const [audio, setAudio] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savedCall, setSavedCall] = useState<string | null>(null);
  const [importId, setImportId] = useState(() => crypto.randomUUID());
  async function analyze(id: string) {
    setMessage("Call saved. Analyzing transcript…");
    const { data, error } = await supabase.functions.invoke("analyze-call", {
      body: { call_id: id },
    });
    if (error || data?.error)
      throw new Error("Call saved, but analysis did not complete. Retry analysis below.");
    setMessage(
      "Coaching ready. Your transcript, rep coaching, and evidence-backed insights are saved below. CRM changes still require review.",
    );
    setComplete(true);
  }
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      if (savedCall) {
        await analyze(savedCall);
        onImported(savedCall);
        return;
      }
      let path: string | undefined;
      if (audio) {
        const { extension, contentType } = validateCallFile(audio);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in again.");
        path = `${organizationId}/${user.id}/${importId}.${extension}`;
        setMessage("Uploading private audio…");
        const { error } = await supabase.storage
          .from("call-audio")
          .upload(path, audio, { contentType, upsert: false });
        if (error && !error.message.toLowerCase().includes("already exists")) throw error;
      }
      setMessage(
        transcript.trim()
          ? "Saving supplied transcript…"
          : "Transcribing the recording with your Cloudflare AI worker…",
      );
      const { data, error } = await supabase.functions.invoke("import-call", {
        body: {
          organization_id: organizationId,
          import_id: importId,
          audio_path: path,
          transcript,
          details,
          consent,
        },
      });
      if (error || data?.error)
        throw new Error(
          data?.error ||
            "Import failed. Check your connection and retry; audio transcription requires a configured worker.",
        );
      onImported();
      if (data.transcript_available) {
        setSavedCall(data.call_id);
        await analyze(data.call_id);
        onImported(data.call_id);
      } else {
        setMessage(
          `Audio saved, but a transcript is not available (${data.transcription_status || "check call"}). Paste a transcript above and retry to add it to this call. No AI measurements were invented.`,
        );
        setSavedCall(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const field = "w-full rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-900";
  return (
    <section className="my-5 rounded-by-card border border-neutral-200 bg-white p-5 text-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Turn a recording into coaching</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Private upload → Cloudflare transcription → evidence-backed coaching
          </p>
        </div>
        <button
          disabled={busy || !!savedCall}
          onClick={() => {
            setOpen(true);
            fileInput.current?.click();
          }}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Upload className="h-4 w-4" /> Add MP3 or MP4 file
        </button>
      </div>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="mt-4">
        <summary className="cursor-pointer font-semibold">
          {audio ? audio.name : "Upload options, transcript, and call details"}
        </summary>
        <p className="my-3 text-sm text-neutral-500">
          Up to 100 MB. MP4 must contain an audio track; video images are not analyzed. Recordings
          are private to your workspace and sent to your Cloudflare worker for transcription. A
          supplied transcript skips transcription. No emotion or internal-state scoring.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            MP3 / MP4 recording (up to 100 MB)
            <input
              ref={fileInput}
              disabled={busy || !!savedCall}
              className={`${field} mt-2`}
              type="file"
              accept=".mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                try {
                  if (file) validateCallFile(file);
                  setAudio(file);
                  setImportId(crypto.randomUUID());
                  setMessage("");
                  setComplete(false);
                  setOpen(true);
                } catch (error) {
                  setAudio(null);
                  e.target.value = "";
                  setMessage(error instanceof Error ? error.message : "Invalid recording");
                }
              }}
            />
          </label>
          <label className="text-sm">
            Optional context
            <textarea
              disabled={busy || !!savedCall}
              className={`${field} mt-2`}
              rows={5}
              maxLength={8000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Participants and roles, sales framework, call goal, discovery/pitch timestamps, objections, and corrections. These are your supplied notes, not verified transcript evidence."
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Transcript (optional when audio is supplied)
            <textarea
              disabled={busy || !!savedCall}
              className={`${field} mt-2`}
              rows={7}
              maxLength={100000}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the full transcript. Speaker names and timestamps help identify what happened. Don't add information that wasn't said."
            />
          </label>
        </div>
        <label className="my-4 flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I have permission to upload and process this recording/transcript and share it with this
          workspace.
        </label>
        <div className="flex gap-3">
          <button
            disabled={busy || complete || !consent || (!audio && !transcript.trim())}
            onClick={() => void submit()}
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy
              ? "Processing…"
              : complete
                ? "Coaching ready"
                : savedCall
                  ? "Retry analysis"
                  : "Transcribe and create coaching"}
          </button>
          {savedCall && (
            <button
              disabled={busy}
              className="text-sm underline"
              onClick={() => {
                setSavedCall(null);
                setComplete(false);
                if (fileInput.current) fileInput.current.value = "";
                setAudio(null);
                setTranscript("");
                setDetails("");
                setConsent(false);
                setMessage("");
                setImportId(crypto.randomUUID());
              }}
            >
              New import
            </button>
          )}
        </div>
        {message && (
          <p role="status" className="mt-4 text-sm">
            {message}
          </p>
        )}
      </details>
    </section>
  );
}
