import type { UploadItem, UploadStatus } from "@/lib/coaching/types";

const LABEL: Record<UploadStatus, string> = {
  queued: "Waiting",
  uploading: "Importing and analyzing…",
  queued_transcription: "Queued, transcribing in the background",
  analyzed: "Coaching ready",
  saved_no_transcript: "Saved, transcript unavailable",
  failed: "Failed",
};

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** One line per chosen file: name, size, and current pipeline status. Display only. */
export function UploadRows({ items }: { items: UploadItem[] }) {
  if (!items.length) return null;
  return (
    <ul
      aria-live="polite"
      className="divide-y divide-by-border-engraved rounded-lg border border-by-border-engraved text-sm"
    >
      {items.map((item, index) => (
        <li
          key={`${item.file.name}-${index}`}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3"
        >
          <span className="truncate">{item.file.name}</span>
          <span className="shrink-0 text-xs text-neutral-500">{formatSize(item.file.size)}</span>
          <span
            role="status"
            className={`col-span-2 break-words text-xs ${item.status === "failed" ? "text-red-600" : "text-neutral-700"}`}
          >
            {item.status === "failed" && item.message ? item.message : LABEL[item.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
