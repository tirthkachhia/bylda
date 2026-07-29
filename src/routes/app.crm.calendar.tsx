/**
 * CALENDAR & BOOKING — /app/crm/calendar
 *
 * Two views over Phase 1 tables:
 *  - Calendar: agenda of calendar_events with a "New Appointment" modal and
 *    status updates (confirm / complete / no-show / cancel).
 *  - Booking Pages: manage public self-serve booking_pages and share /book/[slug].
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, CalendarDays, Link2, Copy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CustomersNav } from "@/components/app/CustomersNav";

export const Route = createFileRoute("/app/crm/calendar")({ component: CalendarPage });

type Event = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  event_type: string;
  location: string | null;
  meeting_link: string | null;
  notes: string | null;
};

type BookingPage = {
  id: string;
  slug: string;
  title: string;
  duration_minutes: number;
  event_type: string;
  is_active: boolean;
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-[--info-light] text-[--info] border-blue-100",
  confirmed: "bg-[--accent-light] text-[--accent] border-violet-200",
  completed: "bg-[--success-light] text-[--success] border-green-100",
  no_show: "bg-[--warning-light] text-[--warning] border-amber-100",
  cancelled: "bg-[--danger-light] text-[--danger] border-red-100",
};

function CalendarPage() {
  const { currentOrgId } = useAuth();
  const [view, setView] = useState<"calendar" | "booking">("calendar");

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <CustomersNav />
        </div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--text-primary]">
            Calendar
          </h1>
        </div>
        <div className="mb-6 flex items-center gap-1 border-b border-[--border]">
          <button
            onClick={() => setView("calendar")}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
              view === "calendar"
                ? "border-[--accent] text-[--accent]"
                : "border-transparent text-[--text-secondary] hover:text-[--text-primary]"
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView("booking")}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
              view === "booking"
                ? "border-[--accent] text-[--accent]"
                : "border-transparent text-[--text-secondary] hover:text-[--text-primary]"
            }`}
          >
            Booking Pages
          </button>
        </div>

        {view === "calendar" ? (
          <CalendarView orgId={currentOrgId ?? null} />
        ) : (
          <BookingPagesView orgId={currentOrgId ?? null} />
        )}
      </div>
    </div>
  );
}

function CalendarView({ orgId }: { orgId: string | null }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time, status, event_type, location, meeting_link, notes")
      .eq("organization_id", orgId)
      .order("start_time", { ascending: true })
      .limit(500);
    setEvents((data as Event[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      const day = new Date(e.start_time).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return [...map.entries()];
  }, [events]);

  async function setStatus(id: string, status: string) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    await supabase.from("calendar_events").update({ status }).eq("id", id);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover]"
        >
          <Plus className="h-4 w-4" /> New Appointment
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[--bg-surface-2]" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
          <CalendarDays className="mb-3 h-8 w-8 text-[--accent]" />
          <p className="mb-1 text-sm font-semibold text-[--text-primary]">No appointments</p>
          <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
            Book a meeting or share a booking page so clients can self-schedule.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover]"
          >
            New Appointment
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                {day}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
                {items.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 border-b border-[--border] px-4 py-3.5 last:border-b-0 hover:bg-[--bg-surface-2]"
                  >
                    <span className="w-16 shrink-0 text-xs font-medium text-[--text-secondary]">
                      {new Date(e.start_time).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[--text-primary]">
                        {e.title}
                      </p>
                      <p className="truncate text-xs text-[--text-muted] capitalize">
                        {e.event_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[e.status] ?? STATUS_BADGE.scheduled}`}
                    >
                      {e.status.replace(/_/g, " ")}
                    </span>
                    <select
                      value={e.status}
                      onChange={(ev) => setStatus(e.id, ev.target.value)}
                      className="rounded-lg border border-[--border] bg-[--bg-surface] px-2 py-1 text-xs text-[--text-secondary] focus:outline-none"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="no_show">No show</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewAppointmentModal orgId={orgId} onClose={() => setShowNew(false)} onCreated={load} />
      )}
    </div>
  );
}

function NewAppointmentModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("appointment");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!orgId || !title.trim() || !start) return;
    setSaving(true);
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + duration * 60_000);
    await supabase.from("calendar_events").insert({
      organization_id: orgId,
      title: title.trim(),
      event_type: type,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
    });
    setSaving(false);
    onCreated();
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
        <h2 className="mb-4 text-[18px] font-semibold text-[--text-primary]">New Appointment</h2>
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
          />
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex-1 rounded-xl border border-[--border] bg-[--bg-surface] px-3 py-3 text-sm text-[--text-primary] focus:outline-none"
            >
              <option value="appointment">Appointment</option>
              <option value="call">Call</option>
              <option value="demo">Demo</option>
              <option value="follow_up">Follow-up</option>
              <option value="meeting">Meeting</option>
            </select>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="rounded-xl border border-[--border] bg-[--bg-surface] px-3 py-3 text-sm text-[--text-primary] focus:outline-none"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-[--border] px-5 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim() || !start}
            className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingPagesView({ orgId }: { orgId: string | null }) {
  const [pages, setPages] = useState<BookingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("booking_pages")
      .select("id, slug, title, duration_minutes, event_type, is_active")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setPages((data as BookingPage[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function toggle(p: BookingPage) {
    setPages((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from("booking_pages").update({ is_active: !p.is_active }).eq("id", p.id);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover]"
        >
          <Plus className="h-4 w-4" /> Create Booking Page
        </button>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-xl bg-[--bg-surface-2]" />
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
          <Link2 className="mb-3 h-8 w-8 text-[--accent]" />
          <p className="mb-1 text-sm font-semibold text-[--text-primary]">No booking pages</p>
          <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
            Create a public page so clients can book time with you.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover]"
          >
            Create Booking Page
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
          {pages.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 border-b border-[--border] px-4 py-4 last:border-b-0 hover:bg-[--bg-surface-2]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[--text-primary]">{p.title}</p>
                <p className="truncate text-xs text-[--text-muted]">
                  /book/{p.slug} · {p.duration_minutes} min
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${p.is_active ? "border-green-100 bg-[--success-light] text-[--success]" : "border-gray-200 bg-gray-100 text-gray-600"}`}
              >
                {p.is_active ? "Active" : "Off"}
              </span>
              <CopyButton path={`/book/${p.slug}`} />
              <button
                onClick={() => toggle(p)}
                className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary]"
              >
                {p.is_active ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewBookingPageModal orgId={orgId} onClose={() => setShowNew(false)} onCreated={load} />
      )}
    </div>
  );
}

function CopyButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 rounded-lg border border-[--border] px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary]"
    >
      <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Link"}
    </button>
  );
}

function NewBookingPageModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [duration, setDuration] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!orgId || !title.trim()) return;
    const finalSlug = (slug || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSaving(true);
    setError(null);
    const { error: insErr } = await supabase.from("booking_pages").insert({
      organization_id: orgId,
      slug: finalSlug,
      title: title.trim(),
      duration_minutes: duration,
    });
    setSaving(false);
    if (insErr) {
      setError(
        insErr.message.includes("duplicate")
          ? "That URL slug is taken — try another."
          : "Couldn't create page.",
      );
      return;
    }
    onCreated();
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
          Create Booking Page
        </h2>
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title (e.g. Discovery Call)"
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="url-slug (optional)"
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none"
          />
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] focus:outline-none"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </div>
        {error && <p className="mt-3 text-xs text-[--danger]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-[--border] px-5 py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover] disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
