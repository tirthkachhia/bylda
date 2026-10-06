import { useRef, useState } from "react";
import {
  Button,
  ContextPanel,
  DataBoundary,
  StateEmpty,
  StateError,
  StateLoading,
} from "@/components/bylda";
import { useUploadCall, useViewer, type UploadResult } from "@/lib/data";
import { LocalSettingsTable, cell } from "@/components/lanes/lane-5/settings/LocalSettings";
import { bytesLabel, fileProblem } from "./uploadComparisonModel";

export function C7CallsManualUpload() {
  const viewer = useViewer();
  return <DataBoundary query={viewer}>{() => <UploadContent />}</DataBoundary>;
}
function UploadContent() {
  const upload = useUploadCall();
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ id: number; file: File }[]>([]);
  const nextId = useRef(0);
  const [policy, setPolicy] = useState<UploadResult | null>(null);
  const [notice, setNotice] = useState("");
  const prepare = async (selected: File[]) => {
    if (!selected.length || upload.isPending) return;
    setFiles((previous) => [
      ...previous,
      ...selected.map((file) => ({ id: nextId.current++, file })),
    ]);
    setNotice("Files selected locally. Nothing has been uploaded.");
    try {
      setPolicy(await upload.mutateAsync());
    } catch {
      setPolicy(null);
    }
  };
  return (
    <section className="flex min-w-0 flex-col gap-5 px-8 py-6 max-lg:px-4">
      <p className="type-mono-micro text-by-text-tertiary">CALLS / UPLOAD</p>
      <div>
        <h1 className="type-editorial-h1">Upload calls</h1>
        <p className="type-ui-small mt-2 text-by-text-secondary">
          For teams without a connected recorder, or to backfill older calls. Bylda needs speaker
          separation to analyze behavior.
        </p>
      </div>
      <div
        className="flex flex-col items-center gap-3 rounded-by-card border border-dashed border-by-border-strong bg-by-surface-raised px-6 py-12 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void prepare(Array.from(event.dataTransfer.files));
        }}
      >
        <h2 className="type-editorial-h2">Drop audio, video or transcript files</h2>
        <p className="type-mono-micro text-by-text-tertiary">
          {policy
            ? `${policy.accepted.join(" · ")} · up to ${bytesLabel(policy.maxBytes)} each`
            : "Choose files to check the supported formats and size limit."}
        </p>
        <input
          ref={picker}
          type="file"
          multiple
          aria-label="Choose call files"
          className="sr-only"
          onChange={(event) => {
            void prepare(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          disabled={upload.isPending}
          onClick={() => picker.current?.click()}
        >
          Choose files
        </Button>
      </div>
      {upload.isPending && <StateLoading label="Checking upload requirements…" />}
      {upload.error && (
        <StateError
          title="Upload requirements couldn’t load."
          body={upload.error.message}
          onRetry={() => {
            void upload
              .mutateAsync()
              .then(setPolicy)
              .catch(() => setPolicy(null));
          }}
        />
      )}
      <div className="rounded-by-card border border-by-border-engraved bg-by-surface-raised">
        <div className="flex justify-between border-b border-by-border-engraved px-4 py-3">
          <h2 className="type-ui-label">THIS UPLOAD</h2>
          <span className="type-mono-micro text-by-text-tertiary">
            {files.length} files selected
          </span>
        </div>
        {files.length ? (
          <LocalSettingsTable headings={["File", "Size", "Status", ""]}>
            {files.map(({ id, file }) => (
              <tr key={id} className="border-b border-by-border-engraved last:border-0">
                <td className={cell}>
                  <span className="break-all">{file.name}</span>
                </td>
                <td className={cell}>{bytesLabel(file.size)}</td>
                <td className={cell}>
                  {policy
                    ? (fileProblem(file, policy) ?? "Validated locally · not uploaded")
                    : "Not validated"}
                </td>
                <td className={cell}>
                  <Button
                    variant="ghost"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles((old) => old.filter((item) => item.id !== id))}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </LocalSettingsTable>
        ) : (
          <StateEmpty title="No files selected." body="Choose files or drop them above." />
        )}
      </div>
      <p role="status" className="type-ui-small text-by-text-secondary">
        {notice}
      </p>
      <p className="type-ui-small text-by-text-secondary">
        File transfer and analysis tracking aren’t available through the current upload service.
        Files stay on your device; no upload or analysis is claimed.
      </p>
      <ContextPanel title="Assign files">
        <div className="flex flex-col gap-6">
          {["Rep", "Account / opportunity", "Call type"].map((label) => (
            <div key={label}>
              <h2 className="type-ui-label">{label}</h2>
              <p className="type-ui-small mt-2 text-by-text-secondary">
                Assignment isn’t available yet.
              </p>
            </div>
          ))}
          <div className="rounded-by-card border border-by-border-engraved bg-by-surface-inset p-4">
            <h2 className="type-mono-micro text-by-text-tertiary">SPEAKERS</h2>
            <p className="type-ui-small mt-2">
              Speaker detection and labeling need the upload processing contract.
            </p>
          </div>
        </div>
      </ContextPanel>
    </section>
  );
}
