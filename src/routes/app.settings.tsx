import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { StatusBadge, XpBar } from "@/components/app/MissionHeader";
import { WorkspaceHeader } from "@/components/app/WorkspaceHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  organizationQuery,
  organizationMembersQuery,
  subscriptionQuery,
  planEntitlementsQuery,
  integrationsQuery,
  usageQuery,
  saveIntegration,
  type OrgMember,
  type OrgRole,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  Check,
  Lock,
  Trash2,
  ShieldCheck,
  Settings as SettingsIcon,
  User,
  Building2,
  CreditCard,
  Plug,
  Skull,
  ExternalLink,
  Unplug,
  Users,
  UserPlus,
} from "lucide-react";
import { BusinessContextTab } from "@/components/app/settings/BusinessContextTab";
import { getCatalogByKey } from "@/lib/integrations-catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { blockIfGuest } from "@/lib/guest";

export const Route = createFileRoute("/app/settings")({
  validateSearch: (s: Record<string, unknown>): { tab?: string } => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }),
  component: SettingsPage,
});

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "context", label: "Business Context", icon: Brain },
  { key: "organization", label: "Organization", icon: Building2 },
  { key: "team", label: "Team", icon: Users },
  { key: "plan", label: "Plan", icon: CreditCard },
  { key: "connectors", label: "Connectors", icon: Plug },
  { key: "danger", label: "Danger zone", icon: Skull },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function SettingsPage() {
  const search = Route.useSearch();
  const initialTab = TABS.some((t) => t.key === search.tab) ? (search.tab as TabKey) : "profile";
  const [tab, setTab] = useState<TabKey>(initialTab);

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        variant="settings"
        icon={SettingsIcon}
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, organization, plan, and integrations."
      />

      {/* Tab bar */}
      <div
        className="flex gap-1 rounded-2xl p-1"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const isDanger = key === "danger";
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12.5px] font-medium transition-all duration-150 sm:justify-start sm:px-3"
              style={
                active
                  ? {
                      background: isDanger
                        ? "color-mix(in oklab, var(--destructive) 12%, var(--surface-2))"
                        : "var(--surface-2)",
                      color: isDanger ? "var(--destructive)" : "var(--foreground)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }
                  : {
                      color: isDanger
                        ? "color-mix(in oklab, var(--destructive) 70%, var(--muted-foreground))"
                        : "var(--muted-foreground)",
                    }
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <div>
        {tab === "profile" && <ProfileTab />}
        {tab === "context" && <BusinessContextTab />}
        {tab === "organization" && <OrgTab />}
        {tab === "team" && <TeamTab />}
        {tab === "plan" && <PlanTab />}
        {tab === "connectors" && <ConnectorsTab />}
        {tab === "danger" && <DangerTab />}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl shadow-card"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="px-6 py-4"
        style={{
          borderBottom: "1px solid color-mix(in oklab, var(--border) 60%, transparent)",
          background: "color-mix(in oklab, var(--surface-2) 40%, transparent)",
        }}
      >
        <div
          className="font-display text-[15px] font-semibold tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </div>
        {description && (
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
            {description}
          </div>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--foreground)" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function SaveButton({
  onClick,
  children = "Save changes",
}: {
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200"
      style={{
        background: "linear-gradient(135deg, var(--primary), var(--accent))",
        boxShadow: "0 4px 16px color-mix(in oklab, var(--primary) 30%, transparent)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 6px 20px color-mix(in oklab, var(--primary) 40%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "none";
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 4px 16px color-mix(in oklab, var(--primary) 30%, transparent)";
      }}
    >
      <Check className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function TeamTab() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const membersQ = useQuery({
    ...organizationMembersQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
  const members: OrgMember[] = membersQ.data ?? [];
  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["org-members", currentOrgId] });

  const invite = async () => {
    if (blockIfGuest("Sign up to invite teammates.")) return;
    if (!currentOrgId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("team-invite", {
        body: { organizationId: currentOrgId, email: email.trim(), role },
      });
      if (error) throw error;
      toast.success(
        (data as { status?: string })?.status === "added_existing"
          ? "Teammate added."
          : "Invite sent.",
      );
      setEmail("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not invite teammate.");
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (target: OrgMember, next: OrgRole) => {
    if (blockIfGuest()) return;
    if (!currentOrgId) return;
    const { error } = await supabase
      .from("organization_members")
      .update({ role: next })
      .eq("organization_id", currentOrgId)
      .eq("user_id", target.user_id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${target.email ?? "Member"} is now ${ROLE_LABEL[next]}.`);
      refresh();
    }
  };

  const removeMember = async (target: OrgMember) => {
    if (blockIfGuest()) return;
    if (!currentOrgId) return;
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", currentOrgId)
      .eq("user_id", target.user_id);
    if (error) toast.error(error.message);
    else {
      toast.success("Member removed.");
      refresh();
    }
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <Section title="Invite a teammate" description="They'll get access to this workspace.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Email address">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="rounded-xl"
                  style={{ background: "var(--surface-2)" }}
                />
              </Field>
            </div>
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
                className="h-10 rounded-xl px-3 text-[13px]"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <button
              onClick={invite}
              disabled={inviting}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
            >
              <UserPlus className="h-4 w-4" />
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>
        </Section>
      )}

      <Section
        title="Members"
        description={`${members.length} ${members.length === 1 ? "person" : "people"} in this workspace.`}
      >
        {membersQ.isLoading ? (
          <div className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Loading members…
          </div>
        ) : members.length === 0 ? (
          <div className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            No members yet.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {members.map((m) => {
              const isSelf = m.user_id === user?.id;
              const editable = canManage && m.role !== "owner" && !isSelf;
              return (
                <div key={m.user_id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[13.5px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {m.full_name || m.email || "Unknown"}
                      {isSelf && (
                        <span
                          className="ml-1.5 text-[11px]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          (you)
                        </span>
                      )}
                    </div>
                    {m.email && (
                      <div
                        className="truncate text-[12px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {m.email}
                      </div>
                    )}
                  </div>
                  {editable ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m, e.target.value as OrgRole)}
                      className="h-8 rounded-lg px-2 text-[12px]"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
                    >
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                  {editable && (
                    <button
                      onClick={() => removeMember(m)}
                      title="Remove member"
                      className="rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                      style={{ color: "var(--destructive)" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function ProfileTab() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState("");
  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile]);

  const save = async () => {
    if (blockIfGuest("Sign up to update your profile.")) return;
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      refreshProfile();
    }
  };

  const initials = (profile?.full_name || user?.email || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Section
      title="Your profile"
      description="How your name and avatar appear across the workspace."
    >
      {/* Avatar preview */}
      <div className="mb-5 flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-card"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
        >
          {initials}
        </div>
        <div>
          <div
            className="font-display text-[15px] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {profile?.full_name || "Your name"}
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {user?.email}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-xl"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
        <Field label="Email">
          <Input
            value={user?.email ?? ""}
            disabled
            className="rounded-xl opacity-50"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
        <Field label="Avatar URL">
          <Input
            placeholder="https://..."
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="rounded-xl"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
      </div>
      <SaveButton onClick={save}>Save profile</SaveButton>
    </Section>
  );
}

function OrgTab() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const orgQ = useQuery({ ...organizationQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [stage, setStage] = useState<string>("Idea");
  const [target, setTarget] = useState("");

  useEffect(() => {
    if (orgQ.data) {
      setName(orgQ.data.name ?? "");
      setNiche(orgQ.data.niche ?? "");
      setBusinessType(orgQ.data.business_type ?? "");
      setStage(orgQ.data.stage ?? "Idea");
      setTarget(orgQ.data.target_customer ?? "");
    }
  }, [orgQ.data]);

  const save = async () => {
    if (blockIfGuest("Sign up to manage your organization.")) return;
    if (!currentOrgId) return;
    const { error } = await supabase
      .from("organizations")
      .update({
        name,
        niche,
        business_type: businessType,
        target_customer: target,
        stage: stage as "Idea" | "Validate" | "Launch" | "Operate" | "Scale",
      })
      .eq("id", currentOrgId);
    if (error) toast.error(error.message);
    else {
      toast.success("Organization saved");
      qc.invalidateQueries({ queryKey: ["organization", currentOrgId] });
    }
  };

  return (
    <Section
      title="Organization"
      description="Help Bylda personalize tool outputs to your business."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
        <Field label="Business type">
          <Input
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="rounded-xl"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
        <Field label="Niche">
          <Input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="rounded-xl"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
        <Field label="Stage">
          <select
            className="flex h-9 w-full rounded-xl px-3 text-sm outline-none transition"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            {["Idea", "Validate", "Launch", "Operate", "Scale"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Target customer">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-xl"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
      </div>
      <SaveButton onClick={save}>Save organization</SaveButton>
    </Section>
  );
}

function PlanTab() {
  const { currentOrgId } = useAuth();
  const subQ = useQuery({ ...subscriptionQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const plansQ = useQuery(planEntitlementsQuery());
  const usageQ = useQuery({ ...usageQuery(currentOrgId ?? ""), enabled: !!currentOrgId });

  const current = subQ.data?.plan ?? "starter";
  const plans = plansQ.data ?? [];
  const totalUsed = (usageQ.data ?? []).reduce((s, r) => s + (r.count as number), 0);
  const currentPlan = plans.find((p) => p.plan === current);
  const limit = currentPlan?.monthly_generation_limit ?? 0;
  const pct = limit ? Math.min(100, (totalUsed / limit) * 100) : 0;

  return (
    <div className="space-y-4">
      <Section
        title="Current plan"
        description="Track your usage and upgrade when you need more headroom."
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="font-display text-[1.6rem] font-semibold capitalize tracking-tight leading-none"
              style={{ color: "var(--foreground)" }}
            >
              {current}
            </div>
            <div className="mt-1.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
              ${currentPlan?.price_usd ?? 0}/mo
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium" style={{ color: "var(--muted-foreground)" }}>
                Usage this month
              </span>
              <span className="font-mono" style={{ color: "var(--foreground)" }}>
                {totalUsed} / {limit || "∞"}
              </span>
            </div>
            <XpBar value={pct} />
          </div>
        </div>
      </Section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const isCurrent = p.plan === current;
          return (
            <div
              key={p.plan}
              className="relative rounded-2xl p-4 transition-all duration-200"
              style={{
                background: isCurrent
                  ? "color-mix(in oklab, var(--primary) 6%, var(--surface))"
                  : "var(--surface)",
                border: `1px solid ${isCurrent ? "color-mix(in oklab, var(--primary) 30%, transparent)" : "var(--border)"}`,
                boxShadow: isCurrent
                  ? "0 0 16px color-mix(in oklab, var(--primary) 10%, transparent)"
                  : "var(--shadow-card)",
              }}
            >
              {isCurrent && (
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--primary), var(--accent), transparent)",
                  }}
                />
              )}
              <div className="flex items-center justify-between">
                <div
                  className="font-display text-[14px] font-semibold capitalize tracking-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  {p.plan}
                </div>
                {isCurrent && <StatusBadge variant="active" live label="Active" />}
              </div>
              <div
                className="mt-2 font-display text-[1.5rem] font-semibold leading-none"
                style={{ color: "var(--foreground)" }}
              >
                ${p.price_usd}
                <span className="text-sm font-normal" style={{ color: "var(--muted-foreground)" }}>
                  /mo
                </span>
              </div>
              <ul
                className="mt-3 space-y-1.5 text-[12px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 shrink-0" style={{ color: "var(--success)" }} />
                  {p.monthly_generation_limit ?? "Unlimited"} generations / mo
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 shrink-0" style={{ color: "var(--success)" }} />
                  {p.allowed_tools.length} AI tools
                </li>
              </ul>
              {!isCurrent && (
                <button
                  className="mt-4 w-full rounded-xl py-1.5 text-[12px] font-semibold transition"
                  style={{
                    background: "color-mix(in oklab, var(--primary) 10%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  Upgrade
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Icon for connectors tab ───────────────────────────────────────────────────
const LETTER_COLORS_SETTINGS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

function ConnectorIcon({ slug, name }: { slug?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const bg = LETTER_COLORS_SETTINGS[name.charCodeAt(0) % LETTER_COLORS_SETTINGS.length];
  if (slug && !failed) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1">
        <img
          src={`https://cdn.simpleicons.org/${slug}`}
          alt={name}
          width={22}
          height={22}
          loading="lazy"
          className="object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
      style={{ background: bg }}
    >
      {name[0].toUpperCase()}
    </div>
  );
}

function ConnectorsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const intQ = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  const integrations = intQ.data ?? [];
  const connected = integrations.filter((i) => i.is_connected);
  const connectedCount = connected.length;

  const refresh = () => {
    if (user) qc.invalidateQueries({ queryKey: ["user_integrations", user.id] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="flex items-center justify-between rounded-2xl px-5 py-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div>
          <div
            className="font-display text-[14px] font-semibold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Connected integrations
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            Manage credentials for your active connections.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-medium"
            style={{
              background:
                connectedCount > 0
                  ? "color-mix(in oklab, var(--success) 12%, transparent)"
                  : "var(--surface-2)",
              border: `1px solid ${connectedCount > 0 ? "color-mix(in oklab, var(--success) 30%, transparent)" : "var(--border)"}`,
              color: connectedCount > 0 ? "var(--success)" : "var(--muted-foreground)",
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {connectedCount} connected
          </div>
        </div>
      </div>

      {/* Connected integrations list */}
      {connectedCount === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl py-14 text-center"
          style={{
            background: "var(--surface)",
            border: "1px dashed var(--border)",
          }}
        >
          <Plug className="h-8 w-8 mb-3" style={{ color: "var(--muted-foreground)" }} />
          <div className="text-[13px] font-medium mb-1" style={{ color: "var(--foreground)" }}>
            No integrations connected yet
          </div>
          <div className="text-[12px] mb-4" style={{ color: "var(--muted-foreground)" }}>
            Head to the Integrations page to connect your tools.
          </div>
          <Link to="/app/integrations">
            <Button size="sm" variant="default">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Browse integrations
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {connected.map((conn) => {
            const def = getCatalogByKey(conn.integration_key);
            const displayName = def?.name ?? conn.integration_key;
            const iconSlug = def?.iconSlug;
            const inputType = def?.inputType ?? "key";
            return (
              <ConnectorRow
                key={conn.integration_key}
                integrationKey={conn.integration_key}
                name={displayName}
                iconSlug={iconSlug}
                last4={conn.value_last4}
                inputType={inputType}
                onSaved={refresh}
              />
            );
          })}
        </div>
      )}

      {/* Browse more link */}
      <div
        className="flex items-center justify-between rounded-2xl px-5 py-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
          Looking to add more? Browse the full integration catalog.
        </div>
        <Link to="/app/integrations">
          <Button size="sm" variant="outline" className="gap-1.5 text-[12px]">
            <ExternalLink className="h-3.5 w-3.5" /> Browse catalog
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ConnectorRow({
  integrationKey,
  name,
  iconSlug,
  last4,
  inputType,
  onSaved,
}: {
  integrationKey: string;
  name: string;
  iconSlug?: string;
  last4: string | null;
  inputType: string;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const update = async () => {
    if (blockIfGuest("Sign up to manage integrations.")) return;
    if (!user || !val) return;
    setSaving(true);
    setErr(null);
    try {
      await saveIntegration(integrationKey, val);
      toast.success(`${name} updated`);
      setVal("");
      setExpanded(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (blockIfGuest("Sign up to manage integrations.")) return;
    if (!user) return;
    setSaving(true);
    try {
      await saveIntegration(integrationKey, "");
      toast.success(`${name} disconnected`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="overflow-hidden rounded-2xl transition-all duration-200"
      style={{
        background: "var(--surface)",
        border: "1px solid color-mix(in oklab, var(--success) 25%, transparent)",
        boxShadow: "0 0 10px color-mix(in oklab, var(--success) 6%, transparent)",
      }}
    >
      <div
        className="h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, var(--success), transparent)" }}
      />
      <div className="px-4 py-3 flex items-center gap-3">
        <ConnectorIcon slug={iconSlug} name={name} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
            {name}
          </div>
          {last4 && (
            <div className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
              ending …{last4}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded((x) => !x)}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition"
            style={{
              background: "color-mix(in oklab, var(--primary) 10%, transparent)",
              border: "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
              color: "var(--primary)",
            }}
          >
            Update
          </button>
          <button
            onClick={disconnect}
            disabled={saving}
            className="rounded-lg p-1.5 transition"
            style={{
              background: "color-mix(in oklab, var(--destructive) 8%, var(--surface-2))",
              border: "1px solid color-mix(in oklab, var(--destructive) 20%, transparent)",
              color: "var(--destructive)",
            }}
          >
            <Unplug className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={`New ${inputType === "url" ? "URL" : "API key / token"}`}
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                setErr(null);
              }}
              type={inputType === "url" ? "text" : "password"}
              className="rounded-xl text-[12.5px]"
              style={{ background: "var(--surface-2)" }}
            />
            <button
              onClick={update}
              disabled={saving || !val}
              className="shrink-0 rounded-xl px-4 text-[12px] font-semibold text-white transition disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--accent))",
              }}
            >
              {saving ? "…" : "Save"}
            </button>
          </div>
          {err && (
            <div
              className="flex items-center gap-1 text-[11.5px]"
              style={{ color: "var(--destructive)" }}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {err}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DangerTab() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const remove = async () => {
    if (blockIfGuest("This is a demo — no account to delete.")) return;
    if (!user) return;
    if (confirm !== "DELETE") {
      toast.error('Type "DELETE" to confirm');
      return;
    }
    await supabase.from("profiles").update({ full_name: "(deleted)" }).eq("id", user.id);
    await signOut();
    toast.success("Account deleted");
    navigate({ to: "/auth/sign-in" });
  };

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "color-mix(in oklab, var(--destructive) 4%, var(--surface))",
        border: "1px solid color-mix(in oklab, var(--destructive) 25%, transparent)",
      }}
    >
      <div
        className="px-6 py-4"
        style={{
          borderBottom: "1px solid color-mix(in oklab, var(--destructive) 15%, transparent)",
          background: "color-mix(in oklab, var(--destructive) 6%, transparent)",
        }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" style={{ color: "var(--destructive)" }} />
          <div
            className="text-[12px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--destructive)" }}
          >
            Danger zone
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        <h3
          className="font-display text-[16px] font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          Delete account
        </h3>
        <p
          className="mt-1.5 max-w-lg text-[13px] leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          This permanently signs you out and clears your profile. Your data on the server may be
          retained per policy.
        </p>
        <Button
          variant="destructive"
          onClick={() => setOpen(true)}
          className="mt-5 gap-2 rounded-xl"
        >
          <Trash2 className="h-4 w-4" /> Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirm deletion</DialogTitle>
            <DialogDescription>
              Type <span className="font-mono font-bold">DELETE</span> to confirm. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove}>
              Confirm delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
