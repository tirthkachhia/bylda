/**
 * PUBLIC FORM — /f/[formId]
 *
 * Renders a published lead-capture form (forms.is_active = true is public-readable)
 * and writes a row to form_submissions (public insert allowed). No app chrome,
 * no auth. Used as an embeddable / shareable capture page.
 */
import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/f/$formId")({ component: PublicForm });

type Field = { id: string; type: string; label: string; required: boolean; placeholder?: string };
type FormRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  fields: Field[];
  submit_message: string | null;
  is_active: boolean;
};

function PublicForm() {
  const { formId } = useParams({ from: "/f/$formId" });
  const [form, setForm] = useState<FormRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from("forms")
      .select("id, organization_id, name, description, fields, submit_message, is_active")
      .eq("id", formId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        setForm((data as FormRow) ?? null);
        setLoading(false);
      });
  }, [formId]);

  async function submit() {
    if (!form) return;
    const missing = form.fields.filter((f) => f.required && !values[f.id]?.trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setError(null);
    setSubmitting(true);

    // Map field labels → values for a readable submission payload.
    const data: Record<string, string> = {};
    for (const f of form.fields) data[f.label] = values[f.id] ?? "";

    const { error: insErr } = await supabase.from("form_submissions").insert({
      form_id: form.id,
      organization_id: form.organization_id,
      data,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    setSubmitting(false);
    if (insErr) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setDone(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[--bg-page]">
        <div className="h-40 w-full max-w-md animate-pulse rounded-2xl bg-[--bg-surface-2]" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[--bg-page] px-4">
        <div className="rounded-2xl border border-[--border] bg-[--bg-surface] p-8 text-center">
          <p className="text-sm font-semibold text-[--text-primary]">Form not found</p>
          <p className="mt-1 text-xs text-[--text-muted]">
            This form may be unpublished or removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[--bg-page] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[--border] bg-[--bg-surface] p-6 shadow-sm sm:p-8">
        {done ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[--success-light] text-2xl">
              ✓
            </div>
            <p className="text-sm font-semibold text-[--text-primary]">
              {form.submit_message || "Thank you!"}
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold tracking-[-0.02em] text-[--text-primary]">
              {form.name}
            </h1>
            {form.description && (
              <p className="mt-1 text-sm text-[--text-secondary]">{form.description}</p>
            )}
            <div className="mt-6 space-y-4">
              {form.fields.map((f) => (
                <div key={f.id}>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                    {f.label}
                    {f.required && <span className="text-[--danger]"> *</span>}
                  </label>
                  {f.type === "long_text" ? (
                    <textarea
                      rows={3}
                      value={values[f.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      className="w-full resize-none rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
                    />
                  ) : f.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm text-[--text-secondary]">
                      <input
                        type="checkbox"
                        checked={values[f.id] === "yes"}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.id]: e.target.checked ? "yes" : "" }))
                        }
                      />
                      {f.placeholder || "Yes"}
                    </label>
                  ) : (
                    <input
                      type={
                        f.type === "email"
                          ? "email"
                          : f.type === "phone"
                            ? "tel"
                            : f.type === "number"
                              ? "number"
                              : f.type === "date"
                                ? "date"
                                : "text"
                      }
                      value={values[f.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
                    />
                  )}
                </div>
              ))}
            </div>
            {error && <p className="mt-3 text-xs text-[--danger]">{error}</p>}
            <button
              onClick={submit}
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-[--accent] px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover] disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
