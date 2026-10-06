import type { EvidenceRef } from "@/lib/data";
export function momentKey(e: Pick<EvidenceRef, "callId" | "tSeconds">) {
  return `${e.callId}~${e.tSeconds}`;
}
export function parseMomentKey(key: string) {
  const match = /^([^~]+)~(\d+)$/.exec(key);
  if (!match || !Number.isSafeInteger(Number(match[2]))) return null;
  return { callId: match[1], tSeconds: Number(match[2]) };
}
