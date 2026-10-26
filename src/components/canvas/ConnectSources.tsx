import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { blockIfGuest } from "@/lib/guest";
import {
  getCallIngestUrl,
  saveIntegration,
  startIntegrationOAuth,
} from "@/lib/queries";

const RM_STEPS = [
  "Enable Automation → Integration Features",
  "Enable CCS Profile → Play Recordings",
  "Enable Communication → Manage VOIP",
  "Ask ReadyMode to POST completed calls to this URL",
];

export function ConnectSources({
  onLater,
  onConnected,
}: {
  onLater: () => void;
  onConnected: () => void;
}) {
  const [open, setOpen] = useState<"readymode" | "gohighlevel" | null>("readymode");
  const [rmDone, setRmDone] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const ingest = useQuery({
    queryKey: ["call-ingest-url"],
    queryFn: getCallIngestUrl,
    staleTime: 5 * 60_000,
  });

  const rmProgress = useMemo(
    () => RM_STEPS.filter((_, index) => rmDone[index]).length,
    [rmDone],
  );

  const copyUrl = async () => {
    const url = ingest.data?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Webhook URL copied.");
    } catch {
      toast.error("Copy it manually from the field.");
    }
  };

  const finishReadyMode = async () => {
    if (blockIfGuest("Sign up to connect ReadyMode.")) return;
    setBusy("readymode");
    try {
      await saveIntegration("readymode", `webhook:${Date.now()}`);
      toast.success("ReadyMode intake is on. Calls will land here.");
      onConnected();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save ReadyMode.");
    } finally {
      setBusy(null);
    }
  };

  const connectGhlOauth = async () => {
    if (blockIfGuest("Sign up to connect GoHighLevel.")) return;
    setBusy("ghl-oauth");
    try {
      const result = await startIntegrationOAuth("gohighlevel");
      window.location.assign(result.authorization_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t start GoHighLevel sign-in.");
      setBusy(null);
    }
  };

  const connectGhlKey = async () => {
    if (blockIfGuest("Sign up to connect GoHighLevel.")) return;
    if (!token.trim() || !location.trim()) {
      toast.error("Paste the private integration token and location ID.");
      return;
    }
    setBusy("ghl-key");
    try {
      await saveIntegration("gohighlevel", token.trim());
      await saveIntegration("gohighlevel_location", location.trim());
      toast.success("GoHighLevel is connected. I’ll pull pipeline next.");
      onConnected();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save GoHighLevel.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bylda-canvas relative min-h-full overflow-hidden bg-[#0b1220] px-4 py-10 text-white sm:px-8">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#3275d8]/30 blur-[90px]" />
      <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-[#7c8cff]/20 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#3dd6c6]/15 blur-[90px]" />

      <div className="relative mx-auto max-w-[1080px]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8bb5f5]">
            <Sparkles className="h-3.5 w-3.5" /> Two sources. That’s the whole loop.
          </div>
          <h1 className="mt-5 font-canvas-display text-[40px] font-normal leading-[1.08] tracking-[-0.035em] sm:text-[52px]">
            Plug in the phone and the CRM.{" "}
            <em className="text-[#8bb5f5]">Then the canvas has something to say.</em>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#b7c0ce]">
            ReadyMode brings the conversation. GoHighLevel brings the pipeline. Pick a card, connect
            it, or skip and I’ll show a demo so you can feel the day.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <article
            onClick={() => setOpen("readymode")}
            className={cn(
              "group relative cursor-pointer overflow-hidden rounded-[28px] border p-6 text-left transition duration-300",
              open === "readymode"
                ? "border-[#8bb5f5]/50 bg-[#132036] shadow-[0_24px_80px_rgba(50,117,216,0.25)]"
                : "border-white/10 bg-white/[0.04] hover:-translate-y-1 hover:border-white/25",
            )}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#3275d8]/30 blur-3xl transition group-hover:bg-[#3275d8]/50" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3275d8] text-white">
                <PhoneCall className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#c5d6f5]">
                Conversations
              </span>
            </div>
            <h2 className="relative mt-5 font-canvas-display text-[28px]">ReadyMode</h2>
            <p className="relative mt-2 text-[14px] leading-6 text-[#9aa6b8]">
              Drop a webhook. Completed calls, recordings, and recaps land on the brief.
            </p>
            {open === "readymode" && (
              <div className="relative z-10 mt-6 space-y-4" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center gap-2 text-[12px] text-[#8bb5f5]">
                  <ShieldCheck className="h-4 w-4" /> Org-specific URL. Treat it like a password.
                </div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={
                      ingest.isPending
                        ? "Generating secure URL…"
                        : (ingest.data?.url ?? "Webhook isn’t configured yet")
                    }
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-[11px] text-[#d7e3f7] outline-none"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => void copyUrl()}
                    disabled={!ingest.data?.url}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#111318]"
                    aria-label="Copy webhook URL"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] text-[#8aa0c2]">
                    <span>Checklist</span>
                    <span>
                      {rmProgress}/{RM_STEPS.length}
                    </span>
                  </div>
                  <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-[#3275d8] transition-all"
                      style={{ width: `${(rmProgress / RM_STEPS.length) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {RM_STEPS.map((step, index) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setRmDone((current) => ({ ...current, [index]: !current[index] }))}
                        className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-[12px] text-[#c5cedb] hover:bg-white/5"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border",
                            rmDone[index]
                              ? "border-[#3dd6c6] bg-[#3dd6c6] text-[#0b1220]"
                              : "border-white/25",
                          )}
                        >
                          {rmDone[index] && <Check className="h-3 w-3" />}
                        </span>
                        {step}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void finishReadyMode()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[13px] font-semibold text-[#111318]"
                >
                  {busy === "readymode" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  I’ve sent this to ReadyMode
                </button>
              </div>
            )}
          </article>

          <article
            onClick={() => setOpen("gohighlevel")}
            className={cn(
              "group relative cursor-pointer overflow-hidden rounded-[28px] border p-6 text-left transition duration-300",
              open === "gohighlevel"
                ? "border-[#7ee0d2]/40 bg-[#10242b] shadow-[0_24px_80px_rgba(61,214,198,0.18)]"
                : "border-white/10 bg-white/[0.04] hover:-translate-y-1 hover:border-white/25",
            )}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#3dd6c6]/25 blur-3xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f8f82] text-white">
                <Waves className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#b7eadf]">
                Pipeline
              </span>
            </div>
            <h2 className="relative mt-5 font-canvas-display text-[28px]">GoHighLevel</h2>
            <p className="relative mt-2 text-[14px] leading-6 text-[#9aa6b8]">
              Pull contacts and opportunities in. The brief reads the CRM, it doesn’t replace it.
            </p>
            {open === "gohighlevel" && (
              <div className="relative z-10 mt-6 space-y-3" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void connectGhlOauth()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#3dd6c6] text-[13px] font-semibold text-[#0b1220]"
                >
                  {busy === "ghl-oauth" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Sign in with GoHighLevel <ArrowRight className="h-4 w-4" />
                </button>
                <div className="text-center text-[11px] uppercase tracking-[0.16em] text-[#6f8b86]">
                  or paste a private token
                </div>
                <input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Private integration token"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-[13px] outline-none placeholder:text-[#6b7788]"
                />
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Location ID"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-[13px] outline-none placeholder:text-[#6b7788]"
                />
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void connectGhlKey()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 text-[13px] font-semibold"
                >
                  {busy === "ghl-key" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Connect with token
                </button>
              </div>
            )}
          </article>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="font-canvas-display text-[20px]">Not ready to wire it?</div>
            <p className="mt-1 text-[13px] text-[#9aa6b8]">
              I’ll open a demo workspace with sample deals and calls. Nothing writes to a real CRM.
            </p>
          </div>
          <button
            type="button"
            onClick={onLater}
            className="shrink-0 rounded-full border border-white/20 px-5 py-2.5 text-[12px] font-semibold hover:bg-white hover:text-[#111318]"
          >
            Connect later — show demo
          </button>
        </div>
      </div>
    </div>
  );
}
