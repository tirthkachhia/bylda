import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  FileText,
  Mail,
  MoreHorizontal,
  Pencil,
  PhoneCall,
  Play,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/crm/calls")({ component: CallsPage });
const db = supabase as any;

type Transcript = {
  id: string;
  call_id: string;
  transcript_text: string | null;
  sentiment_score: number | null;
  created_at: string;
};
const demoTranscript = [
  {
    time: "00:42",
    speaker: "Maya",
    text: "The biggest issue is our current handoff takes three days. If implementation stays under two weeks, that changes the conversation for us.",
  },
  {
    time: "08:16",
    speaker: "Alex",
    text: "We can connect the workspace and have the first workflow live within ten business days. I’ll bring our solutions lead into the technical review.",
  },
  {
    time: "17:31",
    speaker: "Maya",
    text: "That works. We’re comparing this with Gong, but their package is heavier than what we need. We have budget in the thirty-thousand range.",
  },
  {
    time: "24:08",
    speaker: "Alex",
    text: "I’ll send the implementation outline today and hold Tuesday at 2 PM for the technical review with Jordan.",
  },
];
const fields = [
  { key: "stage", label: "Deal stage", value: "Evaluation", confidence: 98, source: "17:31" },
  {
    key: "outcome",
    label: "Call outcome",
    value: "Qualified · technical review",
    confidence: 97,
    source: "24:08",
  },
  { key: "amount", label: "Expected value", value: "$32,000", confidence: 94, source: "17:31" },
  {
    key: "next",
    label: "Next step",
    value: "Technical review · Aug 11, 2:00 PM",
    confidence: 99,
    source: "24:08",
  },
] as const;

function CallsPage() {
  const { currentOrgId } = useAuth();
  const [rows, setRows] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "transcript">("summary");
  const [editing, setEditing] = useState(false);
  const [written, setWritten] = useState(false);
  const [email, setEmail] = useState(
    "Hi Maya,\n\nThanks for walking me through Northstar’s handoff process. The three-day delay you described is exactly where Bylda can help, and we can keep implementation inside the two-week window we discussed.\n\nI’ve held Tuesday at 2 PM for a technical review with Jordan. I’ll send the implementation outline before then.\n\nBest,\nAlex",
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentOrgId) {
        setLoading(false);
        return;
      }
      const { data } = await db
        .from("call_transcripts")
        .select("id, call_id, transcript_text, sentiment_score, created_at")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) {
        setRows((data as Transcript[]) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId]);

  const transcript = useMemo(
    () =>
      rows[0]?.transcript_text?.trim()
        ? [{ time: "00:00", speaker: "Call", text: rows[0].transcript_text!.trim() }]
        : demoTranscript,
    [rows],
  );
  const approve = () => {
    setWritten(true);
    setEditing(false);
    toast.success("CRM update approved", {
      description: "Four verified fields are queued for your connected CRM.",
    });
  };
  const copyEmail = async () => {
    await navigator.clipboard.writeText(email);
    toast.success("Follow-up copied");
  };

  return (
    <div className="min-h-full bg-[#eeefeb]">
      <div className="mx-auto max-w-[1460px] p-3 sm:p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7b818a]">
              Call workspace
            </div>
            <h1 className="mt-1 text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">
              Review the call, finish the work.
            </h1>
            <p className="mt-1 text-[12px] text-[#747a83]">
              One call needs your approval before it reaches the CRM.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-10 items-center gap-2 rounded-full border border-black/[0.1] bg-[#f8f8f5] px-4 text-[11px] font-semibold">
              <Play className="h-3.5 w-3.5 fill-current" /> Recording{" "}
              <ChevronDown className="h-3 w-3" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.1] bg-[#f8f8f5] text-[#737982]">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[20px] border border-black/[0.09] bg-[#f8f8f5] xl:sticky xl:top-0 xl:h-[calc(100vh-145px)]">
            <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-4">
              <span className="text-[12px] font-bold">Recent calls</span>
              <span className="rounded-full bg-[#e7e8e4] px-2 py-1 text-[9px] font-semibold text-[#777d85]">
                4 today
              </span>
            </div>
            <div className="p-2">
              <CallRow
                active
                initials="MR"
                name="Maya Rodriguez"
                company="Northstar Logistics"
                meta="2m · 26:14"
              />
              <CallRow initials="DK" name="Daniel Kim" company="Aster Health" meta="38m · 18:02" />
              <CallRow initials="SJ" name="Sarah Jones" company="Modern Fleet" meta="1h · 34:51" />
              <CallRow
                initials="RB"
                name="Ryan Brooks"
                company="Craftline"
                meta="Yesterday · 21:09"
              />
            </div>
            <Link
              to="/app/integrations"
              className="m-3 mt-auto flex items-center justify-between rounded-xl border border-dashed border-black/[0.13] p-3 text-[10px] font-semibold text-[#697079]"
            >
              <span className="flex items-center gap-2">
                <PhoneCall className="h-3.5 w-3.5" /> Call sources
              </span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </aside>

          <div className="min-w-0 space-y-4">
            <section className="overflow-hidden rounded-[22px] border border-black/[0.09] bg-[#f8f8f5]">
              <div className="flex flex-col gap-4 border-b border-black/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dbe7f8] text-[12px] font-bold text-[#346dbf]">
                    MR
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[20px] font-bold tracking-[-0.03em]">Maya Rodriguez</h2>
                      <span className="rounded-full bg-[#dff1e7] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-[#28764d]">
                        Qualified
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#777d86]">
                      VP Operations · Northstar Logistics · Ended 2 minutes ago
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-[#737982]">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    26:14
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5" />
                    Alex Chen
                  </span>
                  {rows.length === 0 && !loading && (
                    <span className="rounded bg-[#e4ebf7] px-2 py-1 font-bold uppercase tracking-wider text-[#346dbf]">
                      Demo data
                    </span>
                  )}
                </div>
              </div>
              <div className="grid divide-y divide-black/[0.08] md:grid-cols-4 md:divide-x md:divide-y-0">
                <Metric label="Outcome" value="Technical review" detail="Buyer confirmed" />
                <Metric label="Budget" value="$28k–$35k" detail="Explicitly stated" />
                <Metric label="Primary risk" value="Time to value" detail="Launch under 2 weeks" />
                <Metric label="Next step" value="Tue · 2:00 PM" detail="Solutions review" />
              </div>
            </section>

            <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(390px,0.9fr)]">
              <div className="space-y-4">
                <section className="overflow-hidden rounded-[22px] border border-black/[0.09] bg-[#f8f8f5]">
                  <div className="flex items-center justify-between border-b border-black/[0.08] px-5">
                    <div className="flex h-[58px] items-end gap-6">
                      {(["summary", "transcript"] as const).map((item) => (
                        <button
                          key={item}
                          onClick={() => setTab(item)}
                          className={`h-full border-b-2 text-[11px] font-semibold capitalize ${tab === item ? "border-[#3275d8] text-[#1e5faf]" : "border-transparent text-[#7d838c]"}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <Sparkles className="h-4 w-4 text-[#3275d8]" />
                  </div>
                  {tab === "summary" ? (
                    <div className="p-5 sm:p-6">
                      <div className="rounded-2xl bg-[#e9eef6] p-5">
                        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#4774b5]">
                          Bylda’s read
                        </div>
                        <p className="mt-3 text-[14px] font-medium leading-7 text-[#333943]">
                          Northstar is qualified and actively comparing call-intelligence vendors.
                          Maya confirmed budget, but speed to implementation is the decision
                          criterion. A technical review is scheduled with Jordan.
                        </p>
                      </div>
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <Insight
                          title="Why this advances"
                          body="Budget and decision criteria are explicit, with the technical buyer entering next."
                          source="17:31"
                        />
                        <Insight
                          title="What could stall it"
                          body="Any implementation plan beyond two weeks weakens the case against Gong."
                          source="00:42"
                        />
                        <Insight
                          title="Competitor"
                          body="Gong is in consideration, perceived as heavier than Northstar needs."
                          source="17:31"
                        />
                        <Insight
                          title="Rep coaching"
                          body="Lead the next call with the ten-day activation plan, not feature breadth."
                          source="AI"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-black/[0.07]">
                      {transcript.map((line) => (
                        <div
                          key={`${line.time}-${line.speaker}`}
                          className="grid grid-cols-[52px_70px_1fr] gap-3 px-5 py-5 text-[12px] leading-6 sm:px-6"
                        >
                          <span className="font-mono text-[9px] text-[#969ba2]">{line.time}</span>
                          <span className="font-semibold text-[#474d55]">{line.speaker}</span>
                          <p className="text-[#626871]">{line.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-[22px] border border-black/[0.09] bg-[#f8f8f5] p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[#3275d8]" />
                        <h2 className="text-[14px] font-bold">Follow-up ready</h2>
                      </div>
                      <p className="mt-1 text-[10px] text-[#858a92]">
                        Grounded in four moments from the call
                      </p>
                    </div>
                    <button
                      onClick={copyEmail}
                      className="flex h-9 items-center gap-2 rounded-full border border-black/[0.1] px-3 text-[10px] font-semibold"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                  <textarea
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-5 min-h-[210px] w-full resize-none rounded-2xl border border-black/[0.09] bg-white p-4 text-[12px] leading-6 outline-none focus:border-[#77a3e2]"
                  />
                  <div className="mt-3 flex justify-end">
                    <button className="flex h-10 items-center gap-2 rounded-full bg-[#111318] px-4 text-[11px] font-semibold text-white">
                      <Send className="h-3.5 w-3.5" />
                      Send with Gmail
                    </button>
                  </div>
                </section>
              </div>

              <section className="overflow-hidden rounded-[22px] border border-black/[0.09] bg-[#f8f8f5] 2xl:sticky 2xl:top-4">
                <div className="flex items-center justify-between border-b border-black/[0.08] p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#3275d8]" />
                      <h2 className="text-[14px] font-bold">CRM write-back</h2>
                    </div>
                    <p className="mt-1 text-[10px] text-[#838890]">
                      4 fields sourced from this call
                    </p>
                  </div>
                  {written ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-[#dff1e7] px-3 py-1.5 text-[9px] font-bold text-[#28764d]">
                      <CheckCircle2 className="h-3 w-3" />
                      Approved
                    </span>
                  ) : (
                    <button
                      onClick={() => setEditing(!editing)}
                      className="flex h-8 items-center gap-1.5 rounded-full border border-black/[0.1] px-3 text-[9px] font-semibold"
                    >
                      {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                      {editing ? "Cancel" : "Edit"}
                    </button>
                  )}
                </div>
                <div className="divide-y divide-black/[0.07]">
                  {fields.map((field) => (
                    <div key={field.key} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8a8f96]">
                          {field.label}
                        </span>
                        <span className="text-[9px] font-semibold text-[#2d8859]">
                          {field.confidence}% confidence
                        </span>
                      </div>
                      {editing ? (
                        <input
                          defaultValue={field.value}
                          className="mt-2 h-9 w-full rounded-lg border border-black/[0.1] bg-white px-3 text-[11px] outline-none focus:border-[#6f9fdf]"
                        />
                      ) : (
                        <div className="mt-2 text-[12px] font-semibold text-[#363b42]">
                          {field.value}
                        </div>
                      )}
                      <button
                        onClick={() => setTab("transcript")}
                        className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-[#4c78b6]"
                      >
                        <FileText className="h-3 w-3" />
                        Evidence at {field.source}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between text-[9px] text-[#777d85]">
                    <span>Destination</span>
                    <span className="font-semibold text-[#444a52]">GoHighLevel · Northstar</span>
                  </div>
                  <button
                    onClick={approve}
                    disabled={written}
                    className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-semibold ${written ? "bg-[#dff1e7] text-[#28764d]" : "bg-[#3275d8] text-white hover:bg-[#2867be]"}`}
                  >
                    {written ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Update approved
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Approve 4 CRM fields
                      </>
                    )}
                  </button>
                  <p className="mt-3 text-center text-[9px] leading-4 text-[#92979e]">
                    Bylda never writes without your approval.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallRow({
  active,
  initials,
  name,
  company,
  meta,
}: {
  active?: boolean;
  initials: string;
  name: string;
  company: string;
  meta: string;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${active ? "bg-[#e5ebf4]" : "hover:bg-[#f0f0ec]"}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${active ? "bg-[#3275d8] text-white" : "bg-[#e7e8e4] text-[#727881]"}`}
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold">{name}</span>
        <span className="mt-0.5 block truncate text-[9px] text-[#7f858d]">{company}</span>
        <span className="mt-1 block text-[8px] text-[#a0a4aa]">{meta}</span>
      </span>
    </button>
  );
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="p-5">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8b9097]">{label}</div>
      <div className="mt-2 text-[13px] font-bold tracking-[-0.01em]">{value}</div>
      <div className="mt-1 text-[9px] text-[#8b9097]">{detail}</div>
    </div>
  );
}
function Insight({ title, body, source }: { title: string; body: string; source: string }) {
  return (
    <article className="rounded-2xl border border-black/[0.08] bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold">{title}</h3>
        <span className="font-mono text-[8px] text-[#8b9097]">{source}</span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[#6d737b]">{body}</p>
    </article>
  );
}
