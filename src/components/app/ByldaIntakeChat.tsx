// ByldaIntakeChat — generalized conversational intake used by both onboarding
// tracks. Supports text, single-select chips, and multi-select chips, an
// accent color per track, per-answer persistence callbacks, and resuming a
// previously abandoned session (initialAnswers/initialStep).

import React, { useState, useEffect, useRef } from "react";
import { Mic, Sparkles } from "lucide-react";
import type { IntakeQuestion, IntakeChipOption } from "@/constants/onboarding-questions";
import { useSpeechInput } from "@/hooks/use-speech-input";

export type IntakeAnswers = Record<string, string | string[]>;

interface Props {
  questions: IntakeQuestion[];
  accent: string; // e.g. "#f97316" (create) | "#06b6d4" (operate)
  accentDark: string; // gradient partner
  initialAnswers?: IntakeAnswers;
  initialStep?: number;
  /** Persistent "you are here" stage path, shown under the progress bar. */
  stageSpine?: React.ReactNode;
  /** Fired after every answer — used for per-step persistence. */
  onAnswer?: (key: string, value: string | string[], step: number) => void;
  onComplete: (answers: IntakeAnswers) => Promise<void> | void;
}

type Msg = { id: string; from: "bylda" | "user"; text: string };

const ANIM = `
  @keyframes msgIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dot {
    0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
    40%           { opacity: 1;   transform: scale(1);   }
  }
  @keyframes chipIn {
    from { opacity: 0; transform: scale(0.96) translateY(6px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes ambientPulse {
    0%   { opacity: 0.55; }
    50%  { opacity: 1; }
    100% { opacity: 0.55; }
  }
`;

function answerLabel(q: IntakeQuestion, value: string | string[]): string {
  if (q.type === "text") return String(value).trim();
  const options = q.options;
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  return Array.isArray(value) ? value.map(labelOf).join(", ") : labelOf(value);
}

export function ByldaIntakeChat({
  questions,
  accent,
  accentDark,
  initialAnswers,
  initialStep = 0,
  stageSpine,
  onAnswer,
  onComplete,
}: Props) {
  const resumed = initialStep > 0 && initialStep < questions.length;
  const [messages, setMessages] = useState<Msg[]>(() =>
    resumed
      ? [
          {
            id: "bylda-resume",
            from: "bylda",
            text: "Welcome back — picking up right where you left off.",
          },
        ]
      : [],
  );
  const [step, setStep] = useState(Math.min(initialStep, questions.length - 1));
  const [typing, setTyping] = useState(false);
  const [inputReady, setInputReady] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [answers, setAnswers] = useState<IntakeAnswers>(initialAnswers ?? {});
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, inputReady]);

  useEffect(() => {
    deliverByldaMessage(Math.min(initialStep, questions.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function deliverByldaMessage(qIdx: number) {
    if (qIdx >= questions.length) return;
    setTyping(true);
    setInputReady(false);
    const delay = qIdx === 0 ? 600 : 450;
    setTimeout(() => {
      setTyping(false);
      const q = questions[qIdx];
      setMessages((prev) => [...prev, { id: `bylda-${qIdx}`, from: "bylda", text: q.byldaText }]);
      setTimeout(() => setInputReady(true), 200);
    }, delay + 550);
  }

  function submitAnswer(value: string | string[]) {
    const q = questions[step];
    const empty = Array.isArray(value) ? value.length === 0 : !String(value).trim();
    if (empty || done) return;

    const cleaned = Array.isArray(value) ? value : String(value).trim();
    const newAnswers = { ...answers, [q.key]: cleaned };
    setAnswers(newAnswers);
    setInputReady(false);
    setTextValue("");
    onAnswer?.(q.key, cleaned, step + 1);

    setMessages((prev) => [
      ...prev,
      { id: `user-${step}`, from: "user", text: answerLabel(q, cleaned) },
    ]);

    const nextStep = step + 1;
    if (nextStep >= questions.length) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setDone(true);
        setMessages((prev) => [
          ...prev,
          {
            id: "bylda-final",
            from: "bylda",
            text: "That's everything I need.\n\nAssembling your workspace now…",
          },
        ]);
        setTimeout(() => void onComplete(newAnswers), 900);
      }, 800);
    } else {
      setStep(nextStep);
      deliverByldaMessage(nextStep);
    }
  }

  // Draft-before-type: fill the field with Bylda's starter for the user to
  // lightly edit — never a blank page. Doubles as the text-field idle fallback.
  function draftText() {
    const q = questions[step];
    if (q.type === "text" && q.suggestion) {
      setTextValue(q.suggestion);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  // Idle-user fallback for choice questions: "not sure — Bylda picks and moves
  // on." Uses the question's recommend, else the first (safest-starter) option.
  function pickForMe() {
    const q = questions[step];
    if (q.type === "chips") submitAnswer(q.recommend ?? q.options[0].id);
    else if (q.type === "multi") submitAnswer(q.recommend ?? [q.options[0].id]);
  }

  const currentQ = questions[step];
  const progress = ((Math.min(step, questions.length) / questions.length) * 100).toFixed(0);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 620,
        display: "flex",
        flexDirection: "column",
        height: "min(680px, 90vh)",
      }}
    >
      <style>{ANIM}</style>

      {/* Progress bar */}
      <div
        style={{
          height: 2,
          borderRadius: 2,
          background: `color-mix(in oklab, ${accent} 15%, transparent)`,
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${accent}, ${accentDark})`,
            borderRadius: 2,
            transition: "width 0.5s ease",
          }}
        />
      </div>

      {/* Persistent "you are here" stage path (create track) */}
      {stageSpine && <div style={{ marginBottom: 22 }}>{stageSpine}</div>}

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} accent={accent} accentDark={accentDark} />
        ))}
        {typing && <TypingIndicator accent={accent} accentDark={accentDark} />}
        <div ref={bottomRef} />
      </div>

      {inputReady && !done && (
        <div style={{ animation: "fadeIn 0.3s ease both", marginTop: 16 }}>
          {currentQ.type === "text" ? (
            <TextInput
              accent={accent}
              placeholder={currentQ.placeholder}
              value={textValue}
              onChange={setTextValue}
              onSubmit={() => submitAnswer(textValue)}
              onDraft={currentQ.suggestion ? draftText : undefined}
              textareaRef={textareaRef}
            />
          ) : currentQ.type === "chips" ? (
            <>
              <ChipGrid accent={accent} options={currentQ.options} onSelect={submitAnswer} />
              <NotSureButton accent={accent} onClick={pickForMe} />
            </>
          ) : (
            <>
              <MultiChipGrid
                accent={accent}
                options={currentQ.options}
                max={currentQ.max ?? currentQ.options.length}
                onSubmit={submitAnswer}
              />
              <NotSureButton accent={accent} onClick={pickForMe} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ChatBubble({ msg, accent, accentDark }: { msg: Msg; accent: string; accentDark: string }) {
  const isBylda = msg.from === "bylda";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isBylda ? "flex-start" : "flex-end",
        marginBottom: 14,
        animation: "msgIn 0.35s ease both",
      }}
    >
      {isBylda && <ByldaDot accent={accent} accentDark={accentDark} />}
      <div
        style={{
          maxWidth: "78%",
          padding: isBylda ? "12px 16px" : "10px 15px",
          borderRadius: isBylda ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
          background: isBylda
            ? "rgba(255,255,255,0.05)"
            : `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
          border: isBylda ? "1px solid rgba(255,255,255,0.08)" : "none",
          fontSize: 14,
          lineHeight: 1.65,
          color: isBylda ? "rgba(247,240,232,0.88)" : "#fff",
          whiteSpace: "pre-line",
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

function ByldaDot({ accent, accentDark }: { accent: string; accentDark: string }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${accent}, ${accentDark})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
        marginRight: 10,
        marginTop: 4,
        boxShadow: `0 0 12px color-mix(in oklab, ${accent} 35%, transparent)`,
      }}
    >
      N
    </div>
  );
}

function TypingIndicator({ accent, accentDark }: { accent: string; accentDark: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
        animation: "msgIn 0.25s ease both",
      }}
    >
      <ByldaDot accent={accent} accentDark={accentDark} />
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "4px 16px 16px 16px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: accent,
              display: "inline-block",
              animation: `dot 1.2s ease-in-out ${i * 0.16}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TextInput({
  accent,
  placeholder,
  value,
  onChange,
  onSubmit,
  onDraft,
  textareaRef,
}: {
  accent: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** Present when the question ships a draft scaffold — shows "Draft it for me". */
  onDraft?: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { supported, listening, start, stop } = useSpeechInput(onChange);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const toggleMic = () => {
    if (listening) stop();
    else start(value);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid color-mix(in oklab, ${listening ? "#ef4444" : accent} ${listening ? 55 : 25}%, transparent)`,
          borderRadius: 14,
          padding: "10px 10px 10px 16px",
          transition: "border-color 0.2s",
        }}
      >
        <textarea
          ref={textareaRef}
          autoFocus
          placeholder={listening ? "Listening… just talk, I'll type it out." : placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            resize: "none",
            color: "rgba(247,240,232,0.9)",
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: "inherit",
          }}
        />
        <div
          style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6 }}
        >
          {supported && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Stop dictation" : "Dictate your answer"}
              title={listening ? "Stop dictation" : "Speak your answer"}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: listening ? "#ef4444" : "rgba(255,255,255,0.06)",
                border: `1px solid ${listening ? "#ef4444" : "rgba(255,255,255,0.12)"}`,
                cursor: "pointer",
                color: listening ? "#fff" : "rgba(247,240,232,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                animation: listening ? "ambientPulse 1.2s infinite" : undefined,
              }}
            >
              <Mic size={16} />
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={!value.trim()}
            aria-label="Send answer"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: value.trim() ? accent : `color-mix(in oklab, ${accent} 20%, transparent)`,
              border: "none",
              cursor: value.trim() ? "pointer" : "not-allowed",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 16,
            }}
          >
            ↑
          </button>
        </div>
      </div>

      {onDraft && (
        <button
          type="button"
          onClick={onDraft}
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 600,
            fontFamily: "inherit",
            color: accent,
          }}
        >
          <Sparkles size={13} />
          Not sure how to word it? Draft it for me
        </button>
      )}
    </div>
  );
}

// Idle-user escape hatch shown under every choice question — "just decide for
// me." Deliberately low-emphasis so it never competes with the real options.
function NotSureButton({ accent, onClick }: { accent: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginTop: 12,
        width: "100%",
        padding: "9px 0",
        borderRadius: 10,
        background: "none",
        border: "1px dashed rgba(255,255,255,0.14)",
        cursor: "pointer",
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: "inherit",
        color: "rgba(247,240,232,0.55)",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = accent;
        e.currentTarget.style.borderColor = `color-mix(in oklab, ${accent} 40%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(247,240,232,0.55)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
      }}
    >
      Not sure? Let Bylda pick a strong default →
    </button>
  );
}

function chipStyle(accent: string, state: "idle" | "selected" | "dimmed", index: number) {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    background:
      state === "selected"
        ? `color-mix(in oklab, ${accent} 18%, transparent)`
        : "rgba(255,255,255,0.04)",
    border: `1px solid ${
      state === "selected"
        ? `color-mix(in oklab, ${accent} 60%, transparent)`
        : "rgba(255,255,255,0.08)"
    }`,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.15s",
    animation: `chipIn 0.3s ease ${index * 0.05}s both`,
    opacity: state === "dimmed" ? 0.45 : 1,
  };
}

function ChipGrid({
  accent,
  options,
  onSelect,
}: {
  accent: string;
  options: IntakeChipOption[];
  onSelect: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const choose = (id: string) => {
    if (selected) return;
    setSelected(id);
    setTimeout(() => onSelect(id), 200);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {options.map((opt, i) => (
        <button
          key={opt.id}
          onClick={() => choose(opt.id)}
          style={chipStyle(
            accent,
            selected === opt.id ? "selected" : selected ? "dimmed" : "idle",
            i,
          )}
        >
          <ChipBody opt={opt} accent={accent} selected={selected === opt.id} />
        </button>
      ))}
    </div>
  );
}

function MultiChipGrid({
  accent,
  options,
  max,
  onSubmit,
}: {
  accent: string;
  options: IntakeChipOption[];
  max: number;
  onSubmit: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= max ? prev : [...prev, id],
    );
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {options.map((opt, i) => (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            style={chipStyle(accent, selected.includes(opt.id) ? "selected" : "idle", i)}
          >
            <ChipBody opt={opt} accent={accent} selected={selected.includes(opt.id)} />
          </button>
        ))}
      </div>
      <button
        onClick={() => onSubmit(selected)}
        disabled={selected.length === 0}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "11px 0",
          borderRadius: 12,
          border: "none",
          fontWeight: 700,
          fontSize: 13.5,
          color: "#fff",
          cursor: selected.length === 0 ? "not-allowed" : "pointer",
          background:
            selected.length === 0
              ? `color-mix(in oklab, ${accent} 20%, transparent)`
              : `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #000))`,
          transition: "background 0.2s",
        }}
      >
        {selected.length === 0
          ? "Pick at least one"
          : `Continue with ${selected.length} selected →`}
      </button>
    </div>
  );
}

function ChipBody({
  opt,
  accent,
  selected,
}: {
  opt: IntakeChipOption;
  accent: string;
  selected: boolean;
}) {
  return (
    <>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.emoji}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: selected ? accent : "rgba(247,240,232,0.9)",
          lineHeight: 1.3,
        }}
      >
        {opt.label}
      </div>
      <div style={{ fontSize: 11, color: "rgba(247,240,232,0.4)", marginTop: 2, lineHeight: 1.3 }}>
        {opt.desc}
      </div>
    </>
  );
}
