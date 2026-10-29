import { validateCallFile } from "@/lib/call-upload";

type InvokeResponse = { data: Record<string, unknown> | null; error: unknown };

export type ImportDeps = {
  upload: (
    path: string,
    file: File,
    contentType: string,
  ) => Promise<{ error: { message: string } | null }>;
  invoke: (name: string, body: Record<string, unknown>) => Promise<InvokeResponse>;
};

export type ImportInput = {
  file: File;
  organizationId: string;
  userId: string;
  repId: string;
};

export type ImportResult = {
  callId: string;
  /** "queued" means the Gemini worker owns the rest; the list refreshes as it progresses. */
  status: "analyzed" | "saved_no_transcript" | "queued";
};

function failureMessage(response: InvokeResponse, fallback: string) {
  const message = response.data?.error;
  return typeof message === "string" && message ? message : fallback;
}

/**
 * Runs the existing media or supplied-transcript pipeline, then analysis.
 * Dependencies are injected for local verification. One import ID is reused
 * across the storage and function steps; TXT uses the supplied-transcript API.
 */
export async function importRecording(input: ImportInput, deps: ImportDeps): Promise<ImportResult> {
  const type = validateImportFile(input.file);
  const importId = crypto.randomUUID();
  const body: Record<string, unknown> = {
    organization_id: input.organizationId,
    import_id: importId,
    consent: true,
    rep_id: input.repId,
  };
  if (type.extension === "txt") {
    const transcript = (await input.file.text()).trim();
    if (!transcript || transcript.length > 100_000)
      throw new Error("Provide a non-empty transcript up to 100,000 characters.");
    body.transcript = transcript;
  } else {
    const path = `${input.organizationId}/${input.userId}/${importId}.${type.extension}`;
    const { error: uploadError } = await deps.upload(path, input.file, type.contentType);
    if (uploadError && !uploadError.message.toLowerCase().includes("already exists"))
      throw new Error(uploadError.message);
    body.audio_path = path;
    body.content_type = type.contentType;
  }
  const imported = await deps.invoke("import-call", body);
  if (imported.error || imported.data?.error)
    throw new Error(failureMessage(imported, "Import failed"));
  if (imported.data?.coaching_stage === "queued") return { callId: importId, status: "queued" };
  if (!imported.data?.transcript_available)
    return { callId: importId, status: "saved_no_transcript" };
  const analyzed = await deps.invoke("analyze-call", { call_id: importId });
  if (analyzed.error || analyzed.data?.error)
    throw new Error("Saved, but analysis did not complete");
  return { callId: importId, status: "analyzed" };
}

/** Text imports use the supplied-transcript API, never the audio bucket. */
export function validateImportFile(file: { name: string; size: number }) {
  if (file.name.split(".").pop()?.toLowerCase() === "txt") {
    if (!file.size) throw new Error("This file is empty. Choose a transcript with text.");
    if (file.size > 400_000) throw new Error("Choose a TXT transcript up to 100,000 characters.");
    return { extension: "txt", contentType: "text/plain" };
  }
  return validateCallFile(file);
}
