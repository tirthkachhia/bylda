import type { UploadItem, UploadStatus } from "@/lib/coaching/types";

const LABEL: Record<UploadStatus, string> = {
  queued: "Waiting",
  uploading: "Uploading and analyzing…",
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
    <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm">
      {items.map((item, index) => (
        <li
          key={`${item.file.name}-${index}`}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <span className="truncate">{item.file.name}</span>
          <span className="shrink-0 text-xs text-neutral-500">{formatSize(item.file.size)}</span>
          <span
            role="status"
            className={`shrink-0 text-xs ${item.status === "failed" ? "text-red-600" : "text-neutral-700"}`}
          >
            {item.status === "failed" && item.message ? item.message : LABEL[item.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
