/**
 * CAMPAIGNS — /app/crm/campaigns
 *
 * Email / SMS broadcast campaigns over the campaigns table (Phase 1).
 * List + builder: name, channel, audience filter (with a live estimated
 * recipient count from contacts), content, and save-draft / schedule.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, ArrowLeft, Mail, MessageSquare, Megaphone, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";

export const Route = createFileRoute("/app/crm/campaigns")({ component: CampaignsPage });

type Campaign = {
  id: string;
  name: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string | null;
  audience_filter: Record<string, unknown>;
  status: string;
  recipient_count: number;
  open_count: number;
  click_count: number;
  unsubscribe_count: number;
  sent_at: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  scheduled: "bg-[--warning-light] text-[--warning] border-amber-100",
  sending: "bg-[--info-light] text-[--info] border-blue-100",
  sent: "bg-[--success-light] text-[--success] border-green-100",
  cancelled: "bg-[--danger-light] text-[--danger] border-red-100",
};

function CampaignsPage() {
  const { user, currentOrgId } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [reporting, setReporting] = useState<Campaign | null>(null);
  const [tab, setTab] = useState<"all" | "email" | "sms" | "draft" | "sent">("all");

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("campaigns")
      .select(
        "id, name, channel, subject, body, audience_filter, status, recipient_count, open_count, click_count, unsubscribe_count, sent_at",
      )
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  const filtered = useMemo(
    () =>
      campaigns.filter((c) =>
        tab === "all"
          ? true
          : tab === "email" || tab === "sms"
            ? c.channel === tab
            : c.status === tab,
      ),
    [campaigns, tab],
  );

  async function remove(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("campaigns").delete().eq("id", id);
  }

  if (editing) {
    return (
      <CampaignBuilder
        initial={editing === "new" ? null : editing}
        orgId={currentOrgId ?? null}
        userId={user?.id ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--text-primary]">
              Campaigns
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">{campaigns.length} campaigns</p>
          </div>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover]"
          >
            <Plus className="h-4 w-4" /> New Campaign
          </button>
        </div>

        <div className="mb-4 flex gap-1">
          {(["all", "email", "sms", "draft", "sent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-[--accent-light] text-[--accent]"
                  : "text-[--text-muted] hover:text-[--text-primary]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[--bg-surface-2]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
            <Megaphone className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--text-primary]">No campaigns yet</p>
            <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
              Broadcast email or SMS to a filtered segment of your contacts.
            </p>
            <button
              onClick={() => setEditing("new")}
              className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover]"
            >
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
            {filtered.map((c) => {
              const Icon = c.channel === "sms" ? MessageSquare : Mail;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 border-b border-[--border] px-4 py-4 last:border-b-0 hover:bg-[--bg-surface-2]"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[--text-muted]" />
                  <button onClick={() => setEditing(c)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-[--text-primary]">{c.name}</p>
                    <p className="truncate text-xs text-[--text-muted] capitalize">
                      {c.channel} · {c.recipient_count} recipients
                    </p>
                  </button>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[c.status] ?? STATUS_BADGE.draft}`}
                  >
                    {c.status}
                  </span>
                  {(c.status === "sent" || c.status === "sending") && (
                    <button
                      onClick={() => setReporting(c)}
                      className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary]"
                    >
                      Report
                    </button>
                  )}
                  <button
                    onClick={() => remove(c.id)}
                    className="rounded-lg p-1.5 text-[--text-muted] hover:text-[--danger]"
                    aria-label="Delete campaign"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reporting && <CampaignReport campaign={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}

function CampaignBuilder({
  initial,
  orgId,
  userId,
  onClose,
  onSaved,
}: {
  initial: Campaign | null;
  orgId: string | null;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<"email" | "sms">(initial?.channel ?? "email");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [bodyText, setBodyText] = useState(initial?.body ?? "");
  const [tagFilter, setTagFilter] = useState((initial?.audience_filter?.tag as string) ?? "");
  const [statusFilter, setStatusFilter] = useState(
    (initial?.audience_filter?.status as string) ?? "",
  );
  const [estimate, setEstimate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Live recipient estimate from contacts (contacts uses org_id).
  useEffect(() => {
    if (!orgId) return;
    let active = true;
    let q = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);
    if (statusFilter) q = q.eq("status", statusFilter);
    if (tagFilter) q = q.contains("tags", [tagFilter]);
    void q.then(({ count }) => {
      if (active) setEstimate(count ?? 0);
    });
    return () => {
      active = false;
    };
  }, [orgId, tagFilter, statusFilter]);

  async function persist(status: "draft" | "scheduled"): Promise<string | null> {
    if (!orgId || !userId || !name.trim()) return null;
    const payload = {
      organization_id: orgId,
      created_by: userId,
      name: name.trim(),
      channel,
      subject: channel === "email" ? subject : null,
      body: bodyText,
      audience_filter: {
        ...(tagFilter ? { tag: tagFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      status,
      recipient_count: estimate ?? 0,
    };
    if (initial) {
      await supabase.from("campaigns").update(payload).eq("id", initial.id);
      return initial.id;
    }
    const { data } = await supabase.from("campaigns").insert(payload).select("id").single();
    return (data?.id as string) ?? null;
  }

  async function save(status: "draft" | "scheduled") {
    if (!name.trim()) return;
    setSaving(true);
    await persist(status);
    setSaving(false);
    onSaved();
  }

  async function sendNow() {
    if (!name.trim()) return;
    setSaving(true);
    setSendResult(null);
    const id = await persist("scheduled");
    if (!id) {
      setSaving(false);
      return;
    }
    try {
      const res = await invokeEdge<{ sent: number; recipients: number }>(
        "send-campaign",
        { campaign_id: id },
        { timeoutMs: 120_000 },
      );
      setSendResult(`Sent to ${res.sent}/${res.recipients} recipients.`);
      setTimeout(onSaved, 1200);
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={onClose}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[--text-muted] hover:text-[--text-primary]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </button>

        <div className="space-y-5 rounded-2xl border border-[--border] bg-[--bg-surface] p-5 shadow-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
          />

          <div className="flex gap-2">
            {(["email", "sms"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  channel === ch
                    ? "border-[--accent] bg-[--accent-light] text-[--accent]"
                    : "border-[--border] text-[--text-secondary] hover:border-[--border-strong]"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Audience */}
          <div className="rounded-xl border border-[--border] bg-[--bg-surface-2] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
              Audience
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Has tag…"
                className="flex-1 rounded-lg border border-[--border] bg-[--bg-surface] px-3 py-2 text-xs text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[--border] bg-[--bg-surface] px-3 py-2 text-xs text-[--text-primary] focus:outline-none"
              >
                <option value="">Any status</option>
                <option value="new">New</option>
                <option value="active">Active</option>
                <option value="qualified">Qualified</option>
                <option value="churned">Churned</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-[--text-secondary]">
              Estimated recipients:{" "}
              <span className="font-semibold text-[--text-primary]">{estimate ?? "…"}</span>
            </p>
          </div>

          {/* Content */}
          {channel === "email" && (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line (use {{first_name}})"
              className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none"
            />
          )}
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={channel === "sms" ? 3 : 7}
            placeholder={
              channel === "sms" ? "Text message (160 chars per segment)…" : "Email body…"
            }
            className="w-full resize-none rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
          />
          {channel === "sms" && (
            <p className="-mt-3 text-xs text-[--text-muted]">
              {bodyText.length} chars · {Math.max(1, Math.ceil(bodyText.length / 160))} segment(s)
            </p>
          )}

          {sendResult && (
            <div className="rounded-xl border border-[--border] bg-[--bg-surface-2] px-4 py-3 text-xs text-[--text-secondary]">
              {sendResult}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-[--border] pt-4">
            <button
              onClick={() => save("draft")}
              disabled={saving || !name.trim()}
              className="rounded-xl border border-[--border] px-5 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => save("scheduled")}
              disabled={saving || !name.trim() || !bodyText.trim()}
              className="rounded-xl border border-[--border] px-5 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50"
            >
              Schedule
            </button>
            <button
              onClick={sendNow}
              disabled={saving || !name.trim() || !bodyText.trim()}
              className="ml-auto rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover] disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Campaign report: headline engagement stats plus a contact-level breakdown of
// who opened / clicked, read from campaign_events (populated by track-event).
function CampaignReport({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const [rows, setRows] = useState<
    | null
    | {
        contact: string;
        opened: boolean;
        clicked: boolean;
        unsubscribed: boolean;
      }[]
  >(null);

  useEffect(() => {
    let active = true;
    // campaign_events post-dates the generated types; use an untyped client here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .from("campaign_events")
      .select("type, contact_id, contacts(first_name, last_name, email)")
      .eq("campaign_id", campaign.id)
      .then(({ data }: { data: unknown }) => {
        if (!active) return;
        const byContact = new Map<
          string,
          { contact: string; opened: boolean; clicked: boolean; unsubscribed: boolean }
        >();
        for (const e of (data as unknown[] as Array<{
          type: string;
          contact_id: string | null;
          contacts: {
            first_name: string | null;
            last_name: string | null;
            email: string | null;
          } | null;
        }>) ?? []) {
          const key = e.contact_id ?? "unknown";
          const name =
            [e.contacts?.first_name, e.contacts?.last_name].filter(Boolean).join(" ") ||
            e.contacts?.email ||
            "Contact";
          const cur = byContact.get(key) ?? {
            contact: name,
            opened: false,
            clicked: false,
            unsubscribed: false,
          };
          if (e.type === "open") cur.opened = true;
          if (e.type === "click") cur.clicked = true;
          if (e.type === "unsubscribe") cur.unsubscribed = true;
          byContact.set(key, cur);
        }
        setRows([...byContact.values()]);
      });
    return () => {
      active = false;
    };
  }, [campaign.id]);

  const openRate = campaign.recipient_count
    ? Math.round((campaign.open_count / campaign.recipient_count) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full overflow-y-auto bg-[--bg-surface] shadow-[-8px_0_32px_rgba(0,0,0,0.08)] sm:w-[440px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[--border] px-5 py-4">
          <p className="text-[15px] font-semibold text-[--text-primary]">
            {campaign.name} — Report
          </p>
          <button onClick={onClose} className="text-[--text-muted] hover:text-[--text-primary]">
            ✕
          </button>
        </div>
        <div className="p-5">
          <div className="mb-5 grid grid-cols-2 gap-3">
            {[
              ["Recipients", campaign.recipient_count],
              ["Opened", `${campaign.open_count} (${openRate}%)`],
              ["Clicked", campaign.click_count],
              ["Unsubscribed", campaign.unsubscribe_count],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-xl border border-[--border] bg-[--bg-surface-2] p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[--text-muted]">
                  {label}
                </p>
                <p className="mt-1 text-lg font-bold text-[--text-primary]">{value}</p>
              </div>
            ))}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
            Engagement
          </p>
          {rows === null ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-[--bg-surface-2]" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-[--text-muted]">
              No opens or clicks recorded yet. Engagement appears here as recipients interact.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-[--border] bg-[--bg-surface-2] px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-[--text-primary]">{r.contact}</span>
                  {r.opened && (
                    <span className="rounded-full border border-blue-100 bg-[--info-light] px-2 py-0.5 text-[10px] font-semibold text-[--info]">
                      opened
                    </span>
                  )}
                  {r.clicked && (
                    <span className="rounded-full border border-green-100 bg-[--success-light] px-2 py-0.5 text-[10px] font-semibold text-[--success]">
                      clicked
                    </span>
                  )}
                  {r.unsubscribed && (
                    <span className="rounded-full border border-red-100 bg-[--danger-light] px-2 py-0.5 text-[10px] font-semibold text-[--danger]">
                      unsubscribed
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
