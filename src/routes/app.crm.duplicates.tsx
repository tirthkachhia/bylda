/**
 * DUPLICATES — /app/crm/duplicates
 *
 * Review queue over the duplicate_matches table (populated by crm-dedupe on
 * contact/company create, or an on-demand backfill scan). Each pending pair
 * renders both records side by side; the reviewer keeps one (merge — every FK
 * reassigns to the survivor via crm-merge) or dismisses the pair.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Users, Building2, GitMerge, X, ScanSearch } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { mergeRecords, dedupeScan, type CrmEntityType } from "@/lib/crm";

export const Route = createFileRoute("/app/crm/duplicates")({ component: DuplicatesPage });

type DupMatch = {
  id: string;
  entity_type: CrmEntityType;
  entity_id_a: string;
  entity_id_b: string;
  confidence: number;
  reason: string | null;
};

type ContactRec = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
};
type CompanyRec = { id: string; name: string; domain: string | null; industry: string | null };

function DuplicatesPage() {
  const { currentOrgId } = useAuth();
  const [matches, setMatches] = useState<DupMatch[]>([]);
  const [contacts, setContacts] = useState<Record<string, ContactRec>>({});
  const [companies, setCompanies] = useState<Record<string, CompanyRec>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    // `supabase as any`: house escape hatch for tables not yet in the generated
    // types (duplicate_matches ships in this PR's migrations). See queries.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("duplicate_matches")
      .select("id, entity_type, entity_id_a, entity_id_b, confidence, reason")
      .eq("organization_id", currentOrgId)
      .eq("status", "pending")
      .order("confidence", { ascending: false });
    const list = (data as DupMatch[]) ?? [];
    setMatches(list);

    const contactIds = new Set<string>();
    const companyIds = new Set<string>();
    for (const m of list) {
      const set = m.entity_type === "contact" ? contactIds : companyIds;
      set.add(m.entity_id_a);
      set.add(m.entity_id_b);
    }
    const [{ data: cData }, { data: coData }] = await Promise.all([
      contactIds.size
        ? supabase
            .from("contacts")
            .select("id, first_name, last_name, email, company")
            .in("id", [...contactIds])
        : Promise.resolve({ data: [] as ContactRec[] }),
      companyIds.size
        ? supabase
            .from("companies")
            .select("id, name, domain, industry")
            .in("id", [...companyIds])
        : Promise.resolve({ data: [] as CompanyRec[] }),
    ]);
    setContacts(Object.fromEntries(((cData ?? []) as ContactRec[]).map((c) => [c.id, c])));
    setCompanies(Object.fromEntries(((coData ?? []) as CompanyRec[]).map((c) => [c.id, c])));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function onMerge(m: DupMatch, winnerId: string, loserId: string) {
    if (!currentOrgId) return;
    setBusy(m.id);
    try {
      await mergeRecords(currentOrgId, m.entity_type, winnerId, loserId);
      setMatches((prev) => prev.filter((x) => x.id !== m.id));
    } catch {
      /* leave the row in place so the reviewer can retry */
    } finally {
      setBusy(null);
    }
  }

  async function onDismiss(m: DupMatch) {
    if (!currentOrgId) return;
    setBusy(m.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("duplicate_matches")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", m.id)
      .eq("organization_id", currentOrgId);
    setMatches((prev) => prev.filter((x) => x.id !== m.id));
    setBusy(null);
  }

  async function runScan() {
    if (!currentOrgId) return;
    setScanning(true);
    try {
      await Promise.all([
        dedupeScan(currentOrgId, "contact", { all: true }),
        dedupeScan(currentOrgId, "company", { all: true }),
      ]);
      await load();
    } finally {
      setScanning(false);
    }
  }

  const contactLabel = (c?: ContactRec) =>
    c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unnamed contact" : "—";

  const pendingCount = matches.length;
  const sorted = useMemo(() => [...matches].sort((a, b) => b.confidence - a.confidence), [matches]);

  return (
    <div className="min-h-full bg-[--background] p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[--foreground]">Duplicate review</h1>
            <p className="text-sm text-[--text-faint]">
              {pendingCount} pending {pendingCount === 1 ? "pair" : "pairs"} — keep one record and
              every linked deal, task and note moves to it.
            </p>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-xl border border-[--border] bg-[--surface] px-3 py-2 text-sm font-semibold text-[--foreground] hover:bg-[--surface-2] disabled:opacity-50"
          >
            <ScanSearch className="h-4 w-4" />
            {scanning ? "Scanning…" : "Scan for duplicates"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-[--surface-2]" />
            <div className="h-28 animate-pulse rounded-2xl bg-[--surface-2]" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-[--border] bg-[--surface] p-10 text-center">
            <GitMerge className="mx-auto h-8 w-8 text-[--text-faint]" />
            <p className="mt-2 text-sm font-semibold text-[--foreground]">
              No duplicates to review
            </p>
            <p className="text-xs text-[--text-faint]">
              New contacts and companies are checked automatically. Run a scan to sweep existing
              records.
            </p>
          </div>
        ) : (
          sorted.map((m) => {
            const isContact = m.entity_type === "contact";
            const Icon = isContact ? Users : Building2;
            const a = isContact ? contacts[m.entity_id_a] : companies[m.entity_id_a];
            const b = isContact ? contacts[m.entity_id_b] : companies[m.entity_id_b];
            const labelA = isContact
              ? contactLabel(a as ContactRec)
              : ((a as CompanyRec)?.name ?? "—");
            const labelB = isContact
              ? contactLabel(b as ContactRec)
              : ((b as CompanyRec)?.name ?? "—");
            const subA = isContact
              ? ((a as ContactRec)?.email ?? (a as ContactRec)?.company ?? "")
              : ((a as CompanyRec)?.domain ?? (a as CompanyRec)?.industry ?? "");
            const subB = isContact
              ? ((b as ContactRec)?.email ?? (b as ContactRec)?.company ?? "")
              : ((b as CompanyRec)?.domain ?? (b as CompanyRec)?.industry ?? "");
            const disabled = busy === m.id;

            return (
              <div
                key={m.id}
                className="rounded-2xl border border-[--border] bg-[--surface] p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[--text-faint]">
                    <Icon className="h-3.5 w-3.5" /> {m.entity_type}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[--text-faint]">
                    {m.reason ? <span>{m.reason}</span> : null}
                    <span className="rounded-full bg-[--primary-soft] px-2 py-0.5 font-semibold text-[--accent]">
                      {Math.round(m.confidence * 100)}% match
                    </span>
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      id: m.entity_id_a,
                      label: labelA,
                      sub: subA,
                      keep: m.entity_id_a,
                      drop: m.entity_id_b,
                    },
                    {
                      id: m.entity_id_b,
                      label: labelB,
                      sub: subB,
                      keep: m.entity_id_b,
                      drop: m.entity_id_a,
                    },
                  ].map((side) => (
                    <div
                      key={side.id}
                      className="flex flex-col justify-between rounded-xl border border-[--border] bg-[--surface-2] p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[--foreground]">{side.label}</p>
                        {side.sub ? (
                          <p className="truncate text-xs text-[--text-faint]">{side.sub}</p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => onMerge(m, side.keep, side.drop)}
                        disabled={disabled}
                        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[--accent] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[--primary-hover] disabled:opacity-50"
                      >
                        <GitMerge className="h-3.5 w-3.5" /> Keep this one
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => onDismiss(m)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[--text-faint] hover:text-[--foreground] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Not a duplicate
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
