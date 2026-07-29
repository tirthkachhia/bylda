/**
 * PreBriefedToolLauncher — kills the retype problem.
 *
 * Wraps a tool's input form. Fields Bylda already knows (pre-briefed from
 * the Business Context Graph + workspace profile — the exact same prefill
 * pipeline `run-tool` context assembly draws from, reused not refetched)
 * render as read-only rows in a dashed "BYLDA KNOWS" panel. Each row has an
 * edit affordance that reveals an inline editable field only when clicked —
 * a briefed field never renders as an empty required textbox.
 *
 * Only fields with no known value render as inputs. The parent's run button
 * should use `briefedButtonLabel()` so its copy reflects the live count and
 * business_context revision.
 */

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export type LauncherFieldType = "text" | "textarea" | "select" | "number";
export interface LauncherFieldDef {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  type: LauncherFieldType;
  options?: string[];
  required?: boolean;
}

interface PreBriefedToolLauncherProps {
  fieldDefs: LauncherFieldDef[];
  fields: Record<string, string>;
  setField: (key: string, value: string) => void;
  /** business_context.version — null when no context row exists yet */
  revision: number | null;
  /**
   * Optional extra brief line shown in the panel header — e.g. when the
   * launch was chained from a finished run ("+ output from your Idea
   * Validation run"). Purely informational; the server-side chaining is
   * driven by ?fromRun=, not this label.
   */
  carryNote?: string;
}

export function briefedButtonLabel(
  fieldDefs: LauncherFieldDef[],
  fields: Record<string, string>,
  revision: number | null,
): string {
  const missing = fieldDefs.filter((f) => f.required && !(fields[f.key] ?? "").trim()).length;
  const fill =
    missing === 0 ? "0 fields to fill" : `${missing} field${missing === 1 ? "" : "s"} to fill`;
  return revision ? `${fill} — briefed from Revision ${revision}` : fill;
}

function FieldInput({
  def,
  value,
  onChange,
  autoFocus,
}: {
  def: LauncherFieldDef;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  if (def.type === "textarea")
    return (
      <Textarea
        rows={4}
        autoFocus={autoFocus}
        placeholder={def.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resize-none rounded-none border-line bg-panel font-bp-mono text-[12.5px] text-ink"
      />
    );
  if (def.type === "select")
    return (
      <select
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-line bg-panel px-3 py-2 font-bp-mono text-[12.5px] text-ink outline-none"
      >
        <option value="">Select {def.label.toLowerCase()}…</option>
        {def.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  return (
    <Input
      type={def.type === "number" ? "number" : "text"}
      autoFocus={autoFocus}
      placeholder={def.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-none border-line bg-panel font-bp-mono text-[12.5px] text-ink"
    />
  );
}

export function PreBriefedToolLauncher({
  fieldDefs,
  fields,
  setField,
  revision,
  carryNote,
}: PreBriefedToolLauncherProps) {
  const [editing, setEditing] = useState<Set<string>>(new Set());

  const briefed = fieldDefs.filter((f) => (fields[f.key] ?? "").trim().length > 0);
  const missing = fieldDefs.filter((f) => !(fields[f.key] ?? "").trim());

  const toggleEdit = (key: string) =>
    setEditing((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-5">
      {/* ── BYLDA KNOWS — pre-briefed context, read-only until edited ── */}
      {briefed.length > 0 && (
        <div className="border border-dashed border-blueprint-signal bg-blueprint-signal-soft">
          <div className="flex items-center justify-between border-b border-dashed border-blueprint-signal px-4 py-2">
            <span className="font-bp-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-blueprint-signal">
              Bylda knows
            </span>
            <span className="font-bp-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-dim">
              {revision ? `Rev ${revision}` : "workspace profile"} · {briefed.length} field
              {briefed.length === 1 ? "" : "s"} briefed
            </span>
          </div>
          {carryNote && (
            <div className="border-b border-dashed border-blueprint-signal/50 px-4 py-1.5 font-bp-mono text-[9.5px] uppercase tracking-[0.1em] text-blueprint-signal">
              + {carryNote}
            </div>
          )}
          <ul className="divide-y divide-line/60">
            {briefed.map((def) => {
              const isEditing = editing.has(def.key);
              return (
                <li key={def.key} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bp-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                        {def.label}
                      </div>
                      {isEditing ? (
                        <div className="mt-1.5">
                          <FieldInput
                            def={def}
                            value={fields[def.key] ?? ""}
                            onChange={(v) => setField(def.key, v)}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink">
                          {fields[def.key]}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleEdit(def.key)}
                      aria-expanded={isEditing}
                      aria-label={isEditing ? `Done editing ${def.label}` : `Edit ${def.label}`}
                      className="inline-flex shrink-0 items-center gap-1 border border-line bg-panel px-2 py-1 font-bp-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-ink-dim transition-colors hover:border-blueprint-signal hover:text-blueprint-signal"
                    >
                      {isEditing ? (
                        <>
                          <Check className="h-3 w-3" aria-hidden="true" /> Done
                        </>
                      ) : (
                        <>
                          <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Fields Bylda genuinely doesn't know yet ── */}
      {missing.map((def) => (
        <div key={def.key}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="font-tech text-[12px] font-semibold text-ink">
              {def.label}
              {!def.required && (
                <span className="ml-1.5 font-bp-mono text-[9.5px] font-normal uppercase text-ink-faint">
                  optional
                </span>
              )}
            </span>
            {def.hint && <span className="text-[10.5px] text-ink-dim">{def.hint}</span>}
          </div>
          <FieldInput
            def={def}
            value={fields[def.key] ?? ""}
            onChange={(v) => setField(def.key, v)}
          />
        </div>
      ))}
    </div>
  );
}
