export const ENDPOINT: string;
export const MAX_AUDIO: number;
export type Connection = { endpoint: string; token: string; workspace: string; rep_id?: string };
export type ReadyModeCall = {
  external_id: string;
  source_url: string;
  duration?: number | null;
  recording_url?: string;
  transcript_url?: string;
  transcript?: string;
  include_recording?: boolean;
  label?: string;
  started_at?: string | null;
  direction?: string;
};
export function parseConnection(value: string): Connection;
export function allowedMediaUrl(value: string): URL;
export function audioType(blob: Blob, url?: string): string;
export function plainTranscript(value: string): string;
export function importCall(
  connection: Connection,
  call: ReadyModeCall,
  options?: {
    file?: File;
    transcript?: string;
    request?: typeof fetch;
    onStage?: (stage: string) => void;
  },
): Promise<Record<string, unknown>>;
