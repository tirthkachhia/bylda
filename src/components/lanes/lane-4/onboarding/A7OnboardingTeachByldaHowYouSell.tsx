import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, cn, DataBoundary } from "@/components/bylda";
import {
  useMethodologies,
  useOnboarding,
  useSaveOnboarding,
  type Methodology,
  type MethodologyStage,
  type SuccessCriterion,
} from "@/lib/data";
import { errorMessage } from "./authForm";
import { clearDraft, readDraft } from "./onboardingDraft";
import { teachDemoBehaviors } from "./onboardingDemo";
import {
  Chip,
  ChipRow,
  FieldLabel,
  InsetNote,
  OnboardingLayout,
  StepActions,
  StepHeader,
} from "./OnboardingLayout";

/**
 * A7 · Onboarding — Teach Bylda how you sell
 * Figma 15:2 (page 1:5) · Lane 4 — Dravin · route /welcome/teach · Flow 4
 */

type Template = Methodology["template"];

const MODES = [
  { key: "template", title: "Start from a template", sub: "MEDDIC, SPIN, Challenger, Sandler" },
  { key: "questions", title: "Answer 6 questions", sub: "~4 minutes, manual" },
  { key: "playbook", title: "Upload your playbook", sub: "Bylda drafts it for you" },
] as const;
type Mode = (typeof MODES)[number]["key"];

const TEMPLATES: { key: Template; label: string }[] = [
  { key: "meddic", label: "MEDDIC" },
  { key: "spin", label: "SPIN" },
  { key: "challenger", label: "Challenger" },
  { key: "sandler", label: "Sandler" },
  { key: "bant", label: "BANT" },
  { key: "custom", label: "Our own" },
];
const templateLabel = (t: Template) => TEMPLATES.find((x) => x.key === t)?.label ?? t;

const DEFAULT_OBJECTIONS = [
  "Price / budget",
  "Timing",
  "Already have a tool",
  "Implementation risk",
];
const MORE_OBJECTIONS = ["Need to check with team"];

const OUTCOMES: { key: SuccessCriterion["outcome"]; label: string; on: boolean }[] = [
  { key: "next_step_booked", label: "Next step booked", on: true },
  { key: "stage_advanced", label: "Stage advanced (from CRM)", on: true },
  { key: "closed_won_lost", label: "Closed-won / lost", on: true },
  { key: "meeting_held", label: "Meeting held", on: false },
];

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export function A7OnboardingTeachByldaHowYouSell() {
  const onboarding = useOnboarding();
  const methodologies = useMethodologies();
  return (
    <OnboardingLayout step={1} width={640} top={56} aside={<WhatThisChanges />}>
      <StepHeader
        eyebrow="Step 2 of 5"
        title="Teach Bylda how your team sells."
        lead="Bylda judges behavior against your process, not a generic one. You can change all of this later."
      />
      <DataBoundary query={onboarding}>
        {(state) => (
          // An empty methodology list is fine — the template chips still work.
          <DataBoundary query={{ ...methodologies, isEmpty: false }}>
            {(list) => (
              <TeachForm
                methodologies={list ?? []}
                initialTemplate={
                  (state.methodologyTemplate as Template | null) ??
                  list?.find((m) => m.isActive)?.template ??
                  "meddic"
                }
              />
            )}
          </DataBoundary>
        )}
      </DataBoundary>
    </OnboardingLayout>
  );
}

function TeachForm({
  methodologies,
  initialTemplate,
}: {
  methodologies: Methodology[];
  initialTemplate: Template;
}) {
  const navigate = useNavigate();
  const save = useSaveOnboarding();
  const [mode, setMode] = useState<Mode>("template");
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const methodology = withDemoBehaviors(methodologies.find((m) => m.template === template) ?? null);
  const [stages, setStages] = useState<MethodologyStage[]>(methodology?.stages ?? []);
  const [enabled, setEnabled] = useState<string[]>(
    methodology?.behaviors.filter((b) => b.enabled).map((b) => b.key) ?? [],
  );
  const [objections, setObjections] = useState<string[]>(DEFAULT_OBJECTIONS);
  const [objectionOptions, setObjectionOptions] = useState<string[]>([
    ...DEFAULT_OBJECTIONS,
    ...MORE_OBJECTIONS,
  ]);
  const [adding, setAdding] = useState(false);
  const [newObjection, setNewObjection] = useState("");
  const [outcomes, setOutcomes] = useState<string[]>(
    OUTCOMES.filter((o) => o.on).map((o) => o.key),
  );
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [teamSized] = useState(() => typeof readDraft().team_size === "string");

  function pickTemplate(t: Template) {
    setTemplate(t);
    const m = withDemoBehaviors(methodologies.find((x) => x.template === t) ?? null);
    setStages(m?.stages ?? []);
    setEnabled(m?.behaviors.filter((b) => b.enabled).map((b) => b.key) ?? []);
  }

  function moveStage(from: number, to: number) {
    if (from === to) return;
    setStages((cur) => {
      const next = [...cur];
      const [s] = next.splice(from, 1);
      next.splice(to, 0, s);
      return next.map((x, i) => ({ ...x, order: i }));
    });
  }

  function addObjection() {
    const label = newObjection.trim();
    if (label && !objectionOptions.includes(label)) {
      setObjectionOptions((cur) => [...cur, label]);
      setObjections((cur) => [...cur, label]);
    }
    setNewObjection("");
    setAdding(false);
  }

  function onAddKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addObjection();
    } else if (e.key === "Escape") {
      setNewObjection("");
      setAdding(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await save.mutateAsync({
        ...readDraft(),
        step: "teach",
        methodology_template: template,
        stages: stages.map((s) => s.key),
        behaviors: enabled,
        objections,
        outcomes,
      });
      clearDraft();
      await navigate({ to: "/welcome/connect" });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full flex-col items-start gap-[22px]">
      <div role="radiogroup" aria-label="How to set up" className="flex w-full gap-2.5">
        {MODES.map((m) => {
          const on = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMode(m.key)}
              className={cn(
                "flex flex-1 flex-col gap-1 rounded-by-card border px-3.5 py-3 text-left transition-colors duration-200 ease-by-out",
                on
                  ? "border-by-border-focus bg-by-surface-raised"
                  : "border-by-border-engraved bg-by-surface-inset hover:bg-by-surface-hover",
              )}
            >
              <span className="type-ui-body-strong text-by-text-primary">{m.title}</span>
              <span className="type-ui-small text-by-text-secondary">{m.sub}</span>
            </button>
          );
        })}
      </div>

      {mode !== "template" ? (
        // GAP: no question flow or playbook upload in the data layer yet (LANE_REQUESTS.md #19).
        <InsetNote label="Not ready yet" role="status">
          {mode === "questions"
            ? "The 6-question setup isn’t live yet. Start from a template — you can edit every stage and behavior later in Methodology."
            : "Playbook upload isn’t live yet. Start from a template — you can edit every stage and behavior later in Methodology."}
        </InsetNote>
      ) : (
        <>
          <Section label="Methodology" hint={`Template: ${templateLabel(template)}`}>
            <div
              role="radiogroup"
              aria-label="Methodology"
              className="flex w-full flex-wrap gap-1.5"
            >
              {TEMPLATES.map((t) => (
                <Chip
                  key={t.key}
                  role="radio"
                  selected={template === t.key}
                  onClick={() => pickTemplate(t.key)}
                >
                  {template === t.key ? `✓ ${t.label}` : t.label}
                </Chip>
              ))}
            </div>
          </Section>

          {methodology ? (
            <>
              <Section label="Stages on your calls" hint="drag to reorder">
                <ol className="flex w-full overflow-hidden rounded-by-control border border-by-border-engraved bg-by-surface-raised">
                  {stages.map((s, i) => (
                    <li
                      key={s.key}
                      draggable
                      onDragStart={() => setDragFrom(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragFrom !== null) moveStage(dragFrom, i);
                        setDragFrom(null);
                      }}
                      className={cn(
                        "type-ui-small flex-1 cursor-grab border-r border-by-border-engraved px-2.5 py-2.5 text-by-text-primary last:border-r-0",
                        dragFrom === i && "bg-by-surface-hover",
                      )}
                    >
                      {s.name}
                    </li>
                  ))}
                </ol>
              </Section>

              <Section
                label="Behaviors that matter to you"
                hint={`pre-selected from ${templateLabel(template)}${teamSized ? " + your team size" : ""}`}
              >
                <ul className="flex w-full flex-col rounded-by-card border border-by-border-engraved bg-by-surface-raised px-3.5 py-1.5">
                  {methodology.behaviors.map((b) => {
                    const on = enabled.includes(b.key);
                    return (
                      <li
                        key={b.key}
                        className="border-b border-by-border-engraved last:border-b-0"
                      >
                        <label className="flex cursor-pointer items-center gap-2.5 py-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setEnabled((cur) => toggle(cur, b.key))}
                            className="size-3.5 shrink-0 cursor-pointer appearance-none rounded-[2px] border border-by-border-strong bg-by-surface-raised checked:border-by-surface-control-dark checked:bg-by-surface-control-dark"
                          />
                          <span
                            className={cn(
                              "type-ui-small flex-1",
                              on ? "text-by-text-primary" : "text-by-text-tertiary",
                            )}
                          >
                            {b.name}
                          </span>
                          <span className="type-mono-micro max-w-[320px] truncate text-right text-by-text-tertiary">
                            {on ? b.definition : `off — ${b.definition}`}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            </>
          ) : (
            <InsetNote label={`${templateLabel(template)} template`}>
              Bylda drafts {templateLabel(template)} stages and behaviors after setup. You can edit
              them any time in Methodology.
            </InsetNote>
          )}

          <Section label="Objections you hear most">
            <ChipRow label="Objections you hear most">
              {objectionOptions.map((o) => {
                const on = objections.includes(o);
                return (
                  <Chip
                    key={o}
                    selected={on}
                    onClick={() => setObjections((cur) => toggle(cur, o))}
                  >
                    {on ? `✓ ${o}` : o}
                  </Chip>
                );
              })}
              {adding ? (
                <input
                  autoFocus
                  aria-label="New objection"
                  value={newObjection}
                  onChange={(e) => setNewObjection(e.target.value)}
                  onKeyDown={onAddKey}
                  onBlur={addObjection}
                  placeholder="e.g. Security review"
                  className="type-ui-small w-44 rounded-by-pill border border-by-focus-ring bg-by-surface-raised px-2.5 py-[5px] text-by-text-primary outline-none placeholder:text-by-text-tertiary"
                />
              ) : (
                <Chip selected={false} onClick={() => setAdding(true)}>
                  + Add
                </Chip>
              )}
            </ChipRow>
          </Section>

          <Section label="Outcomes Bylda should learn from">
            <ChipRow label="Outcomes Bylda should learn from">
              {OUTCOMES.map((o) => {
                const on = outcomes.includes(o.key);
                return (
                  <Chip
                    key={o.key}
                    selected={on}
                    onClick={() => setOutcomes((cur) => toggle(cur, o.key))}
                  >
                    {on ? `✓ ${o.label}` : o.label}
                  </Chip>
                );
              })}
            </ChipRow>
          </Section>
        </>
      )}

      {formError ? (
        <InsetNote label="Couldn’t save" role="alert">
          {formError}
        </InsetNote>
      ) : null}
      <StepActions>
        <Button variant="ghost" asChild>
          <Link to="/welcome/workspace">Back</Link>
        </Button>
        <Button type="submit" disabled={mode !== "template" || save.isPending}>
          {save.isPending ? "Saving…" : "Continue — connect calls"}
        </Button>
      </StepActions>
    </form>
  );
}

/** Mocks-only: Figma's 7-behavior MEDDIC starter set in place of the fixture's 4. */
function withDemoBehaviors(m: Methodology | null): Methodology | null {
  const demo = m ? teachDemoBehaviors(m.template) : null;
  if (!m || !demo) return m;
  const byKey = new Map(m.behaviors.map((b) => [b.key, b]));
  return {
    ...m,
    behaviors: demo.map((d) => ({
      ...(byKey.get(d.key) ?? {
        key: d.key,
        rule: {},
        methodologyId: m.id,
        higherIsBetter: true,
      }),
      key: d.key,
      name: d.name,
      definition: d.definition,
      enabled: d.enabled,
    })),
  };
}

function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <FieldLabel strong hint={hint}>
        {label}
      </FieldLabel>
      {children}
    </div>
  );
}

/** Right-hand card — examples of what this setup lets Bylda say. Static copy, not data. */
function WhatThisChanges() {
  return (
    <aside className="flex flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[22px] py-5">
      <span className="type-mono-micro uppercase text-by-text-tertiary">What this changes</span>
      <p className="type-ui-small text-by-text-secondary">
        With this setup, Bylda will tell you things like:
      </p>
      {[
        "Mia skipped Metrics in discovery on 5 of 7 calls.",
        "Price objections were handled best when the rep asked one question first.",
        "Economic buyer not identified on 3 deals in Pricing.",
      ].map((q) => (
        <p key={q} className="type-editorial-quote text-by-text-primary">
          “{q}”
        </p>
      ))}
      <p className="type-mono-micro text-by-text-tertiary">
        It won’t score reps on behaviors you turned off.
      </p>
    </aside>
  );
}
