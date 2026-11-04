import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
type Key = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
export function ApiKeysSettings() {
  const { currentOrgId } = useAuth();
  const q = useQuery({
    queryKey: ["coaching-api-keys", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async (): Promise<Key[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("coaching_api_keys")
        .select("id,name,prefix,created_at,last_used_at,revoked_at")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [name, setName] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function action(action: string, id?: string) {
    setBusy(true);
    setError("");
    try {
      const r = await invokeEdge<{ token?: string }>(
        "coaching-api-keys",
        { organization_id: currentOrgId, action, name, id },
        { retries: 0 },
      );
      if (r.token) {
        setToken(r.token);
        setName("");
      }
      await q.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Key operation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h1>API keys</h1>
      <p className="text-xs">
        Owner/admin keys provide read-only access to calls and retained analyses in this workspace.
        100 rows per page, 120 requests per minute per key. Revocation takes effect immediately.
      </p>
      <label className="figma-field">
        Key name
        <input maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button
        className="figma-button"
        disabled={busy || !name.trim() || !!q.error}
        onClick={() => void action("create")}
      >
        Create API key
      </button>
      {token && (
        <div className="rounded border p-3">
          <p className="text-xs">Copy this key now. Only its hash is retained on the server.</p>
          <input
            className="my-2 w-full border p-2 font-mono text-xs"
            aria-label="New API key"
            readOnly
            value={token}
            onFocus={(e) => e.target.select()}
          />
          <button className="figma-button" onClick={() => setToken("")}>
            Dismiss key
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {q.error ? (
        <p role="alert">
          Keys could not load. Owner/admin access and the API-key migration are required.{" "}
          <button onClick={() => void q.refetch()}>Retry</button>
        </p>
      ) : (
        q.data?.map((k) => (
          <article key={k.id} className="rounded border p-3 text-xs">
            <p>
              {k.name} · {k.prefix}… · {k.revoked_at ? "Revoked" : "Active"}
            </p>
            <p>Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</p>
            {!k.revoked_at && (
              <button
                className="figma-button mt-2"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Revoke this API key?")) void action("revoke", k.id);
                }}
              >
                Revoke
              </button>
            )}
          </article>
        ))
      )}
      <pre className="overflow-auto rounded bg-by-surface-hover p-3 text-xs">
        GET {import.meta.env.VITE_SUPABASE_URL}/functions/v1/coaching-api?resource=calls
        {`\nAuthorization: Bearer YOUR_KEY\n\nresource=insights returns retained analysis runs.\nUse next_offset for the next page; call_id scopes results to one call.`}
      </pre>
    </section>
  );
}
