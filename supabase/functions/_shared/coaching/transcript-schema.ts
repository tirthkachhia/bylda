// Contract for Gemini structured transcripts. Pure module: no Deno or npm
// imports, so the Cloudflare worker, edge functions, the browser, and vitest
// can all import it.

/** Pinned from the live Gemini docs on 2026-10-16. Change here only. */
export const GEMINI_MODEL = "gemini-3.8-flash";

export const TRANSCRIPT_SCHEMA_VERSION = 1 as const;

export const TONE_LABELS = [
  "neutral",
  "warm",
  "enthusiastic",
  "curious",
  "hesitant",
  "skeptical",
  "frustrated",
  "dismissive",
  "rushed",
  "confused",
] as const;
export type ToneLabel = (typeof TONE_LABELS)[number];

export const SPEAKERS = ["rep", "customer", "unknown"] as const;
export type Speaker = (typeof SPEAKERS)[number];

export const AUDIO_QUALITIES = ["good", "fair", "poor"] as const;
export type AudioQuality = (typeof AUDIO_QUALITIES)[number];

export type StructuredTurn = {
  speaker: Speaker;
  /** "MM:SS" or "H:MM:SS", as returned by Gemini. Parsed to seconds downstream. */
  start: string;
  end: string;
  /** Verbatim words only. */
  text: string;
  tone: { label: ToneLabel; note: string };
  /** True when both parties speak at once during this turn. */
  overlap: boolean;
};

export type StructuredTranscript = {
  schema_version: typeof TRANSCRIPT_SCHEMA_VERSION;
  language: string;
  audio_quality: AudioQuality;
  /** Why each voice was assigned its role, so a wrong assignment can be audited. */
  speakers: Array<{ role: "rep" | "customer"; evidence: string }>;
  turns: StructuredTurn[];
};

// Gemini responseSchema (OpenAPI-style subset). Mirrors the types above.
const toneSchema = {
  type: "OBJECT",
  properties: {
    label: { type: "STRING", enum: [...TONE_LABELS] },
    note: {
      type: "STRING",
      description: "At most 15 words on what in the delivery justified the label.",
    },
  },
  required: ["label", "note"],
};

const turnSchema = {
  type: "OBJECT",
  properties: {
    speaker: { type: "STRING", enum: [...SPEAKERS] },
    start: { type: "STRING", description: "Turn start as MM:SS." },
    end: { type: "STRING", description: "Turn end as MM:SS." },
    text: { type: "STRING", description: "Verbatim words spoken in this turn." },
    tone: toneSchema,
    overlap: { type: "BOOLEAN" },
  },
  required: ["speaker", "start", "end", "text", "tone", "overlap"],
};

export const TRANSCRIPT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    schema_version: { type: "INTEGER" },
    language: { type: "STRING", description: "BCP-47 code of the spoken language, e.g. en." },
    audio_quality: { type: "STRING", enum: [...AUDIO_QUALITIES] },
    speakers: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          role: { type: "STRING", enum: ["rep", "customer"] },
          evidence: { type: "STRING" },
        },
        required: ["role", "evidence"],
      },
    },
    turns: { type: "ARRAY", items: turnSchema },
  },
  required: ["schema_version", "language", "audio_quality", "speakers", "turns"],
};

export const TRANSCRIPT_PROMPT = `You are transcribing a recorded sales call between a salesperson and a prospective customer.

Rules:
- Transcribe only words that were actually spoken. Never invent, paraphrase, or complete sentences.
- Identify the two parties. The salesperson is "rep"; the prospect is "customer". Record in "speakers" the evidence you used for each assignment (for example, who introduces a company and offer, who answers the phone).
- Produce one object per uninterrupted speaking turn, in order. Do not merge turns from different speakers.
- "start" and "end" are the turn's timestamps as MM:SS (or H:MM:SS past one hour).
- Set "speaker" to "unknown" only when attribution is genuinely impossible; prefer "rep" or "customer".
- Set "overlap" to true when both parties talk at the same time during the turn.
- "tone.label" describes how the speaker sounded in that turn, chosen from the allowed labels only. "tone.note" is at most 15 words naming what in the delivery justified the label (pace, pitch, hesitation, interruption, laughter, sighs).
- "audio_quality" is "good", "fair", or "poor" based on how reliably the words could be heard.
- "schema_version" is always 1.

Return only JSON matching the schema. Do not add words that were not spoken.`;
