export const CALL_UPLOAD_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  m4a: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  flac: "audio/flac",
};
export const MAX_CALL_UPLOAD_BYTES = 100 * 1024 * 1024;

export function validateCallFile(file: { name: string; size: number }) {
  if (!file.size) throw new Error("This file is empty. Choose a recording with audio.");
  if (file.size > MAX_CALL_UPLOAD_BYTES) throw new Error("Choose a recording up to 100 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!CALL_UPLOAD_TYPES[extension])
    throw new Error("Choose MP3, MP4, M4A, WAV, WebM, OGG or FLAC.");
  return { extension, contentType: CALL_UPLOAD_TYPES[extension] };
}
