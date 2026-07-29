/**
 * PUBLIC BOOKING — /book/[slug]
 *
 * Self-serve scheduling page. Reads the active booking_page (public-readable),
 * generates time slots from its availability, and books through the
 * book-appointment edge function (service-role insert into calendar_events).
 * No auth, no app chrome.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
import { nextDays, slotsFor } from "@/lib/booking";

export const Route = createFileRoute("/book/$slug")({ component: PublicBooking });

type BookingPage = {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  available_days: number[];
  available_start: string;
  available_end: string;
  confirmation_message: string | null;
};

function PublicBooking() {
  const { slug } = useParams({ from: "/book/$slug" });
  const [page, setPage] = useState<BookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from("booking_pages")
      .select(
        "id, organization_id, slug, title, description, duration_minutes, available_days, available_start, available_end, confirmation_message",
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        setPage((data as BookingPage) ?? null);
        setLoading(false);
      });
  }, [slug]);

  const days = useMemo(
    () =>
      page ? nextDays(10, page.available_days?.length ? page.available_days : [1, 2, 3, 4, 5]) : [],
    [page],
  );
  const slots = useMemo(
    () =>
      page && day
        ? slotsFor(
            day,
            page.available_start || "09:00",
            page.available_end || "17:00",
            page.duration_minutes || 30,
          )
        : [],
    [page, day],
  );

  async function book() {
    if (!page || !slot || !name.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await invokeEdge<{ message: string }>(
        "book-appointment",
        { slug: page.slug, name, email, phone, notes, start_time: slot.toISOString() },
        { skipAuth: true },
      );
      setConfirmation(res.message || page.confirmation_message || "Your appointment is booked.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book. Try another time.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[--bg-page]">
        <div className="h-64 w-full max-w-lg animate-pulse rounded-2xl bg-[--bg-surface-2]" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[--bg-page] px-4">
        <div className="rounded-2xl border border-[--border] bg-[--bg-surface] p-8 text-center">
          <p className="text-sm font-semibold text-[--text-primary]">Booking page unavailable</p>
          <p className="mt-1 text-xs text-[--text-muted]">This link may be disabled or removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[--bg-page] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-[--border] bg-[--bg-surface] p-6 shadow-sm sm:p-8">
        {confirmation ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[--success-light] text-2xl">
              ✓
            </div>
            <p className="text-sm font-semibold text-[--text-primary]">{confirmation}</p>
            {slot && (
              <p className="mt-1 text-xs text-[--text-muted]">
                {slot.toLocaleString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold tracking-[-0.02em] text-[--text-primary]">
              {page.title}
            </h1>
            {page.description && (
              <p className="mt-1 text-sm text-[--text-secondary]">{page.description}</p>
            )}
            <p className="mt-1 text-xs text-[--text-muted]">{page.duration_minutes} minutes</p>

            {/* Day picker */}
            <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
              Pick a day
            </p>
            <div className="flex flex-wrap gap-2">
              {days.map((d) => {
                const selected = day?.toDateString() === d.toDateString();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => {
                      setDay(d);
                      setSlot(null);
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      selected
                        ? "border-[--accent] bg-[--accent-light] text-[--accent]"
                        : "border-[--border] text-[--text-secondary] hover:border-[--border-strong]"
                    }`}
                  >
                    {d.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </button>
                );
              })}
            </div>

            {/* Slot picker */}
            {day && (
              <>
                <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                  Pick a time
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => {
                    const selected = slot?.getTime() === s.getTime();
                    return (
                      <button
                        key={s.toISOString()}
                        onClick={() => setSlot(s)}
                        className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                          selected
                            ? "border-[--accent] bg-[--accent-light] text-[--accent]"
                            : "border-[--border] text-[--text-secondary] hover:border-[--border-strong]"
                        }`}
                      >
                        {s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Details */}
            {slot && (
              <div className="mt-5 space-y-3 border-t border-[--border] pt-5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name *"
                  className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email *"
                  className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none"
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Anything we should know? (optional)"
                  className="w-full resize-none rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none"
                />
                {error && <p className="text-xs text-[--danger]">{error}</p>}
                <button
                  onClick={book}
                  disabled={submitting || !name.trim() || !email.trim()}
                  className="w-full rounded-xl bg-[--accent] px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover] disabled:opacity-50"
                >
                  {submitting ? "Booking…" : "Confirm Booking"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
