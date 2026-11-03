// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { HttpRequest, HttpResponse, HttpStack } from "tus-js-client";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import {
  AUDIO_CHUNK_BYTES,
  resumableAudioEndpoint,
  uploadAudioResumable,
} from "../coaching/upload-audio";

/** Run the real TUS client against a fake storage server, including HEAD recovery. */
function storage(options: { interrupt?: boolean; status?: number; redirect?: string } = {}) {
  let offset = 0;
  let interrupted = false;
  let total = "";
  const requests: {
    method: string;
    url: string;
    headers: Record<string, string>;
    bytes: number;
  }[] = [];
  const httpStack: HttpStack = {
    getName: () => "test-storage",
    createRequest(method, url): HttpRequest {
      const headers: Record<string, string> = {};
      return {
        getMethod: () => method,
        getURL: () => url,
        setHeader: (key, value) => {
          headers[key.toLowerCase()] = value;
        },
        getHeader: (key) => headers[key.toLowerCase()],
        setProgressHandler: () => {},
        abort: async () => {},
        getUnderlyingObject: () => null,
        send: async (body) => {
          const bytes = Buffer.isBuffer(body) ? body.length : 0;
          requests.push({ method, url, headers: { ...headers }, bytes });
          if (method === "POST") total = headers["upload-length"];
          let status = options.status ?? (method === "POST" ? 201 : method === "HEAD" ? 200 : 204);
          if (method === "PATCH" && status === 204) {
            expect(Number(headers["upload-offset"])).toBe(offset);
            if (options.interrupt && !interrupted) {
              interrupted = true;
              offset += 1024 * 1024; // Server accepted bytes but the response was lost.
              status = 524;
            } else offset += bytes;
          }
          const responseHeaders: Record<string, string> = {
            location:
              options.redirect ??
              "https://project.storage.supabase.co/storage/v1/upload/resumable/one",
            "upload-offset": String(offset),
            "upload-length": total,
          };
          return {
            getStatus: () => status,
            getHeader: (key: string) => responseHeaders[key.toLowerCase()],
            getBody: () => "",
            getUnderlyingObject: () => null,
          } as HttpResponse;
        },
      };
    },
  };
  return { httpStack, requests, offset: () => offset };
}

function input(httpStack: HttpStack, size = 13 * 1024 * 1024) {
  // TUS's Node adapter takes Buffer; the browser adapter takes File. Both drive
  // the same chunk/offset/retry state machine tested here.
  const file = Object.assign(Buffer.alloc(size), {
    size,
    name: "call.wav",
    lastModified: 123,
  }) as unknown as File;
  return {
    projectUrl: "https://project.supabase.co",
    path: "org/user/import.wav",
    file,
    contentType: "audio/wav",
    getAccessToken: vi.fn(async () => "session"),
    httpStack,
  };
}

describe("resumable recording uploads", () => {
  it("uses the direct storage host and preserves custom/local project hosts", () => {
    expect(resumableAudioEndpoint("https://project.supabase.co")).toBe(
      "https://project.storage.supabase.co/storage/v1/upload/resumable",
    );
    expect(resumableAudioEndpoint("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321/storage/v1/upload/resumable",
    );
    expect(resumableAudioEndpoint("https://api.example.com")).toBe(
      "https://api.example.com/storage/v1/upload/resumable",
    );
  });
  it("splits a large recording into 6 MB chunks and reports completion", async () => {
    const server = storage();
    const onProgress = vi.fn();
    const upload = input(server.httpStack);
    await uploadAudioResumable({ ...upload, onProgress });
    expect(server.requests.filter((r) => r.method === "PATCH").map((r) => r.bytes)).toEqual([
      AUDIO_CHUNK_BYTES,
      AUDIO_CHUNK_BYTES,
      1024 * 1024,
    ]);
    expect(server.offset()).toBe(upload.file.size);
    expect(onProgress).toHaveBeenLastCalledWith(upload.file.size, upload.file.size);
    expect(server.requests[0].headers["upload-metadata"]).toContain("bucketName Y2FsbC1hdWRpbw==");
    expect(
      server.requests.every(
        (r) => r.headers.authorization === "Bearer session" && r.headers["x-upsert"] === "false",
      ),
    ).toBe(true);
  });
  it("recovers from a 524 using the confirmed offset rather than reuploading the file", async () => {
    const server = storage({ interrupt: true });
    const upload = input(server.httpStack);
    await uploadAudioResumable(upload);
    expect(server.requests.filter((r) => r.method === "POST")).toHaveLength(1);
    expect(server.requests.some((r) => r.method === "HEAD")).toBe(true);
    const patches = server.requests.filter((r) => r.method === "PATCH");
    expect(patches[1].headers["upload-offset"]).toBe(String(1024 * 1024));
    expect(patches.every((r) => r.bytes <= AUDIO_CHUNK_BYTES)).toBe(true);
    expect(server.offset()).toBe(upload.file.size);
  });
  it("gets a fresh session token for every chunk", async () => {
    const server = storage();
    let token = 0;
    await uploadAudioResumable({
      ...input(server.httpStack),
      getAccessToken: async () => `token-${++token}`,
    });
    const credentials = server.requests.map((r) => r.headers.authorization);
    expect(new Set(credentials).size).toBe(credentials.length);
  });
  it("accepts multiple 100 MB files without changing the per-file limit", async () => {
    const first = storage();
    const second = storage();
    const upload = input(first.httpStack, 100 * 1024 * 1024);
    await uploadAudioResumable(upload);
    await uploadAudioResumable({
      ...upload,
      path: "org/user/second.wav",
      httpStack: second.httpStack,
    });
    for (const server of [first, second]) {
      expect(server.offset()).toBe(100 * 1024 * 1024);
      expect(server.requests.filter((r) => r.method === "PATCH")).toHaveLength(17);
    }
    expect(first.requests[0].headers["upload-metadata"]).not.toEqual(
      second.requests[0].headers["upload-metadata"],
    );
  });
  it("does not retry an authorization failure or start analysis for it", async () => {
    const server = storage({ status: 403 });
    await expect(uploadAudioResumable(input(server.httpStack))).rejects.toThrow(/403/);
    expect(server.requests).toHaveLength(1);
  });
  it("fails before sending bytes when signed out", async () => {
    const server = storage();
    await expect(
      uploadAudioResumable({
        ...input(server.httpStack),
        getAccessToken: async () => {
          throw new Error("Signed out");
        },
      }),
    ).rejects.toThrow("Signed out");
    expect(server.requests).toHaveLength(0);
  });
  it("does not send credentials to an unexpected upload Location", async () => {
    const server = storage({ redirect: "https://other.example/upload" });
    await expect(uploadAudioResumable(input(server.httpStack))).rejects.toThrow();
    expect(
      server.requests.every((r) => r.url.startsWith("https://project.storage.supabase.co/")),
    ).toBe(true);
  });
});
