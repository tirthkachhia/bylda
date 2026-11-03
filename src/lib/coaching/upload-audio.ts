import { Upload, defaultOptions, type HttpStack } from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

export const AUDIO_CHUNK_BYTES = 6 * 1024 * 1024;
type Progress = (uploaded: number, total: number) => void;
class UploadCredentialError extends Error {}

/** Supabase recommends its direct storage host for large/resumable uploads. */
export function resumableAudioEndpoint(projectUrl: string): string {
  const url = new URL(projectUrl);
  if (/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname))
    url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");
  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * Each PATCH carries at most 6 MB. A 524/network interruption resumes at the
 * server's confirmed offset instead of restarting a 100 MB HTTP request.
 * There is no short deadline on the complete file; retries are bounded per chunk.
 */
export async function uploadAudioResumable(input: {
  projectUrl: string;
  path: string;
  file: File;
  contentType: string;
  getAccessToken: () => Promise<string>;
  onProgress?: Progress;
  /** Injectable transport for protocol-level tests. */
  httpStack?: HttpStack;
}): Promise<void> {
  // Fail before allocating an upload when the user has signed out.
  await input.getAccessToken();
  const endpoint = resumableAudioEndpoint(input.projectUrl);
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(input.file, {
      endpoint,
      ...(input.httpStack ? { httpStack: input.httpStack } : {}),
      chunkSize: AUDIO_CHUNK_BYTES,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      onShouldRetry: (error, attempt, options) =>
        !(error.causingError instanceof UploadCredentialError) &&
        (defaultOptions.onShouldRetry?.(error, attempt, options) ?? false),
      uploadDataDuringCreation: false,
      removeFingerprintOnSuccess: true,
      // The default fingerprint uses the file, not the workspace/object path.
      // Never resume another rep's upload just because the file is the same.
      fingerprint: async () =>
        JSON.stringify([
          endpoint,
          "call-audio",
          input.path,
          input.file.size,
          input.file.lastModified,
        ]),
      metadata: {
        bucketName: "call-audio",
        objectName: input.path,
        contentType: input.contentType,
        cacheControl: "3600",
      },
      onBeforeRequest: async (request) => {
        if (new URL(request.getURL()).origin !== new URL(endpoint).origin)
          throw new UploadCredentialError("Unexpected recording upload destination");
        // Refresh the credential for each chunk of a potentially long upload.
        let token: string;
        try {
          token = await input.getAccessToken();
        } catch {
          throw new UploadCredentialError("Sign in again to upload this recording.");
        }
        request.setHeader("authorization", `Bearer ${token}`);
        request.setHeader("x-upsert", "false");
      },
      onProgress: input.onProgress,
      onError: reject,
      onSuccess: () => resolve(),
    });
    // Private browsing can disable local URL storage. In-memory resumable retries
    // still work, so that must not block a new upload.
    void upload
      .findPreviousUploads()
      .catch(() => [])
      .then((previous) => {
        if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
}

export async function uploadCallAudio(
  path: string,
  file: File,
  contentType: string,
  onProgress?: Progress,
): Promise<{ error: { message: string } | null }> {
  try {
    await uploadAudioResumable({
      projectUrl: import.meta.env.VITE_SUPABASE_URL,
      path,
      file,
      contentType,
      onProgress,
      getAccessToken: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw new Error("Sign in again to upload this recording.");
        return data.session.access_token;
      },
    });
    return { error: null };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Recording upload failed" },
    };
  }
}
