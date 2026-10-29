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
          <DeadSettings title={label} tab={tab} />
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
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(q.data?.name ?? "");
  }, [q.data?.name]);
  async function save() {
    if (!currentOrgId || !canEdit || !name.trim() || blockIfGuest()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .update({ name: name.trim() })
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
          <FigmaField label="Domain">
            <input disabled placeholder="Not available yet" />
            <small>People with this email domain can request to join.</small>
          </FigmaField>
          <FigmaRow label="Time zone" detail="Briefs and ‘yesterday’ use this.">
            <Inactive>Time zone —</Inactive>
          </FigmaRow>
          <FigmaRow label="Week starts on" detail="Weekly report schedule">
            <Inactive>—</Inactive>
          </FigmaRow>
          <FigmaRow
            label="Default language for analysis"
            detail="Transcription and behavior detection"
          >
            <Inactive>—</Inactive>
          </FigmaRow>
          <FigmaRow label="Allow join requests from domain">
            <input type="checkbox" disabled aria-label="Allow join requests from domain" />
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
        <FigmaRow label="Delete workspace" detail="Not available yet">
          <Inactive>Delete workspace</Inactive>
        </FigmaRow>
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
        <Inactive>Change photo</Inactive>
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
        <Inactive>Schedule —</Inactive>
      </FigmaRow>
      <FigmaRow label="Password">
        <Link className="figma-button" to="/auth/forgot-password">
          Change
        </Link>
      </FigmaRow>
      <FigmaRow label="Two-factor authentication">
        <input type="checkbox" disabled aria-label="Two-factor authentication" />
      </FigmaRow>
      <FigmaRow label="Sessions">
        <Inactive>Sign out others</Inactive>
      </FigmaRow>
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
  const [role, setRole] = useState<"member" | "admin">("member");
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
        <Inactive>Export</Inactive>
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
          <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {["Free", "Team", "Growth", "Scale"].map((name) => (
              <article
                key={name}
                className="rounded-xl border border-by-border-engraved p-4 opacity-50"
                data-unavailable="true"
              >
                <h2 className="!text-xs uppercase">{name}</h2>
                <p className="my-3 text-2xl">—</p>
                <p className="mb-4 text-[11px] text-by-text-secondary">
                  Plan mapping not available yet
                </p>
                <Inactive>{name === "Scale" ? "Upgrade" : "Switch"}</Inactive>
              </article>
            ))}
          </div>
          <FigmaRow label="Analyzed seats">
            <span>—</span>
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
                      <Inactive>Download PDF</Inactive>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-by-text-secondary">No invoices available.</p>
          )}
          <p className="mt-5 rounded-lg bg-amber-50 p-4 text-xs">
            Figma’s seat-based tiers are inactive until they map to backend billing products. Your
            existing account plan and billing portal remain available.
          </p>
        </>
      )}
    </section>
  );
}
function Usage() {
  const { currentOrgId } = useAuth();
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
        <span>—</span>
      </FigmaRow>
      <FigmaRow label="Recording storage">
        <span>—</span>
      </FigmaRow>
      {q.error && (
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
  const capabilities = [
    "Workspace, billing, integrations",
    "Methodology & behavior rules",
    "Users & teams",
    "See team intelligence & patterns",
    "See calls & call review",
    "Hear call audio",
    "See other reps’ behavior profiles",
    "Assign coaching",
    "Receive coaching / daily rep brief",
    "Rep comparison & team overview",
    "Share call clips with reps",
  ];
  return (
    <section>
      <h1>Roles & permissions</h1>
      <p className="my-3 text-xs text-by-text-secondary">
        The Figma capability matrix and rep-privacy controls are not available yet. Existing account
        roles are managed under Users.
      </p>
      <div className="overflow-x-auto">
        <table className="figma-table">
          <thead>
            <tr>
              <th>Capability</th>
              {["Owner", "Manager", "Rep", "Viewer", "Coach"].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((label) => (
              <tr key={label}>
                <td>{label}</td>
                {[1, 2, 3, 4, 5].map((i) => (
                  <td key={i} data-unavailable="true">
                    —
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Rep privacy</h3>
      {[
        "Reps can see their own calls",
        "Reps can see teammates’ calls",
        "Show reps team averages",
        "Leaderboards",
      ].map((label) => (
        <FigmaRow key={label} label={label}>
          <Inactive>Unavailable</Inactive>
        </FigmaRow>
      ))}
      <Link className="figma-button mt-5" to="/app/settings" search={{ tab: "users" }}>
        Manage existing user roles
      </Link>
    </section>
  );
}
function DeadSettings({ title, tab }: { title: string; tab: string }) {
  if (tab === "teams")
    return (
      <section>
        <div className="flex items-center justify-between gap-4">
          <h1>Teams</h1>
          <Inactive>New team</Inactive>
        </div>
        <p className="my-3 text-xs text-by-text-secondary">
          Team-level methodology and routing are not available yet.
        </p>
        <div className="overflow-x-auto">
          <table className="figma-table">
            <thead>
              <tr>
                {["Team", "Manager", "Reps", "Methodology", "Brief time"].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
        <div className="figma-empty mt-4">Team management is not available yet.</div>
      </section>
    );
  if (tab === "notifications")
    return (
      <section>
        <h1>Notifications</h1>
        <p className="my-3 text-xs text-by-text-secondary">
          Notification preferences and delivery routing are not available yet. This matrix does not
          show saved settings.
        </p>
        <div className="overflow-x-auto">
          <table className="figma-table">
            <thead>
              <tr>
                <th>Notify me about</th>
                {["In-app", "Email", "Slack", "Push"].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                "Daily brief",
                "Behavior regression on my team",
                "Important call",
                "Coaching acknowledged / completed",
                "Emerging pattern",
                "Integration problem",
                "Report ready",
              ].map((label) => (
                <tr key={label}>
                  <td>{label}</td>
                  {["In-app", "Email", "Slack", "Push"].map((channel) => (
                    <td key={channel}>
                      <input
                        type="checkbox"
                        disabled
                        aria-label={`${label}: ${channel} unavailable`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FigmaRow label="Quiet hours" detail="Nothing but the brief outside these hours.">
          <Inactive>—</Inactive>
        </FigmaRow>
        <FigmaRow label="Batch low-priority items into the brief">
          <input
            type="checkbox"
            disabled
            aria-label="Batch low-priority notifications unavailable"
          />
        </FigmaRow>
      </section>
    );
  const labels: Record<string, string[]> = {
    analysis: [
      "Minimum calls before judging a rep",
      "Minimum confidence for coaching suggestions",
      "Baseline window",
      "Exclude calls shorter than",
      "Internal calls",
      "Outcome associations",
      "Language for relationships",
      "Save",
      "Reset to defaults",
    ],
    privacy: [
      "Keep call audio for",
      "Keep transcripts for",
      "Keep behavioral events & insights for",
      "Redact PII in transcripts",
      "Recording consent notice",
      "Use data to train shared models",
      "Export all data",
      "Delete a person’s data",
      "DPA & subprocessors",
    ],
    rules: ["New behavior rule"],
    objections: ["New objection"],
    success: ["Define success criteria"],
    api: ["Create API key"],
    audit: ["Export audit log"],
  };
  return (
    <section>
      <h1>{title}</h1>
      <p className="mt-2 text-xs text-by-text-secondary">Not available yet.</p>
      {(labels[tab] ?? ["Save changes"]).map((label) => (
        <FigmaRow key={label} label={label}>
          <Inactive>
            {label.startsWith("Save") ||
            label.startsWith("Create") ||
            label.startsWith("New") ||
            label.startsWith("Export") ||
            label.startsWith("Reset")
              ? label
              : "—"}
          </Inactive>
        </FigmaRow>
      ))}
    </section>
  );
}
