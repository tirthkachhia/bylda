import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Avatar, Button, cn, DataBoundary } from "@/components/bylda";
import { useInviteMembers, useOnboarding } from "@/lib/data";
import { AuthField } from "./AuthLayout";
import { EMAIL_RE, errorMessage } from "./authForm";
import { inviteCandidates, type InviteCandidate } from "./onboardingDemo";
import { InsetNote, OnboardingLayout, StepActions, StepHeader } from "./OnboardingLayout";

/**
 * A9 · Onboarding — Invite team
 * Figma 26:496 (page 1:5) · Lane 4 — Dravin · route /welcome/invite-team · Flow 4
 */

const ROLE_LABEL: Record<InviteCandidate["role"], string> = {
  rep: "Rep",
  manager: "Manager",
  owner: "Owner",
};

export function A9OnboardingInviteTeam() {
  const onboarding = useOnboarding();
  return (
    <OnboardingLayout step={3}>
      <DataBoundary query={onboarding}>{() => <InviteForm />}</DataBoundary>
    </OnboardingLayout>
  );
}

function InviteForm() {
  const navigate = useNavigate();
  const invite = useInviteMembers();
  const matched = useMemo(inviteCandidates, []);
  const [on, setOn] = useState<string[]>(
    matched?.people.filter((p) => p.suggested).map((p) => p.id) ?? [],
  );
  const [emailsRaw, setEmailsRaw] = useState(matched?.emails ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const typed = emailsRaw
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const chosen = matched?.people.filter((p) => on.includes(p.id)) ?? [];
  const count = chosen.length + typed.length;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const bad = typed.filter((t) => !EMAIL_RE.test(t));
    if (bad.length) {
      setEmailError(`Check ${bad.join(", ")} — that doesn’t look like a full email address.`);
      return;
    }
    setEmailError(null);
    // One call per role — the invite mutation takes a single role.
    const byRole = new Map<string, string[]>();
    for (const p of chosen) byRole.set(p.role, [...(byRole.get(p.role) ?? []), p.email]);
    if (typed.length) byRole.set("rep", [...(byRole.get("rep") ?? []), ...typed]);
    try {
      for (const [role, emails] of byRole) await invite.mutateAsync({ emails, role });
      await navigate({ to: "/welcome/analysis" });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  return (
    <>
      <StepHeader
        eyebrow="Step 4 of 5"
        title="Invite your team."
        lead={
          matched
            ? `We matched ${matched.matchedCount} people from your ${matched.source} account to calls. Choose who to invite and their role.`
            : "Add your team by email. Everyone joins as Rep unless you change it."
        }
      />
      <form onSubmit={onSubmit} noValidate className="flex w-full flex-col items-start gap-5">
        {matched ? (
          <table className="w-full overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
            <thead className="border-b border-by-border-engraved bg-by-surface-inset">
              <tr className="type-mono-micro uppercase text-by-text-tertiary">
                <th className="w-[236px] py-[9px] pl-4 text-left font-medium">Person</th>
                <th className="w-[80px] text-left font-medium">Calls</th>
                <th className="w-[100px] text-left font-medium">Role</th>
                <th className="w-[150px] text-left font-medium">Team</th>
                <th className="pr-4 text-left font-medium">Invite</th>
              </tr>
            </thead>
            <tbody>
              {matched.people.map((p) => {
                const checked = on.includes(p.id);
                return (
                  <tr key={p.id} className="border-b border-by-border-engraved last:border-b-0">
                    <td className="py-2.5 pl-4">
                      <span className="flex items-center gap-2">
                        <Avatar name={p.name} size={22} />
                        <span className="type-ui-body-strong text-by-text-primary">{p.name}</span>
                      </span>
                    </td>
                    <td className="type-mono-data text-by-text-secondary">{p.calls}</td>
                    <td className="type-ui-small text-by-text-primary">{ROLE_LABEL[p.role]}</td>
                    <td className="type-ui-small text-by-text-primary">{p.team ?? "—"}</td>
                    <td className="pr-4">
                      <Switch
                        checked={checked}
                        label={`Invite ${p.name}`}
                        onChange={() =>
                          setOn((cur) => (checked ? cur.filter((x) => x !== p.id) : [...cur, p.id]))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
        <AuthField
          label={matched ? "Or add by email" : "Emails"}
          id="ob-invite-emails"
          type="text"
          autoComplete="off"
          placeholder="nina@company.com, luis@company.com"
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          error={emailError}
          hint="Separate with commas. Everyone joins as Rep unless you change it."
        />
        <InsetNote label="Rep privacy default">
          Reps see only their own calls and coaching. Change later in Roles &amp; permissions.
        </InsetNote>
        {formError ? (
          <InsetNote label="Couldn’t send invites" role="alert">
            {formError}
          </InsetNote>
        ) : null}
        <StepActions>
          <Button variant="ghost" asChild>
            <Link to="/welcome/analysis">Skip for now</Link>
          </Button>
          <Button type="submit" disabled={count === 0 || invite.isPending}>
            {invite.isPending
              ? "Sending…"
              : count === 1
                ? "Send 1 invite"
                : `Send ${count} invites`}
          </Button>
        </StepActions>
      </form>
    </>
  );
}

/** 32×18 toggle — ink track when on, muted when off. */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center align-middle rounded-by-pill transition-colors duration-200 ease-by-out",
        checked ? "bg-by-surface-control-dark" : "bg-by-surface-muted",
      )}
    >
      <span
        className={cn(
          "absolute size-3.5 rounded-by-pill bg-by-surface-raised transition-transform duration-200 ease-by-out",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
