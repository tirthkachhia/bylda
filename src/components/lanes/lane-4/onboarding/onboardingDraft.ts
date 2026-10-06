/**
 * A6 → A7 answer draft. `useSaveOnboarding` wraps `complete-onboarding`, a one-shot completion
 * saga — not a per-step save (LANE_REQUESTS.md #19) — so A6 keeps its answers here and A7
 * saves both steps in one call. sessionStorage keeps them across a reload; failures are ignored.
 */
const KEY = "bylda.onboarding.draft";

export type OnboardingDraft = Record<string, unknown>;

let memory: OnboardingDraft = {};

export function readDraft(): OnboardingDraft {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as OnboardingDraft;
  } catch {
    // private mode / no storage — the in-memory copy is enough
  }
  return memory;
}

export function writeDraft(patch: OnboardingDraft) {
  memory = { ...readDraft(), ...patch };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}

export function clearDraft() {
  memory = {};
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
