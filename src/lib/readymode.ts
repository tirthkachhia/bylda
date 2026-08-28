export function buildReadyModeConnectionRequest(webhookUrl: string) {
  return [
    "Please connect our ReadyMode account to Bylda.",
    `Send completed-call webhooks to: ${webhookUrl}`,
    "Include the call ID, connected status, duration, recording URL or transcript, phone numbers, disposition, and call time.",
    "Please also enable recording playback for our ReadyMode user.",
  ].join("\n");
}

export type ReadyModeConnectionStatus = {
  callReceived: boolean;
  transcriptStored: boolean;
  analysisReady: boolean;
  lastCallAt: string | null;
  transcriptionStatus: string | null;
};

export function readyModeProgress(status: ReadyModeConnectionStatus | null | undefined) {
  if (!status?.callReceived) return 0;
  if (!status.transcriptStored) return 1;
  if (!status.analysisReady) return 2;
  return 3;
}
