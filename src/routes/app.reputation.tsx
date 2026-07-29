/**
 * REPUTATION — /app/reputation
 *
 * Review-request sending + tracking over the reputation_requests table (Phase 1).
 * Send a request (email/SMS) to a contact for a platform, and track its status.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Star, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/reputation")({ component: ReputationPage });

type Request = {
  id: string;
  contact_id: string | null;
  platform: string;
  channel: string;
  status: string;
  sent_at: string;
  reviewed_at: string | null;
};

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  sent: "bg-gray-100 text-gray-600 border-gray-200",
  opened: "bg-[--info-light] text-[--info] border-blue-100",
  clicked: "bg-[--warning-light] text-[--warning] border-amber-100",
  reviewed: "bg-[--success-light] text-[--success] border-green-100",
  ignored: "bg-[--danger-light] text-[--danger] border-red-100",
};

function ReputationPage() {
  const { currentOrgId } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("reputation_requests")
      .select("id, contact_id, platform, channel, status, sent_at, reviewed_at")
      .eq("organization_id", currentOrgId)
      .order("sent_at", { ascending: false })
      .limit(500);
    const list = (data as Request[]) ?? [];
    setRequests(list);

    const ids = [...new Set(list.map((r) => r.contact_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: cts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .in("id", ids);
      const map: Record<string, Contact> = {};
      for (const c of (cts as Contact[]) ?? []) map[c.id] = c;
      setContacts(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  const stats = useMemo(() => {
    const total = requests.length;
    const opened = requests.filter((r) =>
      ["opened", "clicked", "reviewed"].includes(r.status),
    ).length;
    const clicked = requests.filter((r) => ["clicked", "reviewed"].includes(r.status)).length;
    const reviewed = requests.filter((r) => r.status === "reviewed").length;
    const rate = total ? Math.round((reviewed / total) * 100) : 0;
    return { total, opened, clicked, reviewed, rate };
  }, [requests]);

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--text-primary]">
              Reputation
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">
              Request and track customer reviews.
            </p>
          </div>
          <button
            onClick={() => setShowSend(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover]"
          >
            <Plus className="h-4 w-4" /> Send Review Request
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Sent", stats.total],
            ["Opened", stats.opened],
            ["Clicked", stats.clicked],
            ["Reviewed", stats.reviewed],
            ["Conversion", `${stats.rate}%`],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="rounded-2xl border border-[--border] bg-[--bg-surface] p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                {label}
              </p>
              <p className="mt-1 text-xl font-bold text-[--text-primary]">{value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[--bg-surface-2]" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
            <Star className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--text-primary]">
              No review requests yet
            </p>
            <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
              Ask happy customers for a review on Google or Facebook and track responses here.
            </p>
            <button
              onClick={() => setShowSend(true)}
              className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover]"
            >
              Send Review Request
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[--border] text-left">
                  {["Contact", "Platform", "Channel", "Status", "Sent"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[--text-muted]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const c = r.contact_id ? contacts[r.contact_id] : null;
                  const name = c
                    ? [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Contact"
                    : "—";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[--border] last:border-b-0 hover:bg-[--bg-surface-2]"
                    >
                      <td className="px-4 py-3.5 text-sm text-[--text-primary]">{name}</td>
                      <td className="px-4 py-3.5 text-sm capitalize text-[--text-secondary]">
                        {r.platform}
                      </td>
                      <td className="px-4 py-3.5 text-sm uppercase text-[--text-secondary]">
                        {r.channel}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status] ?? STATUS_BADGE.sent}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[--text-muted]">
                        {new Date(r.sent_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSend && (
        <SendRequestModal
          orgId={currentOrgId ?? null}
          onClose={() => setShowSend(false)}
          onSent={load}
        />
      )}
    </div>
  );
}

function SendRequestModal({
  orgId,
  onClose,
  onSent,
}: {
  orgId: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [contactOptions, setContactOptions] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [platform, setPlatform] = useState("google");
  const [channel, setChannel] = useState("email");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    void supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setContactOptions((data as Contact[]) ?? []));
  }, [orgId]);

  async function send() {
    if (!orgId || !contactId) return;
    setSaving(true);
    await supabase.from("reputation_requests").insert({
      organization_id: orgId,
      contact_id: contactId,
      platform,
      channel,
      status: "sent",
    });
    setSaving(false);
    onSent();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[--bg-surface] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-[18px] font-semibold text-[--text-primary]">
          Send Review Request
        </h2>
        <div className="space-y-3">
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] focus:outline-none"
          >
            <option value="">Select a contact…</option>
            {contactOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Contact"}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="flex-1 rounded-xl border border-[--border] bg-[--bg-surface] px-3 py-3 text-sm text-[--text-primary] focus:outline-none"
            >
              <option value="google">Google</option>
              <option value="facebook">Facebook</option>
              <option value="yelp">Yelp</option>
              <option value="trustpilot">Trustpilot</option>
            </select>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="flex-1 rounded-xl border border-[--border] bg-[--bg-surface] px-3 py-3 text-sm text-[--text-primary] focus:outline-none"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-[--border] px-5 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary]"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={saving || !contactId}
            className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover] disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
