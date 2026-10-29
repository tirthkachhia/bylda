import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { importRecording, validateImportFile, type ImportDeps } from "@/lib/coaching/import-one";
import type { UploadItem } from "@/lib/coaching/types";
import { UploadRows } from "./UploadRows";

const deps: ImportDeps = {
  upload: (path, file, contentType) =>
    supabase.storage.from("call-audio").upload(path, file, { contentType, upsert: false }),
  invoke: (name, body) => supabase.functions.invoke(name, { body }),
};

/**
 * Choose many recordings for the rep selected on the page, confirm permission,
 * then run the existing upload → import-call → analyze-call flow for each file
 * in turn. Progress is browser-local; keep the tab open until every row settles.
 */
export function BulkCallUpload({
  organizationId,
  userId,
  repId,
  repName,
  onImported,
}: {
  organizationId: string;
  userId: string;
  repId: string;
  repName: string;
  onImported: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const updateItem = (index: number, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  function choose(files: FileList | File[] | null) {
    const next = Array.from(files ?? []).map<UploadItem>((file) => {
      try {
        validateImportFile(file);
        return { file, status: "queued" };
      } catch (error) {
        return {
          file,
          status: "failed",
          message: error instanceof Error ? error.message : "Invalid file",
        };
      }
    });
    setItems((prev) => [...prev, ...next]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function start() {
    if (running || !consent) return;
    setRunning(true);
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== "queued") continue;
      updateItem(i, { status: "uploading" });
      try {
        const result = await importRecording(
          { file: items[i].file, organizationId, userId, repId },
          deps,
        );
        updateItem(i, {
          status: result.status === "queued" ? "queued_transcription" : result.status,
          callId: result.callId,
        });
      } catch (error) {
        updateItem(i, {
          status: "failed",
          message: error instanceof Error ? error.message : "Import failed",
        });
      }
    }
    setRunning(false);
    onImported();
  }

  const queued = items.filter((item) => item.status === "queued").length;
  const canStart = consent && queued > 0 && !running;

  return (
    <section className="rounded-by-card border border-neutral-200 bg-white p-5 text-neutral-900">
      <div>
        <h2 className="font-semibold">Upload recordings for {repName}</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Add as many recordings as you like (up to 100 MB each), then start. Each file is
          transcribed and reviewed in turn; keep this tab open until all rows finish.
        </p>
      </div>
      <label
        className={`mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center text-[13px] ${dragActive ? "border-by-text-primary bg-by-surface-sidebar" : "border-by-border-control bg-by-surface-hover"}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!running) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (!running) choose(event.dataTransfer.files);
        }}
      >
        <Upload size={24} className="text-by-text-secondary" />
        <span className="font-medium">
          Drop recordings or TXT transcripts here, or choose files
        </span>
        <span className="text-xs text-by-text-tertiary">
          MP3, MP4, M4A, WAV, WebM, OGG or FLAC · up to 100 MB · TXT up to 100,000 characters
        </span>
        <input
          ref={fileInput}
          className="max-w-full text-xs"
          aria-label="Choose call recordings"
          type="file"
          multiple
          disabled={running}
          accept=".mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac,.txt"
          onChange={(event) => choose(event.target.files)}
        />
      </label>
      <div className="mt-4">
        <UploadRows items={items} />
      </div>
      <label className="my-4 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={consent}
          disabled={running}
          onChange={(event) => setConsent(event.target.checked)}
        />
        I have permission to upload and process these recordings and share them with this workspace.
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!canStart}
          onClick={() => void start()}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Upload className="h-4 w-4" />
          {running
            ? "Processing…"
            : `Upload ${queued || ""} ${queued === 1 ? "recording" : "recordings"}`}
        </button>
        {!running && items.length > 0 && (
          <button type="button" className="text-sm underline" onClick={() => setItems([])}>
            Clear list
          </button>
        )}
      </div>
    </section>
  );
}
