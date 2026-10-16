export type Rep = {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  email: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type UploadStatus = "queued" | "uploading" | "analyzed" | "saved_no_transcript" | "failed";

/** Browser-local state for one file in a bulk upload. Not persisted. */
export type UploadItem = {
  file: File;
  status: UploadStatus;
  callId?: string;
  message?: string;
};
