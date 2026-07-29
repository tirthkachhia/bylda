/**
 * COMPANIES — /app/crm/companies
 *
 * Company directory over the companies table (org-scoped). List + detail drawer
 * with linked contacts and deals (leads). Fills the CRM "Accounts" surface.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Building2, Trash2, GitMerge, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { MomentumRail } from "@/components/bylda/MomentumRail";
import { CustomersNav } from "@/components/app/CustomersNav";

export const Route = createFileRoute("/app/crm/companies")({ component: CompaniesPage });

type Company = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  notes: string | null;
};

function CompaniesPage() {
  const { currentOrgId } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [counts, setCounts] = useState<
    Record<string, { contacts: number; deals: number; value: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Company | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("id, name, domain, industry, size, location, notes")
      .eq("organization_id", currentOrgId)
      .order("name", { ascending: true });
    const list = (data as Company[]) ?? [];
    setCompanies(list);

    // Aggregate linked contacts + deals per company.
    const [{ data: contacts }, { data: leads }] = await Promise.all([
      supabase.from("contacts").select("company_id").eq("org_id", currentOrgId),
      supabase.from("leads").select("company_id, value").eq("organization_id", currentOrgId),
    ]);
    const agg: Record<string, { contacts: number; deals: number; value: number }> = {};
    for (const c of (contacts as { company_id: string | null }[]) ?? []) {
      if (!c.company_id) continue;
      agg[c.company_id] ??= { contacts: 0, deals: 0, value: 0 };
      agg[c.company_id].contacts++;
    }
    for (const l of (leads as { company_id: string | null; value: number | null }[]) ?? []) {
      if (!l.company_id) continue;
      agg[l.company_id] ??= { contacts: 0, deals: 0, value: 0 };
      agg[l.company_id].deals++;
      agg[l.company_id].value += Number(l.value ?? 0);
    }
    setCounts(agg);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function remove(id: string) {
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("companies").delete().eq("id", id);
  }

  const filtered = companies.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.domain ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-full bg-[--bg-page] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <CustomersNav />
        </div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--text-primary]">
              Companies
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">{companies.length} accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/app/crm/duplicates"
              className="flex items-center gap-1.5 rounded-xl border border-[--border] bg-[--surface] px-4 py-2.5 text-sm font-semibold text-[--text-primary] hover:bg-[--surface-2]"
            >
              <GitMerge className="h-4 w-4" /> Duplicates
            </Link>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--accent-hover]"
            >
              <Plus className="h-4 w-4" /> Add Company
            </button>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="mb-4 w-full max-w-sm rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-2.5 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
        />

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[--bg-surface-2]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--bg-surface] px-8 py-16 text-center">
            <Building2 className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--text-primary]">No companies yet</p>
            <p className="mb-4 max-w-xs text-xs text-[--text-muted]">
              Group contacts and deals under the accounts they belong to.
            </p>
            {/* Secondary weight: the persistent header "Add Company" is this
                screen's single primary CTA, so this empty-state twin is an
                outline button (CTA reduction — one primary per screen). */}
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-xl border border-[--accent] px-5 py-2.5 text-sm font-semibold text-[--accent] hover:bg-[--accent]/10"
            >
              Add Company
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--bg-surface]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[--border] text-left">
                  {["Name", "Domain", "Industry", "Contacts", "Deals", "Pipeline", ""].map((h) => (
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
                {filtered.map((c) => {
                  const a = counts[c.id] ?? { contacts: 0, deals: 0, value: 0 };
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer border-b border-[--border] last:border-b-0 hover:bg-[--bg-surface-2]"
                      onClick={() => setActive(c)}
                    >
                      <td className="px-4 py-3.5 text-sm font-medium text-[--text-primary]">
                        {c.name}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[--text-secondary]">
                        {c.domain ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[--text-secondary]">
                        {c.industry ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[--text-secondary]">{a.contacts}</td>
                      <td className="px-4 py-3.5 text-sm text-[--text-secondary]">{a.deals}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-[--accent]">
                        {a.value ? `$${a.value.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void remove(c.id);
                          }}
                          className="rounded-lg p-1.5 text-[--text-muted] hover:text-[--danger]"
                          aria-label="Delete company"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && (
        <CompanyDrawer
          company={active}
          orgId={currentOrgId ?? null}
          onClose={() => setActive(null)}
        />
      )}
      {showAdd && (
        <AddCompanyModal
          orgId={currentOrgId ?? null}
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}
    </div>
  );
}

function CompanyDrawer({
  company,
  orgId,
  onClose,
}: {
  company: Company;
  orgId: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "contacts" | "deals" | "activity">("profile");
  const [contacts, setContacts] = useState<
    { id: string; first_name: string | null; last_name: string | null; email: string | null }[]
  >([]);
  const [deals, setDeals] = useState<
    { id: string; name: string; stage: string; value: number | null }[]
  >([]);
  const [activities, setActivities] = useState<
    { id: string; type: string; content: string | null; created_at: string; deal_id: string }[]
  >([]);

  useEffect(() => {
    if (!orgId) return;
    void supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .eq("company_id", company.id)
      .then(({ data }) => setContacts(data ?? []));
    void supabase
      .from("leads")
      .select("id, name, stage, value")
      .eq("company_id", company.id)
      .then(({ data }) => setDeals((data as typeof deals) ?? []));
  }, [company.id, orgId]);

  // Activity timeline — the chronological crm_activities feed across this
  // company's deals (crm_activities links by deal_id, so we join through the
  // company's leads). Auto-populated: nothing manual to log here.
  useEffect(() => {
    if (deals.length === 0) {
      setActivities([]);
      return;
    }
    void supabase
      .from("crm_activities")
      .select("id, type, content, created_at, deal_id")
      .in(
        "deal_id",
        deals.map((d) => d.id),
      )
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setActivities((data as typeof activities) ?? []));
  }, [deals]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full overflow-y-auto bg-[--bg-surface] shadow-[-8px_0_32px_rgba(0,0,0,0.08)] sm:w-[420px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[--border] px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[--accent-light] text-sm font-semibold text-[--accent]">
            {company.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-[--text-primary]">
              {company.name}
            </p>
            <p className="truncate text-xs text-[--text-muted]">
              {company.domain ?? company.industry ?? "Company"}
            </p>
          </div>
          <button onClick={onClose} className="text-[--text-muted] hover:text-[--text-primary]">
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-[--border] px-3">
          {(["profile", "contacts", "deals", "activity"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium capitalize ${
                tab === t
                  ? "border-[--accent] text-[--accent]"
                  : "border-transparent text-[--text-secondary] hover:text-[--text-primary]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "profile" && (
            <MomentumRail
              className="mb-4"
              loop={{
                asset: company.industry ? `${company.industry} account` : "Company account",
                task: contacts.length
                  ? `${contacts.length} contact${contacts.length > 1 ? "s" : ""} linked`
                  : undefined,
                momentum: deals.length
                  ? `${deals.length} deal${deals.length > 1 ? "s" : ""} in play`
                  : undefined,
              }}
            />
          )}
          {tab === "profile" && (
            <dl className="space-y-3">
              {[
                ["Domain", company.domain],
                ["Industry", company.industry],
                ["Size", company.size],
                ["Location", company.location],
                ["Notes", company.notes],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                    {k}
                  </dt>
                  <dd className="text-sm text-[--text-primary]">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === "contacts" &&
            (contacts.length === 0 ? (
              <p className="py-8 text-center text-xs text-[--text-muted]">No contacts linked.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-[--border] bg-[--bg-surface-2] p-3 text-sm"
                  >
                    <p className="font-medium text-[--text-primary]">
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Contact"}
                    </p>
                    <p className="text-xs text-[--text-muted]">{c.email ?? "—"}</p>
                  </div>
                ))}
              </div>
            ))}
          {tab === "deals" &&
            (deals.length === 0 ? (
              <p className="py-8 text-center text-xs text-[--text-muted]">No deals linked.</p>
            ) : (
              <div className="space-y-2">
                {deals.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-[--border] bg-[--bg-surface-2] p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-[--text-primary]">{d.name}</p>
                      <p className="text-xs text-[--text-muted]">{d.stage}</p>
                    </div>
                    <span className="font-semibold text-[--accent]">
                      {d.value ? `$${Number(d.value).toLocaleString()}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          {tab === "activity" &&
            (activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="mb-2 h-6 w-6 text-[--text-muted]" />
                <p className="text-sm font-semibold text-[--text-primary]">No activity yet</p>
                <p className="mt-1 max-w-[16rem] text-xs text-[--text-muted]">
                  Stage changes, notes, and tasks on this account's deals will appear here
                  automatically.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-4 pl-4">
                {activities.map((a) => {
                  const deal = deals.find((d) => d.id === a.deal_id);
                  return (
                    <li key={a.id} className="relative">
                      <span
                        className="absolute -left-4 top-1.5 h-2 w-2 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                      <span
                        className="absolute -left-[13px] top-3 bottom-[-16px] w-px"
                        style={{ background: "var(--border)" }}
                      />
                      <p className="text-sm text-[--text-primary]">
                        {a.content || a.type.replace(/_/g, " ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[--text-muted]">
                        {deal ? `${deal.name} · ` : ""}
                        {new Date(a.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ))}
        </div>
      </div>
    </div>
  );
}

function AddCompanyModal({
  orgId,
  onClose,
  onAdded,
}: {
  orgId: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!orgId || !name.trim()) return;
    setSaving(true);
    await supabase.from("companies").insert({
      organization_id: orgId,
      name: name.trim(),
      domain: domain || null,
      industry: industry || null,
    });
    setSaving(false);
    onAdded();
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
        <h2 className="mb-4 text-[18px] font-semibold text-[--text-primary]">Add Company</h2>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name *"
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none focus:ring-2 focus:ring-[--accent]/25"
          />
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Domain (e.g. acme.com)"
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none"
          />
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Industry"
            className="w-full rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--border-focus] focus:outline-none"
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
            disabled={saving || !name.trim()}
            className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--accent-hover] disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
