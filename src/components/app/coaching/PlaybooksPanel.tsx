/**
 * PlaybooksPanel — manager-authored sales playbooks that analyze-call judges reps
 * against. Lives on the Calls & coaching page. Each save creates an immutable
 * version; Restore re-saves an older version's text as a new version, so history
 * is linear and nothing is lost.
 */
import { useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, History, Loader2, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  archivePlaybook,
  createPlaybook,
  extractPlaybookGuidelines,
  playbooksQuery,
  playbookVersionsQuery,
  savePlaybookVersion,
} from "@/lib/queries";
import { GuidelinesList } from "@/components/app/coaching/GuidelinesList";
import type { Playbook } from "@/lib/coaching/types";

const MAX_CHARS = 12000;

const PLACEHOLDER = `Describe the sales process your reps should follow. For example:

1. Open by confirming who you are speaking with and why you're calling.
2. Discovery before pitching: ask about current coverage, budget, and timeline.
3. Present no more than two options, anchored to what the customer said.
4. Handle objections by acknowledging, clarifying, then answering with a fact.
5. Never claim regulatory urgency or guarantee approval.
6. Close with a specific next step, date, and time.`;

function formatWhen(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PlaybooksPanel() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const playbooksQ = useQuery({ ...playbooksQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const playbooks = playbooksQ.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"Playbook" | "Guidelines" | "Versions">("Playbook");

  const selected: Playbook | null =
    (selectedId && playbooks.find((p) => p.id === selectedId)) || null;
  const versionsQ = useQuery({
    ...playbookVersionsQuery(selected?.id ?? ""),
    enabled: !!selected?.id,
  });

  // Load the selected playbook's current text into the editor when the selection or
  // its current version changes. Keyed on ids, not object identity, so a background
  // refetch of the same data never clobbers unsaved edits.
  const selectedKey = creating
    ? "new"
    : selected
      ? `${selected.id}:${selected.current?.id ?? ""}`
      : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (selectedKey !== loadedKey) {
    setLoadedKey(selectedKey);
    if (!creating) {
      setContent(selected?.current?.content ?? "");
      setName(selected?.name ?? "");
      setChangeNote("");
    }
  }

  const refresh = async (playbookId?: string) => {
    await qc.invalidateQueries({ queryKey: ["playbooks", currentOrgId] });
    if (playbookId) await qc.invalidateQueries({ queryKey: ["playbook-versions", playbookId] });
  };

  // Every saved version gets its behavior checklist. A failure here leaves the
  // version saved; the list shows an Extract button to retry.
  async function extractFor(versionId: string) {
    try {
      const res = await extractPlaybookGuidelines(versionId);
      await qc.invalidateQueries({ queryKey: ["playbook-guidelines", versionId] });
      toast.success(`${res.guidelines.length} guidelines extracted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not extract guidelines");
    }
  }

  const dirty = creating
    ? !!name.trim() || !!content.trim()
    : !!selected && content.trim() !== (selected.current?.content ?? "").trim();
  useBlocker({
    shouldBlockFn: () =>
      dirty && !busy && !window.confirm("Discard your unsaved playbook changes?"),
    enableBeforeUnload: dirty && !busy,
  });

  async function save() {
    if (!currentOrgId || !user || busy || !content.trim() || (creating && !name.trim())) return;
    setBusy(true);
    try {
      if (creating) {
        const created = await createPlaybook(currentOrgId, user.id, name, content);
        await refresh(created.id);
        setCreating(false);
        setSelectedId(created.id);
        toast.success(`Playbook "${created.name}" created`);
        if (created.current_version_id) await extractFor(created.current_version_id);
      } else if (selected) {
        const version = await savePlaybookVersion(selected, user.id, content, changeNote);
        await refresh(selected.id);
        toast.success(`Saved as version ${version.version}`);
        await extractFor(version.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save playbook");
    } finally {
      setBusy(false);
    }
  }

  async function restore(versionNumber: number, versionContent: string) {
    if (!selected || !user || busy) return;
    setBusy(true);
    try {
      const version = await savePlaybookVersion(
        selected,
        user.id,
        versionContent,
        `Restored from v${versionNumber}`,
      );
      await refresh(selected.id);
      toast.success(`Restored v${versionNumber} as version ${version.version}`);
      await extractFor(version.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore version");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!selected || busy) return;
    if (
      !window.confirm(
        `Archive "${selected.name}"? Historical analyses retain their version. Future calls use the remaining playbook assignment/default rules.`,
      )
    )
      return;
    setBusy(true);
    try {
      await archivePlaybook(selected.id);
      await refresh();
      setSelectedId(null);
      toast.success("Playbook archived");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not archive playbook");
    } finally {
      setBusy(false);
    }
  }

  if (!currentOrgId) return null;

  const leave = () => {
    if (dirty && !window.confirm("Discard your unsaved playbook changes?")) return;
    setCreating(false);
    setSelectedId(null);
    setTab("Playbook");
  };
  const newPlaybook = () => {
    setCreating(true);
    setSelectedId(null);
    setName("");
    setContent("");
    setChangeNote("");
    setTab("Playbook");
  };
  return (
    <section className="space-y-5" data-design-screen="methodology">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {(selected || creating) && (
            <button
              type="button"
              disabled={busy}
              onClick={leave}
              className="mb-3 flex items-center gap-2 text-xs text-by-text-secondary"
            >
              <ArrowLeft size={14} /> All playbooks
            </button>
          )}
          <h1 className="text-xl">
            {creating ? "New playbook" : (selected?.name ?? "Methodology")}
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-by-text-secondary">
            {selected
              ? `Version ${selected.current?.version ?? "unknown"} · updated ${formatWhen(selected.updated_at)}`
              : "How your team sells. Calls are judged against the recorded playbook version."}
          </p>
        </div>
        {!selected && !creating && (
          <Button disabled={busy || playbooksQ.isPending} onClick={newPlaybook}>
            <Plus size={14} /> New playbook
          </Button>
        )}
      </header>
      {playbooksQ.error ? (
        <p role="alert" className="rounded-xl border border-red-200 p-5 text-sm text-red-700">
          Playbooks could not load.{" "}
          <button type="button" onClick={() => void playbooksQ.refetch()} className="underline">
            Retry
          </button>
        </p>
      ) : playbooksQ.isPending ? (
        <p role="status" className="p-6 text-sm text-by-text-secondary">
          Loading playbooks…
        </p>
      ) : !selected && !creating ? (
        <>
          {playbooks.length ? (
            <div className="overflow-x-auto rounded-xl border border-by-border-engraved">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-by-surface-sidebar text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="p-4">Methodology</th>
                    <th className="p-4">Version</th>
                    <th className="p-4">Updated</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {playbooks.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-by-border-engraved hover:bg-by-surface-hover"
                    >
                      <td className="p-4">
                        <button
                          type="button"
                          className="font-medium underline-offset-4 hover:underline"
                          onClick={() => {
                            setSelectedId(p.id);
                            setTab("Playbook");
                          }}
                        >
                          {p.name} →
                        </button>
                      </td>
                      <td className="p-4">
                        {p.current?.version ? `v${p.current.version}` : "Not saved"}
                      </td>
                      <td className="p-4 text-by-text-secondary">{formatWhen(p.updated_at)}</td>
                      <td className="p-4">
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-900">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-by-border-engraved p-8">
              <BookOpen className="mb-5 text-by-text-tertiary" size={24} />
              <h2 className="text-xl">No sales playbook yet</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-by-text-secondary">
                Describe how your team sells. Bylda saves a version and extracts the observable
                guidelines used in call review.
              </p>
              <Button className="mt-5" onClick={newPlaybook}>
                Build your playbook
              </Button>
            </div>
          )}
          <p className="text-xs leading-6 text-by-text-secondary">
            Assign a playbook from Calls. An unassigned rep uses the organization’s only active
            playbook when exactly one exists. Execution and general sales effectiveness remain
            separate judgments.
          </p>
        </>
      ) : (
        <>
          {!creating && (
            <nav
              aria-label="Playbook detail"
              className="flex gap-6 border-b border-by-border-engraved"
            >
              {(["Playbook", "Guidelines", "Versions"] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={tab === item}
                  onClick={() => setTab(item)}
                  className={`border-b-2 px-1 py-3 text-[13px] ${tab === item ? "border-by-text-primary" : "border-transparent text-by-text-secondary"}`}
                >
                  {item}
                  {item === "Versions" && versionsQ.data ? ` · ${versionsQ.data.length}` : ""}
                </button>
              ))}
            </nav>
          )}
          {tab === "Playbook" ? (
            <div className="space-y-5 rounded-xl border border-by-border-engraved bg-by-surface-hover p-5">
              <div>
                <label htmlFor="playbook-name" className="mb-2 block text-xs font-medium">
                  Playbook name
                </label>
                <Input
                  id="playbook-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name your sales playbook"
                  disabled={!creating || busy}
                  maxLength={120}
                />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs">
                  <label htmlFor="playbook-content" className="font-medium">
                    Sales process
                  </label>
                  <span className="text-by-text-tertiary">
                    {content.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                  </span>
                </div>
                <Textarea
                  id="playbook-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value.slice(0, MAX_CHARS))}
                  placeholder={PLACEHOLDER}
                  rows={16}
                  disabled={busy}
                  className="bg-white text-[13px] leading-6"
                />
                <p className="mt-2 text-xs leading-5 text-by-text-secondary">
                  Save creates a new immutable version. Findings still require source evidence;
                  following a script is not the same as selling effectively.
                </p>
              </div>
              {!creating && (
                <div>
                  <label htmlFor="playbook-change-note" className="mb-2 block text-xs font-medium">
                    Change note (optional)
                  </label>
                  <Input
                    id="playbook-change-note"
                    value={changeNote}
                    onChange={(event) => setChangeNote(event.target.value)}
                    disabled={busy}
                    maxLength={200}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!dirty || busy || !content.trim() || (creating && !name.trim())}
                  onClick={() => void save()}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
                  {creating ? "Create playbook" : "Save new version"}
                </Button>
                {creating ? (
                  <Button variant="outline" disabled={busy} onClick={leave}>
                    Cancel
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void archive()}
                    disabled={busy}
                    className="px-3 text-xs text-red-700"
                  >
                    Archive playbook
                  </button>
                )}
              </div>
            </div>
          ) : tab === "Guidelines" && selected?.current_version_id ? (
            <GuidelinesList
              key={selected.current_version_id}
              versionId={selected.current_version_id}
            />
          ) : tab === "Versions" ? (
            <section className="overflow-hidden rounded-xl border border-by-border-engraved">
              <h2 className="flex items-center gap-2 border-b border-by-border-engraved p-4 text-sm">
                <History size={15} /> Version history
              </h2>
              {versionsQ.isPending ? (
                <p role="status" className="p-5 text-sm">
                  Loading versions…
                </p>
              ) : versionsQ.error ? (
                <p role="alert" className="p-5 text-sm text-red-700">
                  Version history unavailable.{" "}
                  <button
                    type="button"
                    onClick={() => void versionsQ.refetch()}
                    className="underline"
                  >
                    Retry
                  </button>
                </p>
              ) : (
                <ul>
                  {versionsQ.data?.map((version) => (
                    <li
                      key={version.id}
                      className="flex flex-wrap items-center gap-3 border-b border-by-border-engraved p-4 text-[13px]"
                    >
                      <span className="font-mono">v{version.version}</span>
                      <span className="text-by-text-secondary">
                        {formatWhen(version.created_at)}
                      </span>
                      <span className="flex-1">{version.change_note}</span>
                      {version.id === selected?.current_version_id ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-900">
                          Current
                        </span>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setContent(version.content);
                              setTab("Playbook");
                            }}
                          >
                            View in editor
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Restore v${version.version} as a new version?`))
                                void restore(version.version, version.content);
                            }}
                          >
                            <RotateCcw size={12} /> Restore
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <p className="text-sm text-by-text-secondary">
              Save a playbook version before extracting guidelines.
            </p>
          )}
        </>
      )}
    </section>
  );
}
