import { describe, expect, it } from "vitest";
import { validateCallFile } from "../call-upload";
describe("recording uploads", () => {
  it("accepts actual MP3 and MP4 extensions with correct storage types", () => {
    expect(validateCallFile({ name: "call.MP3", size: 20 }).contentType).toBe("audio/mpeg");
    expect(validateCallFile({ name: "call.mp4", size: 20 }).contentType).toBe("video/mp4");
  });
  it("rejects empty, oversized, and unsupported files", () => {
    for (const file of [
      { name: "call.mp3", size: 0 },
      { name: "call.mp4", size: 104857601 },
      { name: "call.exe", size: 5 },
    ])
      expect(() => validateCallFile(file)).toThrow();
  });
  it("accepts recordings above the old cap and exactly at 100 MB", () => {
    for (const size of [26214401, 52428801, 104857600]) {
      expect(validateCallFile({ name: "call.mp4", size }).contentType).toBe("video/mp4");
    }
  });
});
