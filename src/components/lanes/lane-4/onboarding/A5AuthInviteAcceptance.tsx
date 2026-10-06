import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Avatar, Button, DataBoundary, SystemState } from "@/components/bylda";
import { useAuthActions, useViewer, type Role, type Viewer } from "@/lib/data";
import { AuthField, AuthLayout, AuthNote, AuthTitle } from "./AuthLayout";
import { errorMessage } from "./authForm";
import { inviteSender } from "./inviteDemo";

const MIN_PASSWORD = 12;

/**
 * A5 · Auth — Invite acceptance
 * Figma 26:224 (page 1:5) · Lane 4 — Dravin · route /welcome/invite · Flow 5
 *
 * The Supabase invite link signs the invitee in before they land here, so `useViewer` is
 * the invitee: their workspace, team and role. Accepting = setting a password.
 */

const ROLE_LABEL: Record<Role, string> = {
  owner: "an Owner",
  admin: "an Admin",
  manager: "a Manager",
  rep: "a Rep",
  viewer: "a Viewer",
  coach: "a Coach",
};

/** "What you'll see" — product copy per role. Reps never get peer comparisons. */
const WHAT_YOULL_SEE: Record<"rep" | "manager" | "other", { lines: string[]; privacy: string }> = {
  rep: {
    lines: [
      "A 60-second brief each morning about your own calls",
      "One behavior to focus on — with the exact moments to hear",
      "Your progress over time. No team leaderboards.",
    ],
    privacy: "Your manager can see your calls and behavior profile. Other reps can’t.",
  },
  manager: {
    lines: [
      "A feed of what changed on your team’s calls, with the moments behind it",
      "Patterns worth coaching — each with confidence and sample size",
      "Whether the behavior you coached actually changed",
    ],
    privacy: "Reps see only their own calls and coaching. You see your team’s.",
  },
  other: {
    lines: [
      "What Bylda is noticing across the workspace’s calls",
      "Patterns with confidence and sample size — never a guess",
      "Reports you can share, linked back to real calls",
    ],
    privacy: "Reps see only their own calls and coaching.",
  },
};

const homeFor = (role: Role) => (role === "rep" ? "/app/rep" : "/app/home");

export function A5AuthInviteAcceptance() {
  const viewer = useViewer();
  return (
    <AuthLayout>
      <DataBoundary
        query={viewer}
        error={(err) =>
          err instanceof Error && err.message === "NOT_SIGNED_IN" ? (
            <InviteExpired />
          ) : (
            <SystemState
              eyebrow="INVITE · COULDN’T LOAD"
              title="We couldn’t open your invite."
              body={errorMessage(err)}
              actions={[{ label: "Try again", onClick: () => void viewer.refetch() }]}
            />
          )
        }
      >
        {(v) => <InviteForm viewer={v} />}
      </DataBoundary>
    </AuthLayout>
  );
}

/** The invite link signs you in; no session means it expired or was already used. */
function InviteExpired() {
  return (
    <>
      <AuthTitle>This invite link has expired</AuthTitle>
      <p className="type-ui-body text-by-text-secondary">
        Invite links work once and expire after a while. Ask whoever invited you to send a new one,
        or sign in if you’ve already joined.
      </p>
      <Button asChild className="w-full justify-start">
        <Link to="/welcome/sign-in">Sign in</Link>
      </Button>
    </>
  );
}

function InviteForm({ viewer }: { viewer: Viewer }) {
  const { updatePassword } = useAuthActions();
  const navigate = useNavigate();
  // Never "Dana invited Dana" — drop the fixture sender when it's the viewer.
  const [sender] = useState(() => {
    const s = inviteSender();
    return s && s.name !== viewer.name ? s : null;
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const workspace = viewer.workspace?.name ?? "your workspace";
  const copy =
    WHAT_YOULL_SEE[viewer.role === "rep" ? "rep" : viewer.role === "manager" ? "manager" : "other"];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use ${MIN_PASSWORD}+ characters.`);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await updatePassword(password);
      await navigate({ to: homeFor(viewer.role) });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2.5">
        {sender ? <Avatar name={sender.name} size={36} /> : null}
        <p className="type-ui-title text-by-text-primary">
          {sender ? `${sender.name} invited you to ${workspace}` : `You’re invited to ${workspace}`}
        </p>
      </div>
      <AuthTitle>
        {viewer.team
          ? `Join as ${ROLE_LABEL[viewer.role]} on ${viewer.team.name}`
          : `Join ${workspace} as ${ROLE_LABEL[viewer.role]}`}
      </AuthTitle>
      <section className="flex w-full flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-[18px] py-4">
        <span className="type-mono-micro uppercase text-by-text-tertiary">What you’ll see</span>
        <ul className="flex flex-col gap-2.5">
          {copy.lines.map((line) => (
            <li key={line} className="type-ui-small flex gap-2 text-by-text-primary">
              <span aria-hidden>—</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="type-mono-micro text-by-text-secondary">{copy.privacy}</p>
      </section>
      <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-[18px]">
        <AuthField
          label="Set a password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          autoFocus
        />
        <Button type="submit" className="w-full justify-start" disabled={pending}>
          {pending ? "Joining…" : "Accept and join"}
        </Button>
      </form>
      <button
        type="button"
        className="type-ui-small text-left text-by-text-secondary transition-colors duration-200 ease-by-out hover:text-by-text-primary"
        // GAP: useAuthActions has no OAuth action yet (LANE_REQUESTS.md #15).
        onClick={() =>
          setFormError("Google sign-in isn’t connected yet. Set a password to join for now.")
        }
      >
        {viewer.email ? `Or continue with Google (${viewer.email})` : "Or continue with Google"}
      </button>
      {formError ? <AuthNote label="Couldn’t join">{formError}</AuthNote> : null}
    </>
  );
}
