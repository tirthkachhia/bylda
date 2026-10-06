import type { ID } from "./common";

export type TranscriptSegment = {
  id: ID;
  speaker: "rep" | "prospect" | "other";
  speakerName: string;
  /** seconds from call start */
  tStart: number;
  tEnd: number;
  text: string;
};
