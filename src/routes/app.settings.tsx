import { type SearchSchemaInput, createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  organizationQuery,
  organizationMembersQuery,
  subscriptionQuery,
  planEntitlementsQuery,
  managerHomeQuery,
  type OrgMember,
  type OrgRole,
} from "@/lib/queries";
import { blockIfGuest } from "@/lib/guest";
import { getStripeEnvironment } from "@/lib/stripe";
import { FigmaField, FigmaRow, Inactive } from "@/components/app/FigmaPrimitives";
import { initials } from "@/lib/coaching/calls";
import { FeatureSettings, AnalysisPreferences } from "@/components/app/coaching/FeatureSettings";
import { AccountSecurity } from "@/components/app/AccountSecurity";
import { ProfilePhoto } from "@/components/app/ProfilePhoto";
import { DeleteWorkspace } from "@/components/app/coaching/PrivacySettings";
import { BillingPlans } from "@/components/app/coaching/BillingPlans";
import { coachingUsageQuery } from "@/lib/coaching/usage";
import { csvText, downloadFile } from "@/lib/download";

export const Route = createFileRoute("/app/settings")({
  validateSearch: (s: Record<string, unknown> & SearchSchemaInput) => ({
    tab: typeof s.tab === "string" ? s.tab : "general",
  }),
  component: Settings,
});
const groups = [
  [
    "Workspace",
    [
      ["general", "General"],
      ["users", "Users"],
      ["teams", "Teams"],
      ["roles", "Roles & permissions"],
    ],
  ],
  [
    "Intelligence",
    [
      ["analysis", "Analysis preferences"],
      ["methodology", "Methodology"],
      ["rules", "Behavior rules"],
      ["objections", "Objection library"],
      ["success", "Success criteria"],
    ],
  ],
  [
    "Delivery",
    [
      ["notifications", "Notifications"],
      ["delivery", "Delivery channels"],
    ],
  ],
  [
    "Data",
    [
      ["integrations", "Integrations"],
      ["privacy", "Retention & privacy"],
    ],
  ],
  [
    "Account",
    [
      ["profile", "Profile"],
      ["plan", "Billing & plan"],
      ["usage", "Usage"],
    ],
  ],
  [
    "Developer",
    [
      ["api", "API keys"],
      ["audit", "Audit log"],
    ],
  ],
] as const;
function Settings() {
  const { tab: raw } = Route.useSearch();
  const tab =
    (
      { organization: "general", team: "users", connectors: "integrations" } as Record<
        string,
        string
      >
    )[raw] ?? raw;
  const label =
    groups.map((g) => g[1].find(([key]) => key === tab)?.[1]).find(Boolean) ?? "Settings";
  return (
    <div className="figma-surface figma-panel figma-settings" data-design-screen="settings">
      <nav className="figma-settings-nav" aria-label="Settings sections">
        {groups.map(([heading, items]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            {items.map(([key, name]) =>
              key === "methodology" ? (
                <Link key={key} to="/app/crm/calls" search={{ view: "playbooks" }}>
                  {name}
                </Link>
              ) : key === "integrations" || key === "delivery" ? (
                <Link
                  key={key}
                  to="/app/integrations"
                  search={{ tab: key === "delivery" ? "delivery" : "sources" } as never}
                >
                  {name}
                </Link>
              ) : (
                <Link
                  key={key}
                  to="/app/settings"
                  search={{ tab: key }}
                  aria-current={tab === key ? "page" : undefined}
                >
                  {name}
                </Link>
              ),
            )}
          </section>
        ))}
      </nav>
      <div className="figma-settings-main">
        {tab === "general" ? (
          <General />
        ) : tab === "profile" ? (
          <Profile />
        ) : tab === "users" ? (
          <Users rolesOnly={false} />
        ) : tab === "roles" ? (
          <RolePermissions />
        ) : tab === "plan" ? (
          <Billing />
        ) : tab === "usage" ? (
          <Usage />
        ) : (
          <FeatureSettings tab={tab} />
        )}
      </div>
    </div>
  );
}
function General() {
  const { currentOrgId, refreshProfile, user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ ...organizationQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const canEdit = !!user && q.data?.owner_id === user.id;
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const loadedName = q.data?.name ?? "",
    loadedWebsite = (q.data as { website_url?: string | null } | undefined)?.website_url ?? "";
  useEffect(() => {
    setName(loadedName);
    setWebsite(loadedWebsite);
  }, [loadedName, loadedWebsite]);
  async function save() {
    if (!currentOrgId || !canEdit || !name.trim() || blockIfGuest()) return;
    setBusy(true);
    try {
      if (website.trim() && !/^https?:$/.test(new URL(website.trim()).protocol))
        throw new Error("Enter an HTTP or HTTPS website URL.");
      const { data, error } = await supabase
        .from("organizations")
        .update({ name: name.trim(), website_url: website.trim() || null } as never)
        .eq("id", currentOrgId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Workspace was not changed. Owner access is required.");
      await qc.invalidateQueries({ queryKey: ["organization", currentOrgId] });
      await refreshProfile();
      toast.success("Workspace saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save workspace");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>Workspace</h1>
      <p className="mt-2 text-xs text-by-text-secondary">Applies to everyone in this workspace.</p>
      {q.error ? (
        <p role="alert" className="mt-5">
          Workspace could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <>
          <FigmaField label="Workspace name">
            <input
              value={name}
              disabled={q.isPending || !canEdit}
              onChange={(e) => setName(e.target.value)}
            />
          </FigmaField>
          <FigmaField label="Company website">
            <input
              type="url"
              value={website}
              disabled={!canEdit}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://company.com"
            />
            <small>
              Workspace membership is controlled through verified invitations under Users.
            </small>
          </FigmaField>
          <FigmaRow label="Time zone" detail="Briefs and ‘yesterday’ use this.">
            <Link className="figma-button" to="/app/settings" search={{ tab: "analysis" }}>
              Configure workspace time zone
            </Link>
          </FigmaRow>
          <FigmaRow label="Week starts on" detail="Weekly report schedule">
            <Link className="figma-button" to="/app/settings" search={{ tab: "analysis" }}>
              Configure calendar week
            </Link>
          </FigmaRow>
          <FigmaRow
            label="Default language for analysis"
            detail="Transcription and behavior detection"
          >
            <Link className="figma-button" to="/app/settings" search={{ tab: "analysis" }}>
              Configure coaching language
            </Link>
          </FigmaRow>
          <FigmaRow label="Workspace membership">
            <Link className="figma-button" to="/app/settings" search={{ tab: "users" }}>
              Invite and manage members
            </Link>
          </FigmaRow>
          <button
            className="figma-button figma-button-primary mt-5"
            disabled={busy || q.isPending || !canEdit || !name.trim()}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      )}
      <div className="mt-5 rounded-lg bg-red-50 p-4">
        <h3 className="!mt-0">Danger zone</h3>
        <DeleteWorkspace />
      </div>
    </section>
  );
}
function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(profile?.full_name ?? ""), [profile?.full_name]);
  async function save() {
    if (!user || blockIfGuest()) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>Profile</h1>
      <div className="my-6 flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-by-avatar-metal">
          {initials(profile?.full_name ?? user?.email ?? "Me")}
        </span>
        <ProfilePhoto />
      </div>
      <FigmaField label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </FigmaField>
      <FigmaField label="Email">
        <input value={user?.email ?? ""} disabled />
        <small>Used to identify your account.</small>
      </FigmaField>
      <button
        className="figma-button figma-button-primary"
        disabled={busy || !name.trim()}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save profile"}
      </button>
      <FigmaRow label="My daily brief">
        <Link className="figma-button" to="/app/reports">
          Manage report schedules
        </Link>
      </FigmaRow>
      <FigmaRow label="Password">
        <Link className="figma-button" to="/auth/forgot-password">
          Change
        </Link>
      </FigmaRow>
      <AccountSecurity />
    </section>
  );
}
function Users({ rolesOnly }: { rolesOnly: boolean }) {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ ...organizationMembersQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const members = q.data ?? [];
  const mine = members.find((m) => m.user_id === user?.id);
  const manage = ["owner", "admin"].includes(mine?.role ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin" | "manager">("member");
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["org-members", currentOrgId] });
  async function invite() {
    if (!manage || !currentOrgId || blockIfGuest()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("team-invite", {
        body: { organizationId: currentOrgId, email: email.trim(), role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEmail("");
      await refresh();
      toast.success(data?.status === "added_existing" ? "Member added" : "Invite sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }
  async function change(member: OrgMember, next: OrgRole | null) {
    if (
      !manage ||
      !currentOrgId ||
      blockIfGuest() ||
      member.role === "owner" ||
      member.user_id === user?.id
    )
      return;
    if (!next && !window.confirm(`Remove ${member.email ?? "this member"} from this workspace?`))
      return;
    setBusy(true);
    try {
      const request = next
        ? supabase.from("organization_members").update({ role: next })
        : supabase.from("organization_members").delete();
      const { error } = await request
        .eq("organization_id", currentOrgId)
        .eq("user_id", member.user_id);
      if (error) throw error;
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update member");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{rolesOnly ? "Roles & permissions" : "Users"}</h1>
        <button
          className="figma-button"
          disabled={!q.data?.length}
          onClick={() =>
            downloadFile(
              "workspace-users.csv",
              csvText([
                ["Name", "Email", "Role", "Joined"],
                ...(q.data ?? []).map((m) => [m.full_name, m.email, m.role, m.created_at]),
              ]),
            )
          }
        >
          Export
        </button>
      </div>
      <p className="mt-2 text-xs text-by-text-secondary">
        Workspace access uses the roles supported by your account.
      </p>
      {manage && !rolesOnly && (
        <form
          className="my-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void invite();
          }}
        >
          <FigmaField label="Invite by email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </FigmaField>
          <FigmaField label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </FigmaField>
          <button className="figma-button figma-button-primary mb-[18px]" disabled={busy}>
            Invite user
          </button>
        </form>
      )}
      {q.isPending ? (
        <p role="status" className="mt-5">
          Loading users…
        </p>
      ) : q.error ? (
        <p role="alert" className="mt-5">
          Users could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <div className="overflow-x-auto mt-5">
          <table className="figma-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Team</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.full_name ?? "—"}</td>
                  <td>{m.email ?? "—"}</td>
                  <td>
                    {manage && m.role !== "owner" && m.user_id !== user?.id ? (
                      <select
                        aria-label={`Role for ${m.email ?? m.user_id}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => void change(m, e.target.value as OrgRole)}
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      m.role
                    )}
                  </td>
                  <td>—</td>
                  <td>
                    {manage && m.role !== "owner" && m.user_id !== user?.id && (
                      <button
                        className="figma-button"
                        disabled={busy}
                        onClick={() => void change(m, null)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!members.length && <p className="my-6 text-by-text-secondary">No users returned.</p>}
        </div>
      )}
    </section>
  );
}
function Billing() {
  const { currentOrgId } = useAuth();
  const usage = useQuery(coachingUsageQuery(currentOrgId ?? ""));
  const sub = useQuery({ ...subscriptionQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const plans = useQuery(planEntitlementsQuery());
  const invoices = useQuery({
    queryKey: ["invoices", currentOrgId],
    enabled: !!currentOrgId && !!sub.data?.stripe_customer_id,
    queryFn: async (): Promise<
      Array<{
        id: string;
        number: string | null;
        status: string | null;
        invoice_pdf: string | null;
        created: number;
      }>
    > => {
      const { data, error } = await supabase.functions.invoke("list-invoices", {
        body: { organizationId: currentOrgId, environment: getStripeEnvironment() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.invoices ?? [];
    },
  });
  const members = useQuery({
    ...organizationMembersQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
  const { user } = useAuth();
  const canManage = ["owner", "admin"].includes(
    members.data?.find((m) => m.user_id === user?.id)?.role ?? "",
  );
  const [busy, setBusy] = useState(false);
  const plan = plans.data?.find((p) => p.plan === sub.data?.plan);
  async function portal() {
    if (!currentOrgId || !canManage || blockIfGuest()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: {
          action: "billing_portal",
          organizationId: currentOrgId,
          environment: getStripeEnvironment(),
          returnUrl: window.location.href,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Billing portal unavailable");
      window.location.assign(data.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Billing portal unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>Billing & plan</h1>
      {sub.error || plans.error ? (
        <p role="alert" className="mt-5">
          Billing data could not load.{" "}
          <button
            className="underline"
            onClick={() => {
              void sub.refetch();
              void plans.refetch();
            }}
          >
            Retry
          </button>
        </p>
      ) : (
        <>
          <FigmaRow label="Current plan">
            <span className="capitalize">
              {sub.isPending ? "Loading…" : (sub.data?.plan ?? "—")}
            </span>
          </FigmaRow>
          <FigmaRow label="Price">
            <span>{plan ? `$${plan.price_usd} / month` : "—"}</span>
          </FigmaRow>
          {canManage && <BillingPlans existingSubscription={!!sub.data?.stripe_subscription_id} />}
          <FigmaRow label="Analyzed seats">
            <span>
              {usage.error ? "Usage could not load" : (usage.data?.analyzed_reps ?? "Loading…")}
            </span>
          </FigmaRow>
          <FigmaRow label="Payment method">
            <button
              className="figma-button"
              disabled={busy || !canManage || !sub.data?.stripe_customer_id}
              onClick={() => void portal()}
            >
              Manage payment method
            </button>
          </FigmaRow>
          <button
            className="figma-button figma-button-primary mt-5"
            disabled={busy || !canManage || !sub.data?.stripe_customer_id}
            onClick={() => void portal()}
          >
            Manage billing
          </button>
          <h3>Invoices</h3>
          {invoices.error ? (
            <p role="alert" className="text-xs">
              Invoices could not load.{" "}
              <button className="underline" onClick={() => void invoices.refetch()}>
                Retry
              </button>
            </p>
          ) : sub.data?.stripe_customer_id && invoices.isPending ? (
            <p role="status" className="text-xs">
              Loading invoices…
            </p>
          ) : invoices.data?.length ? (
            <ul>
              {invoices.data.map((invoice) => {
                let pdf: string | null = null;
                try {
                  if (invoice.invoice_pdf && new URL(invoice.invoice_pdf).protocol === "https:")
                    pdf = invoice.invoice_pdf;
                } catch {
                  /* Invalid provider URL stays inactive. */
                }
                return (
                  <li key={invoice.id} className="figma-row">
                    <div>
                      <p>{invoice.number ?? "Invoice"}</p>
                      <small>
                        {new Date(invoice.created * 1000).toLocaleDateString()} ·{" "}
                        {invoice.status ?? "Status unknown"}
                      </small>
                    </div>
                    {pdf ? (
                      <a className="figma-button" href={pdf} target="_blank" rel="noreferrer">
                        Download PDF
                      </a>
                    ) : (
                      <button
                        className="figma-button"
                        disabled={busy || !canManage}
                        onClick={() => void portal()}
                      >
                        Open invoice in billing portal
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-by-text-secondary">No invoices available.</p>
          )}
          <p className="mt-5 rounded-lg bg-amber-50 p-4 text-xs">
            Billing products and checkout use your configured Stripe prices. Prices are not inferred
            from a design mockup.
          </p>
        </>
      )}
    </section>
  );
}
function Usage() {
  const { currentOrgId } = useAuth();
  const usage = useQuery(coachingUsageQuery(currentOrgId ?? ""));
  const q = useQuery(managerHomeQuery(currentOrgId ?? ""));
  return (
    <section>
      <h1>Usage</h1>
      <p className="mt-2 text-xs text-by-text-secondary">All time · current workspace</p>
      <FigmaRow label="Imported calls">
        <span>{q.data?.importedCalls ?? "—"}</span>
      </FigmaRow>
      <FigmaRow label="Analyzed calls">
        <span>{q.data?.analyzedCalls ?? "—"}</span>
      </FigmaRow>
      <FigmaRow label="Analyzed seats">
        <span>{usage.data?.analyzed_reps ?? "Loading…"}</span>
      </FigmaRow>
      <FigmaRow label="Recording storage">
        <span>
          {usage.data
            ? `${(usage.data.storage_bytes / 1024 / 1024).toFixed(1)} MB · ${usage.data.known_size_recordings}/${usage.data.recordings} objects with size metadata`
            : "Loading…"}
        </span>
      </FigmaRow>
      {(q.error || usage.error) && (
        <p role="alert" className="mt-4 text-xs">
          Usage could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      )}
    </section>
  );
}
function RolePermissions() {
  return (
    <section className="space-y-5">
      <Users rolesOnly />
      <div className="rounded-lg border p-4 text-sm leading-6">
        <h2>Workspace access</h2>
        <p>
          Owners and admins manage workspace access. Managers review the agents assigned to their
          teams and invite agents through Teams. Agents see their own calls, evidence, reports and
          coaching. Notes can be edited or deleted only by their author. Private rooms are limited
          to their creator and invited members.
        </p>
        <Link className="figma-button mt-3" to="/app/settings" search={{ tab: "users" }}>
          Manage user access
        </Link>
      </div>
    </section>
  );
}
