import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Button, cn } from "@/components/bylda";
import { mocksForced, useAuthActions } from "@/lib/data";
import { AuthLayout, AuthLead, AuthNote, AuthTitle } from "./AuthLayout";
import { errorMessage } from "./authForm";

const route = getRouteApi("/welcome/verify");
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 60;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * A3 · Auth — Verify email
 * Figma 26:139 (page 1:5) · Lane 4 — Dravin · route /welcome/verify?email= · Flow 4
 */
export function A3AuthVerifyEmail() {
  const { email } = route.useSearch();
  const { resendVerification } = useAuthActions();
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [note, setNote] = useState<{ label: string; text: string } | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const code = digits.join("");
  const complete = code.length === CODE_LENGTH;
  const focus = (i: number) => inputs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]?.focus();

  function setAt(i: number, value: string) {
    const d = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => prev.map((p, j) => (j === i ? d : p)));
    if (d) focus(i + 1);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i]) focus(i - 1);
    if (e.key === "ArrowLeft") focus(i - 1);
    if (e.key === "ArrowRight") focus(i + 1);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setDigits(Array.from({ length: CODE_LENGTH }, (_, j) => pasted[j] ?? ""));
    focus(pasted.length);
  }

  async function onVerify() {
    if (!complete) {
      setNote({ label: "Almost", text: `Enter all ${CODE_LENGTH} digits from the email.` });
      focus(code.length);
      return;
    }
    // GAP: useAuthActions has no verifyOtp yet (LANE_REQUESTS.md #15). Supabase confirms the
    // address through the emailed link, so real mode points there instead of faking a check.
    if (!mocksForced()) {
      setNote({
        label: "Use the link",
        text: "Code entry isn’t connected yet. Open the link in the email we sent to finish.",
      });
      return;
    }
    await navigate({ to: "/welcome/workspace" });
  }

  async function onResend() {
    if (!email || cooldown > 0) return;
    try {
      await resendVerification(email);
      setNote({ label: "Sent", text: `New code sent to ${email}.` });
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setNote({ label: "Couldn’t resend", text: errorMessage(err) });
    }
  }

  return (
    <AuthLayout>
      <AuthTitle>Check your inbox</AuthTitle>
      <AuthLead>
        {email ? `We sent a 6-digit code to ${email}.` : "We sent a 6-digit code to your email."}
      </AuthLead>
      <div className="flex gap-2.5" role="group" aria-label="Verification code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            autoFocus={i === 0}
            className={cn(
              "type-mono-metric h-16 w-14 rounded-by-control border bg-by-surface-raised text-center text-by-text-primary outline-none transition-colors duration-200 ease-by-out",
              "border-by-border-strong focus:border-by-focus-ring",
            )}
          />
        ))}
      </div>
      <Button className="w-full justify-start" onClick={onVerify}>
        Verify
      </Button>
      {note ? <AuthNote label={note.label}>{note.text}</AuthNote> : null}
      <p className="type-ui-small text-by-text-secondary">
        Didn’t get it?{" "}
        {cooldown > 0 || !email ? (
          <span>Resend in {clock(cooldown)}</span>
        ) : (
          <button type="button" onClick={onResend} className="hover:text-by-text-primary">
            Resend code
          </button>
        )}{" "}
        ·{" "}
        <Link to="/welcome/sign-up" className="hover:text-by-text-primary">
          Wrong email?
        </Link>
      </p>
    </AuthLayout>
  );
}
