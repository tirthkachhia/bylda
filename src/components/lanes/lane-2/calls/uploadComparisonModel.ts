import type { CallReview, UploadResult } from "@/lib/data";
export function fileProblem(file: Pick<File, "name" | "size">, policy: UploadResult) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !policy.accepted.includes(extension)) return "Unsupported file type";
  if (file.size === 0) return "Empty file";
  if (file.size > policy.maxBytes) return "Exceeds file size limit";
  return null;
}
export function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
export function alignedTranscript(review: CallReview) {
  const anchor = review.events.find((event) => event.type === "objection")?.tStart;
  return {
    anchor,
    segments: review.transcript.filter((segment) => anchor === undefined || segment.tEnd >= anchor),
  };
}
