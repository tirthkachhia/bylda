import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, DataBoundary } from "@/components/bylda";
import { useOnboarding, useViewer, type Role } from "@/lib/data";
import { AuthField } from "./AuthLayout";
import { workspaceDemoDefaults } from "./onboardingDemo";
import { readDraft, writeDraft } from "./onboardingDraft";
import {
  Chip,
  ChipRow,
  FieldLabel,
  InsetNote,
  OnboardingLayout,
  SelectField,
  StepActions,
  StepHeader,
} from "./OnboardingLayout";

/**
 * A6 · Onboarding — Workspace setup
 * Figma 26:784 (page 1:5) · Lane 4 — Dravin · route /welcome/workspace · Flow 4
 */

const TEAM_SIZES = ["1–5 reps", "6–15 reps", "16–50 reps", "51+ reps"] as const;
const INDUSTRIES = [
  "B2B SaaS",
  "B2B SaaS · logistics software",
  "Fintech",
  "Healthcare",
  "Manufacturing",
  "Professional services",
  "Other",
] as const;
const MOTIONS = [
  "Inbound",
  "Outbound",
  "Mid-market (30–60 day cycle)",
  "Enterprise",
  "Transactional (< 1 call)",
  "Renewal / expansion",
] as const;
const ROLES = [
  "Sales manager",
  "VP / Head of sales",
  "RevOps / enablement",
  "Founder",
  "Rep",
] as const;
type RoleChoice = (typeof ROLES)[number];

/** Best guess from the viewer's workspace role — the user can change it. */
const ROLE_DEFAULT: Partial<Record<Role, RoleChoice>> = {
  manager: "Sales manager",
  admin: "RevOps / enablement",
  coach: "RevOps / enablement",
  rep: "Rep",
};

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

function sizeBucket(reps: number | undefined): string {
  if (!reps) return "";
  if (reps <= 5) return TEAM_SIZES[0];
  if (reps <= 15) return TEAM_SIZES[1];
  if (reps <= 50) return TEAM_SIZES[2];
  return TEAM_SIZES[3];
}

export function A6OnboardingWorkspaceSetup() {
  const onboarding = useOnboarding();
  const viewer = useViewer();
  return (
    <OnboardingLayout step={0}>
      <StepHeader
        eyebrow="Step 1 of 5"
        title="Tell us about your team."
        lead="This sets defaults for the behaviors Bylda watches. Nothing here is permanent."
      />
      <DataBoundary query={onboarding}>
        {(state) => (
          <WorkspaceForm
            company={state.workspaceName ?? viewer.data?.workspace?.name ?? ""}
            teamSize={sizeBucket(viewer.data?.team?.repCount)}
            role={(viewer.data && ROLE_DEFAULT[viewer.data.role]) ?? ""}
          />
        )}
      </DataBoundary>
    </OnboardingLayout>
  );
}

function WorkspaceForm(defaults: { company: string; teamSize: string; role: RoleChoice | "" }) {
  const navigate = useNavigate();
  // A previous visit's answers win over the defaults (Back from A7).
  const [draft] = useState(readDraft);
  const [company, setCompany] = useState(str(draft.business_name) ?? defaults.company);
  const [teamSize, setTeamSize] = useState(str(draft.team_size) ?? defaults.teamSize);
  // GAP: industry, sales motion and role aren't on OnboardingState yet (LANE_REQUESTS.md #19).
  const [demo] = useState(workspaceDemoDefaults);
  const [industry, setIndustry] = useState(str(draft.industry) ?? demo?.industry ?? "");
  const [motions, setMotions] = useState<string[]>(
    Array.isArray(draft.sales_motions) ? (draft.sales_motions as string[]) : (demo?.motions ?? []),
  );
  const [role, setRole] = useState<RoleChoice | "">(
    (ROLES as readonly string[]).includes(str(draft.role) ?? "")
      ? (draft.role as RoleChoice)
      : defaults.role,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleMotion = (m: string) =>
    setMotions((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!company.trim()) next.company = "Add your company name.";
    if (!teamSize) next.teamSize = "Pick a team size.";
    if (!role) next.role = "Pick your role — it decides your Home.";
    setErrors(next);
    if (Object.keys(next).length) return;
    // Saved with A7's answers in one complete-onboarding call (see onboardingDraft.ts).
    writeDraft({
      business_name: company.trim(),
      team_size: teamSize,
      industry: industry || null,
      sales_motions: motions,
      role,
    });
    await navigate({ to: "/welcome/teach" });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full flex-col items-start gap-5">
      <AuthField
        label="Company"
        id="ob-company"
        autoComplete="organization"
        placeholder="Your company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        error={errors.company}
      />
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <SelectField
          id="ob-team-size"
          label="Team size"
          placeholder="How many reps?"
          options={TEAM_SIZES}
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          error={errors.teamSize}
          required
        />
        <SelectField
          id="ob-industry"
          label="Industry"
          placeholder="Choose an industry"
          options={INDUSTRIES}
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          required
        />
      </div>
      <FieldLabel>Primary sales motion</FieldLabel>
      <ChipRow label="Primary sales motion">
        {MOTIONS.map((m) => (
          <Chip key={m} selected={motions.includes(m)} onClick={() => toggleMotion(m)}>
            {m}
          </Chip>
        ))}
      </ChipRow>
      <FieldLabel>Your role</FieldLabel>
      <div role="radiogroup" aria-label="Your role" className="flex w-full flex-wrap gap-1.5">
        {ROLES.map((r) => (
          <Chip key={r} role="radio" selected={role === r} onClick={() => setRole(r)}>
            {r}
          </Chip>
        ))}
      </div>
      {errors.role ? (
        <p role="alert" className="type-mono-micro -mt-3 text-by-feedback-error">
          {errors.role}
        </p>
      ) : null}
      <InsetNote label="Why we ask">
        Role decides your Home. Managers get the team feed; owners/RevOps get workspace health
        first; reps get the daily brief.
      </InsetNote>
      <StepActions>
        <Button type="submit">Continue</Button>
      </StepActions>
    </form>
  );
}
