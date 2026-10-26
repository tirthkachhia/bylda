import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function SignupEmails() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["signup-email-admin"],
    queryFn: async () => {
      const [status, preferences, queue] = await Promise.all([
        supabase.functions.invoke("signup-email", { body: { action: "status" } }),
        supabase
          .from("signup_email_preferences" as never)
          .select("user_id,marketing")
          .eq("marketing", true),
        supabase
          .from("signup_email_queue" as never)
          .select("id,subject,kind,status,created_at,error")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (status.error || preferences.error || queue.error)
        throw new Error(
          "Unable to load email settings. Check administrator access and backend deployment.",
        );
      return {
        status: status.data,
        subscribers: preferences.data?.length || 0,
        queue: queue.data as unknown as Array<{
          id: string;
          subject: string;
          kind: string;
          status: string;
          created_at: string;
          error: string | null;
        }>,
      };
    },
  });
  async function act(process: boolean) {
    setBusy(true);
    setMessage("");
    try {
      if (process) {
        const { data, error } = await supabase.functions.invoke("signup-email", {
          body: { action: "process" },
        });
        if (error || data?.error) throw new Error(data?.error || "Email processing failed");
        setMessage(
          `${data.accepted} accepted by provider; ${data.failed} failed; ${data.skipped} skipped. Provider acceptance does not confirm inbox delivery.`,
        );
      } else {
        const { data, error } = await supabase.rpc(
          "queue_signup_update" as never,
          { email_subject: subject, email_body: body } as never,
        );
        if (error) throw error;
        setMessage(`${data} emails queued for opted-in, verified signup users.`);
        setConfirm(false);
        setSubject("");
        setBody("");
      }
      await query.refetch();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 p-5">
      <h2 className="text-xl font-semibold">Signup emails</h2>
      <p>
        Welcome emails are queued after email verification. Product updates go only to people who
        opted in—not CRM contacts.
      </p>
      {query.isPending && <p>Loading…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data && (
        <>
          <p>
            {query.data.subscribers} opted-in users.{" "}
            {query.data.status.ready
              ? "Sender configured."
              : "Delivery disabled. Missing: " + query.data.status.missing.join(", ")}
          </p>
          <label className="block">
            Subject
            <input
              className="mt-1 block w-full rounded border bg-background p-3"
              maxLength={200}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setConfirm(false);
              }}
            />
          </label>
          <label className="block">
            Message
            <textarea
              className="mt-1 block w-full rounded border bg-background p-3"
              rows={7}
              maxLength={20000}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setConfirm(false);
              }}
            />
          </label>
          <p className="text-sm">
            Plain-text email. Your sender address and unsubscribe link are added automatically.
          </p>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            I reviewed this message and want to email the opted-in signup audience.
          </label>
          <div className="flex gap-3">
            <button
              className="rounded bg-primary p-3 text-primary-foreground disabled:opacity-40"
              disabled={
                busy || !confirm || !subject.trim() || !body.trim() || !query.data.status.ready
              }
              onClick={() => void act(false)}
            >
              Queue update
            </button>
            <button
              className="rounded border p-3 disabled:opacity-40"
              disabled={busy || !query.data.status.ready}
              onClick={() => void act(true)}
            >
              Process next 10 queued emails
            </button>
          </div>
          <h3 className="font-semibold">Latest 50 messages</h3>
          {!query.data.queue.length && <p>No emails queued yet.</p>}
          {query.data.queue.map((row) => (
            <div key={row.id} className="rounded border p-3">
              <strong>{row.subject}</strong>
              <p>
                {row.kind} · {row.status} · {new Date(row.created_at).toLocaleString()}
              </p>
              {row.error && <p>{row.error}</p>}
            </div>
          ))}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function SignupEmailPreference() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["signup-email-preference"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase
        .from("signup_email_preferences" as never)
        .select("marketing")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return !!(data as unknown as { marketing: boolean } | null)?.marketing;
    },
  });
  return (
    <section className="rounded border p-4">
      <h2 className="font-semibold">Email notifications</h2>
      <p>Account emails are separate from optional product updates.</p>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={query.data || false}
          disabled={busy || query.isPending || query.isError}
          onChange={async (e) => {
            setBusy(true);
            setMessage("");
            const { error } = await supabase.rpc(
              "set_signup_email_preference" as never,
              { enabled: e.target.checked } as never,
            );
            setMessage(error ? "Could not save preference." : "Email preference saved.");
            await query.refetch();
            setBusy(false);
          }}
        />
        Send me Bylda updates and tips
      </label>
      {query.isError && <p>Unable to load preference.</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
