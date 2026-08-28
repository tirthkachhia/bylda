import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { CanvasShell } from "./CanvasShell";
import { CrmSetupGate } from "./CrmSetupGate";
import { ConnectSources } from "./ConnectSources";
import { PricingGate } from "./PricingGate";
import type { CanvasState, CanvasView } from "./types";
import { useOperatorData } from "./use-operator-data";
import {
  ActionsView,
  ApprovalsView,
  AskBanner,
  CallWorkspace,
  CallsView,
  ChangesView,
  DealWorkspace,
  DealsView,
  FollowUpsView,
  MorningBrief,
  PatternsView,
  PerformanceView,
  PipelineView,
  SimpleSignalView,
  StaticTeamView,
  TasksView,
  UpcomingView,
} from "./views";

const TITLES: Record<CanvasView, string> = {
  brief: "Today",
  upcoming: "Today / Upcoming Calls",
  actions: "Today / Priority Actions",
  changes: "Today / Recent Changes",
  deals: "Deals / Focus Deals",
  pipeline: "Deals / Pipeline Intelligence",
  deal: "Deals",
  risks: "Deals / Risks & Signals",
  stakeholders: "Deals / Stakeholders",
  commitments: "Deals / Commitments",
  calls: "Conversations / Calls",
  call: "Conversations",
  objections: "Conversations / Objections",
  signals: "Conversations / Buying Signals",
  coaching: "Conversations / Coaching",
  nba: "Actions / Next Best Actions",
  followups: "Actions / Follow-Ups",
  tasks: "Actions / Tasks",
  approvals: "Actions / Approvals",
  performance: "Insights / My Performance",
  team: "Insights / Team Intelligence",
  patterns: "Insights / Patterns & Trends",
};

function skipKey(orgId: string | null) {
  return `bylda-crm-setup-skipped:${orgId ?? "local"}`;
}

function connectLaterKey(orgId: string | null) {
  return `bylda-connect-later:${orgId ?? "local"}`;
}

function pricingKey(orgId: string | null) {
  return `bylda-pricing-seen:${orgId ?? "local"}`;
}

export function OperatorCanvas() {
  const { currentOrgId, user, profile } = useAuth();
  const data = useOperatorData(currentOrgId, user?.id);
  const [history, setHistory] = useState<CanvasState[]>([{ view: "brief" }]);
  const [ask, setAsk] = useState<{ query: string; answer: string } | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [connectLater, setConnectLater] = useState(false);

  useEffect(() => {
    try {
      setSkipped(localStorage.getItem(skipKey(currentOrgId)) === "1");
      setConnectLater(localStorage.getItem(connectLaterKey(currentOrgId)) === "1");
    } catch {
      setSkipped(false);
      setConnectLater(false);
    }
  }, [currentOrgId]);

  const ghlSynced = useRef(false);
  useEffect(() => {
    if (ghlSynced.current || !data.connections.gohighlevel) return;
    ghlSynced.current = true;
    void data.syncGoHighLevelPipeline(true);
  }, [data.connections.gohighlevel]);

  const current = history[history.length - 1];
  const needsSetup = !data.profileLoading && !data.profile && !skipped;
  const neitherSource = !data.connections.readymode && !data.connections.gohighlevel;
  const needsConnect =
    !data.guest &&
    !data.profileLoading &&
    !data.connectionsLoading &&
    neitherSource &&
    !connectLater;

  const open = (view: CanvasView, entityId?: string) => {
    setHistory((stack) => {
      const last = stack[stack.length - 1];
      if (last?.view === view && last.entityId === entityId) return stack;
      return [...stack, { view, entityId }];
    });
    setAsk(null);
  };

  const deal = data.deals.find((item) => item.id === current.entityId) ?? data.deals[0];
  const call = data.calls.find((item) => item.id === current.entityId) ?? data.calls[0];

  const askBylda = (query: string) => {
    const text = query.toLowerCase();
    const matchedDeal = data.deals.find((item) =>
      text.includes(item.company.split(" ")[0].toLowerCase()),
    );
    const matchedCall = data.calls.find((item) =>
      text.includes(item.company.split(" ")[0].toLowerCase()),
    );
    let view: CanvasView = "brief";
    let entityId: string | undefined;
    let answer = "I’d start with the brief. The top items are already ranked.";

    if (/prep|upcoming|call in/.test(text)) {
      view = matchedCall ? "call" : "upcoming";
      entityId = matchedCall?.id;
      answer = matchedCall
        ? `You’re talking to ${matchedCall.company}. Biggest thing to solve: who owns the final decision.`
        : "Here are the conversations I’d prep next.";
    } else if (/follow.?up|draft/.test(text)) {
      view = "followups";
      answer = "I drafted the follow-ups from the latest calls. Copy and send from your inbox.";
    } else if (/risk|slipping|attention/.test(text)) {
      view = "risks";
      answer = "I’d look at these. The reasons are on the cards — not a health score.";
    } else if (/task|todo|action/.test(text)) {
      view = "nba";
      answer = data.actions[0]
        ? `I’d start with this: ${data.actions[0].title}`
        : "Here’s the action queue.";
    } else if (/pipeline/.test(text)) {
      view = "pipeline";
      answer = "Pipeline scan is up. Phase 1 is intelligence, not drag-and-drop CRM.";
    } else if (matchedDeal) {
      view = "deal";
      entityId = matchedDeal.id;
      answer = matchedDeal.notes || `Here’s ${matchedDeal.company}.`;
    } else if (/deal|focus|acme|northstar|apex/.test(text)) {
      view = "deals";
      answer = "I’d start with these. Two are closeable, two are slipping for fixable reasons.";
    }

    setAsk({ query, answer });
    setHistory((stack) => [...stack, { view, entityId }]);
  };

  const title = useMemo(() => {
    if (current.view === "deal" && deal) return `Deals / ${deal.company}`;
    if (current.view === "call" && call) return `Conversations / ${call.company}`;
    return TITLES[current.view];
  }, [call, current.view, deal]);

  if (data.profileLoading || data.connectionsLoading) {
    return (
      <div className="bylda-canvas flex h-full items-center justify-center bg-[#f7f9fd]">
        <Loader2 className="h-6 w-6 animate-spin text-[#3275d8]" />
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="bylda-canvas h-full bg-[#f7f9fd]">
        <CrmSetupGate
          orgId={currentOrgId}
          userId={user?.id}
          onSkip={() => {
            try {
              localStorage.setItem(skipKey(currentOrgId), "1");
            } catch {
              /* ignore */
            }
            setSkipped(true);
          }}
          onComplete={() => {
            void data.refreshProfile();
            setSkipped(true);
            try {
              if (localStorage.getItem(pricingKey(currentOrgId)) !== "1") setShowPricing(true);
            } catch {
              setShowPricing(true);
            }
          }}
        />
      </div>
    );
  }

  if (needsConnect) {
    return (
      <>
        <ConnectSources
          onLater={() => {
            try {
              localStorage.setItem(connectLaterKey(currentOrgId), "1");
            } catch {
              /* ignore */
            }
            setConnectLater(true);
            void data.refreshLive();
          }}
          onConnected={() => {
            try {
              localStorage.removeItem(connectLaterKey(currentOrgId));
            } catch {
              /* ignore */
            }
            setConnectLater(false);
            void data.refreshLive();
          }}
        />
        {showPricing && (
          <PricingGate
            orgId={currentOrgId}
            email={user?.email ?? profile?.email}
            name={profile?.full_name}
            onClose={() => setShowPricing(false)}
          />
        )}
      </>
    );
  }

  const risks = data.calls
    .filter((item) => item.risk || item.objections.length)
    .map((item) => ({
      title: item.company,
      body: item.risk || item.objections[0],
    }));
  const objections = data.calls.flatMap((item) =>
    item.objections.map((objection) => ({ title: objection, body: `${item.company} · ${item.contactName}` })),
  );
  const signals = data.calls
    .filter((item) => /vp|implement|budget|legal|procurement/i.test(`${item.summary} ${item.transcript}`))
    .map((item) => ({
      title: item.company,
      body: item.summary || "Buying movement showed up on the call.",
    }));

  return (
    <>
    <CanvasShell
      title={title}
      canBack={history.length > 1}
      currentView={current.view}
      alert={data.usingDemo ? "Demo workspace" : null}
      onBack={() => setHistory((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack))}
      onHome={() => {
        setHistory([{ view: "brief" }]);
        setAsk(null);
      }}
      onAsk={askBylda}
      onOpen={(view) => open(view)}
    >
      {ask && <AskBanner query={ask.query} answer={ask.answer} />}
      {skipped && !data.profile && current.view === "brief" && (
        <div className="mx-auto mb-4 flex w-full max-w-[1080px] items-center justify-between rounded-[22px] border border-black/[0.08] bg-white px-4 py-3">
          <p className="text-[13px] text-[#60656e]">
            I can still help, but I’ll be sharper after those four questions.
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(skipKey(currentOrgId));
              } catch {
                /* ignore */
              }
              setSkipped(false);
            }}
            className="shrink-0 text-[12px] font-semibold text-[#3275d8]"
          >
            Answer them
          </button>
        </div>
      )}
      {current.view === "brief" && (
        <MorningBrief
          deals={data.deals}
          calls={data.calls}
          tasks={data.tasks}
          actions={data.actions}
          connections={data.connections}
          onOpen={open}
          onSync={() => void data.syncGoHighLevelPipeline()}
        />
      )}
      {current.view === "upcoming" && (
        <UpcomingView calls={data.calls} onOpen={(id) => open("call", id)} />
      )}
      {current.view === "actions" && (
        <ActionsView
          actions={data.actions}
          tasks={data.tasks}
          onDeal={(id) => open("deal", id)}
          onCall={(id) => open("call", id)}
          onComplete={data.completeTask}
        />
      )}
      {current.view === "changes" && <ChangesView deals={data.deals} calls={data.calls} />}
      {current.view === "deals" && <DealsView deals={data.deals} onOpen={(id) => open("deal", id)} />}
      {current.view === "pipeline" && (
        <PipelineView deals={data.deals} onOpen={(id) => open("deal", id)} />
      )}
      {current.view === "deal" && deal && (
        <DealWorkspace deal={deal} calls={data.calls} onCall={(id) => open("call", id)} />
      )}
      {current.view === "risks" && (
        <SimpleSignalView
          title="Risks & signals"
          intro="Every risk says why, and what to do. No red-yellow-green score."
          items={
            risks.length
              ? risks
              : [{ title: "Nothing material is on fire.", body: "Next meetings are booked and commitments are on track." }]
          }
        />
      )}
      {current.view === "stakeholders" && (
        <SimpleSignalView
          title="Stakeholders"
          intro="Who matters. Inferred roles stay labeled as guesses."
          items={data.calls.slice(0, 5).map((item) => ({
            title: item.contactName,
            body: `${item.company} · last conversation ${item.startedAt ? "recently" : "unscheduled"}`,
          }))}
        />
      )}
      {current.view === "commitments" && (
        <SimpleSignalView
          title="Commitments"
          intro="Promises from the conversation — not generic tasks."
          items={
            data.calls.flatMap((item) =>
              item.nextSteps.map((step) => ({ title: step, body: `${item.company} · ${item.contactName}` })),
            ).length
              ? data.calls.flatMap((item) =>
                  item.nextSteps.map((step) => ({
                    title: step,
                    body: `${item.company} · ${item.contactName}`,
                  })),
                )
              : [{ title: "No dated promises yet.", body: "When a call names an owner and a date, it shows up here." }]
          }
        />
      )}
      {current.view === "calls" && <CallsView calls={data.calls} onOpen={(id) => open("call", id)} />}
      {current.view === "call" && call && (
        <CallWorkspace call={call} onApprove={data.approveWriteback} userId={user?.id} />
      )}
      {current.view === "objections" && (
        <SimpleSignalView
          title="Objections"
          intro="Customer resistance, with the wording from the call."
          items={
            objections.length
              ? objections
              : [{ title: "No open objections yet.", body: "They’ll show here the moment a call names one." }]
          }
        />
      )}
      {current.view === "signals" && (
        <SimpleSignalView
          title="Buying signals"
          intro="Concrete movement. Not ‘positive tone’."
          items={
            signals.length
              ? signals
              : [{ title: "No strong buying signals yet.", body: "Implementation questions, VP joins, and dated next steps land here." }]
          }
        />
      )}
      {current.view === "coaching" && (
        <SimpleSignalView
          title="Coaching"
          intro="One or two notes. Experienced reps shouldn’t feel graded."
          items={
            data.calls.filter((item) => item.coaching).length
              ? data.calls
                  .filter((item) => item.coaching)
                  .map((item) => ({ title: item.company, body: item.coaching as string }))
              : [
                  {
                    title: "No coaching notes yet.",
                    body: "After a live call, you’ll get one or two evidence-backed observations — not a score explosion.",
                  },
                ]
          }
        />
      )}
      {current.view === "nba" && (
        <ActionsView
          actions={data.actions}
          tasks={data.tasks}
          onDeal={(id) => open("deal", id)}
          onCall={(id) => open("call", id)}
          onComplete={data.completeTask}
        />
      )}
      {current.view === "followups" && <FollowUpsView calls={data.calls} />}
      {current.view === "tasks" && <TasksView tasks={data.tasks} onComplete={data.completeTask} />}
      {current.view === "approvals" && (
        <ApprovalsView calls={data.calls} onApprove={data.approveWriteback} userId={user?.id} />
      )}
      {current.view === "performance" && (
        <PerformanceView deals={data.deals} calls={data.calls} tasks={data.tasks} />
      )}
      {current.view === "team" && <StaticTeamView />}
      {current.view === "patterns" && <PatternsView calls={data.calls} />}
    </CanvasShell>
    {showPricing && (
      <PricingGate
        orgId={currentOrgId}
        email={user?.email ?? profile?.email}
        name={profile?.full_name}
        onClose={() => setShowPricing(false)}
      />
    )}
    </>
  );
}
