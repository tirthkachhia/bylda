/**
 * PlaybooksPanel — manager-authored sales playbooks that analyze-call judges reps
 * against. Lives on the Calls & coaching page. Each save creates an immutable
 * version; Restore re-saves an older version's text as a new version, so history
 * is linear and nothing is lost.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, History, Loader2, Plus, RotateCcw, Save } from "lucide-react";
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

  const selected: Playbook | null =
    (selectedId && playbooks.find((p) => p.id === selectedId)) ||
    (!creating ? (playbooks[0] ?? null) : null);
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
    ? !!name.trim() && !!content.trim()
    : !!selected && content.trim() !== (selected.current?.content ?? "").trim();

  async function save() {
    if (!currentOrgId || !user || busy) return;
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
        `Archive "${selected.name}"? Reps assigned to it will fall back to no playbook.`,
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

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Playbooks
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={busy}
            onClick={() => {
              setCreating(true);
              setSelectedId(null);
              setName("");
              setContent("");
              setChangeNote("");
            }}
          >
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
        {playbooksQ.isLoading ? (
          <p className="flex items-center gap-2 text-[12px] text-neutral-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : playbooks.length === 0 && !creating ? (
          <p className="rounded-xl border p-4 text-[12px] leading-5 text-neutral-500">
            No playbooks yet. Create one and it applies to every rep until you assign others.
          </p>
        ) : (
          <ul className="space-y-1">
            {playbooks.map((playbook) => {
              const active = !creating && playbook.id === selected?.id;
              return (
                <li key={playbook.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setSelectedId(playbook.id);
                    }}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] ${active ? "bg-[#e5ebf5] font-semibold" : "hover:bg-black/[0.03]"}`}
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#3275d8]" />
                    <span className="truncate">{playbook.name}</span>
                    <span className="ml-auto text-[10px] text-neutral-400">
                      v{playbook.current?.version ?? "–"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] leading-5 text-neutral-500">
          Assign a playbook to each rep on the Calls &amp; coaching page. With exactly one playbook,
          every rep uses it automatically.
        </p>
      </aside>

      <section className="space-y-4">
        {!creating && !selected ? (
          <div className="rounded-xl border p-10 text-center text-[12px] text-neutral-500">
            Select a playbook or create a new one.
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1 text-[12px] font-medium">Name</div>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Life insurance outbound, Q4"
                className="h-10"
                disabled={!creating || busy}
                maxLength={120}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px] font-medium">
                <span>Playbook</span>
                <span className="text-[11px] font-normal text-neutral-400">
                  {content.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              </div>
              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value.slice(0, MAX_CHARS))}
                placeholder={PLACEHOLDER}
                rows={18}
                disabled={busy}
                className="font-mono text-[12px] leading-5"
              />
              <p className="mt-2 text-[11px] leading-5 text-neutral-500">
                Written in your words. The analyzer judges each call against these guidelines and
                phrases coaching to match them. It never changes what the analyzer is allowed to
                claim: every finding still needs a verbatim quote.
              </p>
            </div>
            {!creating && (
              <div>
                <div className="mb-1 text-[12px] font-medium">Change note (optional)</div>
                <Input
                  value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value)}
                  placeholder="What changed in this version"
                  className="h-10"
                  disabled={busy}
                  maxLength={200}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void save()} disabled={!dirty || busy} className="gap-1.5">
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {creating ? "Create playbook" : "Save new version"}
              </Button>
              {creating ? (
                <button
                  type="button"
                  className="text-[12px] underline-offset-2 hover:underline"
                  onClick={() => setCreating(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="text-[12px] text-red-700 underline-offset-2 hover:underline"
                  onClick={() => void archive()}
                  disabled={busy}
                >
                  Archive playbook
                </button>
              )}
            </div>

            {!creating && selected?.current_version_id && (
              <GuidelinesList versionId={selected.current_version_id} />
            )}

            {!creating && selected && (
              <div className="rounded-xl border p-4">
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  <History className="h-3.5 w-3.5" /> Version history
                </h3>
                {versionsQ.isLoading ? (
                  <p className="text-[12px] text-neutral-500">Loading versions…</p>
                ) : (
                  <ul className="divide-y divide-black/[0.06]">
                    {(versionsQ.data ?? []).map((version) => {
                      const isCurrent = version.id === selected.current_version_id;
                      return (
                        <li
                          key={version.id}
                          className="flex flex-wrap items-center gap-3 py-2 text-[12px]"
                        >
                          <span className="font-mono font-semibold">v{version.version}</span>
                          <span className="text-neutral-500">{formatWhen(version.created_at)}</span>
                          {version.change_note && (
                            <span className="truncate text-neutral-600">{version.change_note}</span>
                          )}
                          {isCurrent ? (
                            <span className="ml-auto rounded-full bg-[#dff1e7] px-2 py-0.5 text-[10px] font-semibold text-[#28764d]">
                              current
                            </span>
                          ) : (
                            <span className="ml-auto flex items-center gap-3">
                              <button
                                type="button"
                                className="text-[11px] underline-offset-2 hover:underline"
                                onClick={() => setContent(version.content)}
                                disabled={busy}
                              >
                                View in editor
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e5faf] underline-offset-2 hover:underline"
                                onClick={() => void restore(version.version, version.content)}
                                disabled={busy}
                              >
                                <RotateCcw className="h-3 w-3" /> Restore
                              </button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
