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

export type ImportResult = { callId: string; status: "analyzed" | "saved_no_transcript" };

function failureMessage(response: InvokeResponse, fallback: string) {
  const message = response.data?.error;
  return typeof message === "string" && message ? message : fallback;
}

/**
 * Runs the existing single-call pipeline for one recording: private upload,
 * import-call (transcription), then analyze-call. Dependencies are injected so
 * the flow is testable without Supabase. Each call gets its own import id, which
 * import-call uses as the call id, so a retried upload never duplicates a call.
 */
export async function importRecording(input: ImportInput, deps: ImportDeps): Promise<ImportResult> {
  const { extension, contentType } = validateCallFile(input.file);
  const importId = crypto.randomUUID();
  const path = `${input.organizationId}/${input.userId}/${importId}.${extension}`;
  const { error: uploadError } = await deps.upload(path, input.file, contentType);
  if (uploadError && !uploadError.message.toLowerCase().includes("already exists"))
    throw new Error(uploadError.message);
  const imported = await deps.invoke("import-call", {
    organization_id: input.organizationId,
    import_id: importId,
    audio_path: path,
    consent: true,
    rep_id: input.repId,
  });
  if (imported.error || imported.data?.error)
    throw new Error(failureMessage(imported, "Import failed"));
  if (!imported.data?.transcript_available)
    return { callId: importId, status: "saved_no_transcript" };
  const analyzed = await deps.invoke("analyze-call", { call_id: importId });
  if (analyzed.error || analyzed.data?.error)
    throw new Error("Saved, but analysis did not complete");
  return { callId: importId, status: "analyzed" };
}
