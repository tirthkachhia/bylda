import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { readyModeExtensionAction, readyModeExtensionQuery } from "@/lib/readymode-extension";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { RepPicker } from "./RepPicker";

export function ReadyModeExtensionSetup() {
  const { user, currentOrgId } = useAuth();
  const [repId, setRepId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const connection = useQuery(readyModeExtensionQuery(currentOrgId ?? "", user?.id ?? ""));
  async function change(action: "connect" | "disconnect") {
    if (!user || !currentOrgId || working) return;
    setWorking(true);
    setError("");
    try {
      const result = await readyModeExtensionAction(action, currentOrgId, repId ?? undefined);
      setCode(result.connection_code ?? "");
      await connection.refetch();
      toast.success(
        action === "connect" ? "Connection code created" : "Extension connection revoked",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection failed");
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-by-text-secondary">
        Import calls from the ReadyMode page open in Chrome. Review available transcripts or send
        recordings to Bylda for transcription.
      </p>
      <section className="space-y-2 rounded-xl border border-by-border-engraved p-4">
        <h3 className="text-sm font-semibold">1. Install the Chrome extension</h3>
        <Button variant="outline" size="sm" asChild>
          <a href="/downloads/bylda-readymode-extension.zip" download>
            <Download className="mr-2 size-4" />
            Download extension
          </a>
        </Button>
        <p className="text-xs text-by-text-secondary">
          Extract the ZIP. Open <code>chrome://extensions</code>, enable Developer mode, choose Load
          unpacked, and select the extracted folder containing manifest.json. Pin BYLDA to your
          toolbar.
        </p>
      </section>
      <section className="space-y-3 rounded-xl border border-by-border-engraved p-4">
        <h3 className="text-sm font-semibold">2. Connect this workspace</h3>
        {currentOrgId && user && (
          <>
            <p className="text-xs text-by-text-secondary">Assign imported calls to a rep.</p>
            <RepPicker
              organizationId={currentOrgId}
              userId={user.id}
              value={repId}
              onChange={setRepId}
            />
          </>
        )}
        <p className="text-xs text-by-text-secondary">
          Create a private code, then paste it into the extension. A new code replaces your previous
          connection. Codes expire after 30 days.
        </p>
        <Button
          size="sm"
          disabled={!repId || working || !currentOrgId || !user || connection.isPending}
          onClick={() => void change("connect")}
        >
          {working
            ? "Updating…"
            : connection.data?.connected
              ? "Replace connection code"
              : "Create connection code"}
        </Button>
        {code && (
          <>
            <label htmlFor="readymode-extension-code" className="block text-xs">
              Private connection code
            </label>
            <textarea
              id="readymode-extension-code"
              readOnly
              value={code}
              rows={3}
              className="w-full rounded border border-by-border-engraved bg-by-surface-raised p-2 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  toast.success("Connection code copied");
                } catch {
                  setError("Select the code and copy it manually.");
                }
              }}
            >
              <Copy className="mr-2 size-4" />
              Copy connection code
            </Button>
          </>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>
            {connection.isPending
              ? "Checking connection…"
              : connection.isError
                ? "Connection status unavailable"
                : connection.data?.connected
                  ? "Extension connection active"
                  : "No extension connected"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void connection.refetch()}
            disabled={connection.isFetching}
          >
            <RefreshCw className="mr-1 size-3" />
            Refresh
          </Button>
          {connection.data?.connected && (
            <Button
              variant="outline"
              size="sm"
              disabled={working}
              onClick={() => void change("disconnect")}
            >
              Revoke connection
            </Button>
          )}
        </div>
        <p className="text-[11px] text-by-text-secondary">
          This code can import calls into this workspace. Keep it private. Revoking it stops imports
          from every browser using that code.
        </p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </section>
      <section className="space-y-2 rounded-xl border border-by-border-engraved p-4">
        <h3 className="text-sm font-semibold">3. Pull your calls</h3>
        <p className="text-xs text-by-text-secondary">
          Open ReadyMode Call Logs and load the calls you want. Click BYLDA in Chrome, review the
          selected calls, confirm permission, and import. Keep the importer tab open until uploads
          finish.
        </p>
        <p className="text-xs text-by-text-secondary">
          The extension reads recordings and transcripts exposed on the page. If a download link is
          hidden, open or play the call first, or attach a downloaded recording or transcript in the
          importer.
        </p>
      </section>
    </div>
  );
}
