import { toast } from "sonner";
import { ArrowRight, Check, ChevronRight, Copy, PhoneCall, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CanvasConnections,
  CanvasView,
  OperatorAction,
  OperatorCall,
  OperatorDeal,
  OperatorTask,
} from "./types";

export function noted(message = "Got it.") {
  toast.message(message);
}

function money(value: number | null) {
  if (!value) return "—";
  return `$${value.toLocaleString()}`;
}

function when(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning.";
  if (hour < 17) return "Afternoon.";
  return "Evening.";
}

const display = "font-canvas-display";

export function InsightCard({
  eyebrow,
  title,
  body,
  action,
  onAction,
  tone = "default",
}: {
  eyebrow?: string;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  tone?: "default" | "risk" | "good";
}) {
  return (
    <article
      className={cn(
        "rounded-[22px] border border-black/[0.08] bg-white p-6",
        tone === "risk" && "border-[#f3d5d0] bg-[#fdf4f2]",
        tone === "good" && "border-[#cfe6d8] bg-[#eef8f2]",
      )}
    >
      {eyebrow && (
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#8a9099]">
          {eyebrow}
        </div>
      )}
      <h3 className={cn(display, "text-[22px] font-normal leading-snug tracking-[-0.03em] text-[#111318]")}>
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-6 text-[#60656e]">{body}</p>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#3275d8]"
        >
          {action} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </article>
  );
}

export function MorningBrief({
  deals,
  calls,
  tasks,
  actions,
  connections,
  onOpen,
  onSync,
}: {
  deals: OperatorDeal[];
  calls: OperatorCall[];
  tasks: OperatorTask[];
  actions: OperatorAction[];
  connections: CanvasConnections;
  onOpen: (view: CanvasView, entityId?: string) => void;
  onSync: () => void;
}) {
  const focusCall = calls[0];
  const focusDeal =
    deals.find((deal) => /proposal|legal|price|risk/i.test(`${deal.stage} ${deal.notes}`)) ?? deals[0];
  const count = Math.min(3, [actions[0], focusDeal, focusCall].filter(Boolean).length);

  const ghlDeals = deals.filter(
    (deal) =>
      /gohighlevel|ghl|highlevel/i.test(`${deal.externalSource ?? ""} ${deal.source ?? ""}`) ||
      connections.gohighlevel,
  );
  const readyCalls = calls.filter(
    (call) => /ready|readymode/i.test(call.provider ?? "") || connections.readymode || call.live,
  );
  const moving = deals.find((deal) => deal.id !== focusDeal?.id) ?? deals[1];

  return (
    <div className="mx-auto w-full max-w-[1120px] pb-10">
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <StatusChip
          ok={connections.readymode || readyCalls.some((call) => call.live)}
          label="ReadyMode"
          detail={
            connections.readymode
              ? `${calls.filter((call) => call.live).length} live calls`
              : "Demo"
          }
        />
        <StatusChip
          ok={connections.gohighlevel}
          label="GoHighLevel"
          detail={
            connections.gohighlevel
              ? `${deals.filter((deal) => deal.live).length} pipeline records`
              : "Demo"
          }
        />
        {connections.gohighlevel && (
          <button
            type="button"
            onClick={onSync}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/80 px-3 text-[11px] font-semibold text-[#111318] hover:bg-[#eaf1fb]"
          >
            <RefreshCw className="h-3 w-3" /> Sync CRM
          </button>
        )}
      </div>

      <div className="mt-8 max-w-3xl">
        <p className={cn(display, "text-[36px] font-normal leading-[1.12] tracking-[-0.035em] text-[#111318] sm:text-[44px]")}>
          {greeting()}{" "}
          <em className="font-normal text-[#3275d8]">
            {count
              ? `${count} things move the number today.`
              : "Nothing urgent is sitting on the desk."}
          </em>
        </p>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#60656e]">
          ReadyMode conversations and GoHighLevel pipeline, in one brief.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        {focusDeal && (
          <button
            type="button"
            onClick={() => onOpen("deal", focusDeal.id)}
            className="group relative min-h-[260px] overflow-hidden rounded-[28px] bg-[#111318] p-7 text-left text-white lg:col-span-7 lg:min-h-[320px] lg:p-8"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#3275d8]/45 blur-3xl" />
            <div className="relative flex h-full min-h-[220px] flex-col">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#8bb5f5]">
                Focus now
              </div>
              <h3 className={cn(display, "mt-8 max-w-md text-[32px] font-normal leading-[1.12] tracking-[-0.03em] sm:text-[38px]")}>
                {focusDeal.company} needs attention.
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-6 text-[#b1b8c3]">
                {focusDeal.notes || `${focusDeal.stage} · ${money(focusDeal.value)}`}
              </p>
              <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#111318]">
                Open deal <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        )}

        {focusCall && (
          <button
            type="button"
            onClick={() => onOpen("call", focusCall.id)}
            className="flex min-h-[220px] flex-col rounded-[28px] border border-[#c9d8f0] bg-white/90 p-6 text-left shadow-[0_18px_40px_rgba(50,117,216,0.08)] lg:col-span-5 lg:min-h-[320px] lg:p-7"
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#8a9099]">
              Latest conversation
            </div>
            <h3 className={cn(display, "mt-6 text-[26px] font-normal leading-[1.15] text-[#111318]")}>
              {focusCall.contactName}
            </h3>
            <div className="mt-1 text-[13px] text-[#60656e]">{focusCall.company}</div>
            <p className="mt-4 text-[14px] leading-6 text-[#4b5563]">
              {focusCall.summary || "Open the recap, recording, and CRM write."}
            </p>
            <span className="mt-auto pt-6 text-[13px] font-medium text-[#3275d8]">Open call →</span>
          </button>
        )}

        {moving && (
          <button
            type="button"
            onClick={() => onOpen("deal", moving.id)}
            className="flex min-h-[190px] flex-col rounded-[28px] bg-[#e6f5ed] p-6 text-left lg:col-span-5 lg:p-7"
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#258456]">
              Movement
            </div>
            <h3 className={cn(display, "mt-5 text-[24px] font-normal leading-[1.15] text-[#163d28]")}>
              {moving.company} looks good.
            </h3>
            <p className="mt-3 text-[14px] leading-6 text-[#3d6b52]">
              {moving.notes || "Keep that one moving. Don’t over-touch it."}
            </p>
            <span className="mt-auto pt-5 text-[13px] font-medium text-[#258456]">Open deal →</span>
          </button>
        )}

        {actions[0] && (
          <button
            type="button"
            onClick={() => onOpen("nba")}
            className="flex min-h-[190px] flex-col rounded-[28px] bg-[#eaf1fb] p-6 text-left lg:col-span-7 lg:p-7"
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#3275d8]">
              I’d do this next
            </div>
            <h3 className={cn(display, "mt-5 max-w-xl text-[24px] font-normal leading-[1.2] text-[#111318]")}>
              {actions[0].title}
            </h3>
            <p className="mt-3 max-w-lg text-[14px] leading-6 text-[#4b5563]">{actions[0].detail}</p>
            <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-[#111318] px-4 py-2 text-[13px] font-medium text-white">
              See actions <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[28px] bg-[#111318] p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8bb5f5]">
                ReadyMode
              </div>
              <h2 className={cn(display, "mt-1 text-[22px]")}>Conversations</h2>
            </div>
            <button type="button" onClick={() => onOpen("calls")} className="text-[12px] font-semibold text-[#8bb5f5]">
              All calls
            </button>
          </div>
          <div className="mt-4 divide-y divide-white/10">
            {(readyCalls.length ? readyCalls : calls).slice(0, 4).map((call) => (
              <button
                key={call.id}
                type="button"
                onClick={() => onOpen("call", call.id)}
                className="flex w-full items-start justify-between gap-3 py-3 text-left first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-3.5 w-3.5 text-[#8bb5f5]" />
                    <span className="truncate text-[13px] font-semibold">{call.contactName}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-[#9aa3b0]">
                    {call.company} · {when(call.startedAt)}
                    {call.duration ? ` · ${Math.round(call.duration / 60)}m` : ""}
                  </div>
                </div>
                {call.recordingUrl ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-[#8bb5f5]">
                    <Play className="h-3 w-3" /> Rec
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-[#8a9099]">
                    {providerLabel(call.provider)}
                  </span>
                )}
              </button>
            ))}
            {!calls.length && (
              <p className="py-6 text-[13px] text-[#9aa3b0]">Waiting on the next completed dial.</p>
            )}
          </div>
        </section>

        <section className="rounded-[28px] bg-[#eaf1fb] p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#3275d8]">
                GoHighLevel
              </div>
              <h2 className={cn(display, "mt-1 text-[22px] text-[#111318]")}>Pipeline</h2>
            </div>
            <button type="button" onClick={() => onOpen("deals")} className="text-[12px] font-semibold text-[#3275d8]">
              All deals
            </button>
          </div>
          <div className="mt-4 divide-y divide-[#c9d8f0]">
            {(ghlDeals.length ? ghlDeals : deals).slice(0, 5).map((deal) => (
              <button
                key={deal.id}
                type="button"
                onClick={() => onOpen("deal", deal.id)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[#111318]">{deal.company}</div>
                  <div className="mt-1 text-[12px] text-[#60656e]">
                    {deal.stage}
                    {deal.source ? ` · ${deal.source}` : ""}
                  </div>
                </div>
                <div className="text-right text-[13px] font-semibold tabular-nums">{money(deal.value)}</div>
              </button>
            ))}
            {!deals.length && (
              <p className="py-6 text-[13px] text-[#60656e]">Sync GoHighLevel to fill this board.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function providerLabel(provider?: string | null) {
  if (!provider) return "Call";
  if (/ready/i.test(provider)) return "ReadyMode";
  if (/gohighlevel|ghl/i.test(provider)) return "GHL";
  return provider;
}

function StatusChip({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-[#22c55e]" : "bg-[#d1d5db]")} />
      <span className="text-[11px] font-semibold">{label}</span>
      <span className="text-[11px] text-[#8a9099]">{detail}</span>
    </div>
  );
}

export function ListView({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[860px] space-y-5 pb-8 pt-4">
      <div>
        <h1 className={cn(display, "text-[32px] font-normal tracking-[-0.03em] text-[#111318]")}>
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-6 text-[#60656e]">{intro}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function Row({
  title,
  meta,
  body,
  chip,
  onClick,
}: {
  title: string;
  meta?: string;
  body?: string;
  chip?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-4 rounded-[22px] border border-black/[0.08] bg-white px-5 py-5 text-left transition hover:border-[#c9d6ea]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className={cn(display, "truncate text-[18px] font-normal text-[#111318]")}>{title}</div>
          {chip && (
            <span className="rounded-full bg-[#eaf1fb] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#3275d8]">
              {chip}
            </span>
          )}
        </div>
        {meta && <div className="mt-1 text-[12px] text-[#8a9099]">{meta}</div>}
        {body && <div className="mt-2 text-[13px] leading-5 text-[#60656e]">{body}</div>}
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#c5cad3]" />
    </button>
  );
}

export function UpcomingView({
  calls,
  onOpen,
}: {
  calls: OperatorCall[];
  onOpen: (id: string) => void;
}) {
  return (
    <ListView
      title="Upcoming calls"
      intro="Customer conversations first. Internal noise stays out."
    >
      {calls.slice(0, 6).map((call) => (
        <Row
          key={call.id}
          title={`${call.contactName} · ${call.company}`}
          meta={when(call.startedAt)}
          body={call.summary || "Prep is ready when you want it."}
          onClick={() => onOpen(call.id)}
        />
      ))}
      {!calls.length && (
        <p className="rounded-[22px] border border-black/[0.08] bg-white px-5 py-6 text-[13px] text-[#60656e]">
          No upcoming calls yet. ReadyMode completed conversations will show here.
        </p>
      )}
    </ListView>
  );
}

export function ActionsView({
  actions,
  tasks,
  onDeal,
  onCall,
  onComplete,
}: {
  actions: OperatorAction[];
  tasks: OperatorTask[];
  onDeal: (id: string) => void;
  onCall: (id: string) => void;
  onComplete: (task: OperatorTask) => void;
}) {
  return (
    <ListView title="Priority actions" intro="What would move revenue — not every task in the CRM.">
      {actions.slice(0, 6).map((action) => (
        <Row
          key={action.title}
          title={action.title}
          body={action.detail}
          chip={action.live ? "Live" : "Example"}
          onClick={() =>
            action.entityType === "call" ? onCall(action.entityId) : onDeal(action.entityId)
          }
        />
      ))}
      {tasks
        .filter((task) => task.status !== "completed")
        .slice(0, 4)
        .map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between rounded-[22px] border border-black/[0.08] bg-white px-5 py-4"
          >
            <div>
              <div className="text-[13px] font-semibold">{task.title}</div>
              <div className="text-[11px] text-[#8a9099]">{task.dueDate || "No due date"}</div>
            </div>
            <button
              type="button"
              onClick={() => onComplete(task)}
              className="rounded-full bg-[#111318] px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Done
            </button>
          </div>
        ))}
    </ListView>
  );
}

export function ChangesView({ deals, calls }: { deals: OperatorDeal[]; calls: OperatorCall[] }) {
  const items = [
    ...calls.slice(0, 3).map((call) => ({
      title: `New conversation with ${call.company}`,
      body: call.summary || "Call landed.",
    })),
    ...deals.slice(0, 3).map((deal) => ({
      title: `${deal.company} is in ${deal.stage}`,
      body: deal.notes || "Pipeline moved.",
    })),
  ];
  return (
    <ListView title="Recent changes" intro="Only the deltas that should change what you do.">
      {items.map((item) => (
        <Row key={item.title} title={item.title} body={item.body} onClick={() => noted()} />
      ))}
    </ListView>
  );
}

export function DealsView({
  deals,
  onOpen,
}: {
  deals: OperatorDeal[];
  onOpen: (id: string) => void;
}) {
  return (
    <ListView title="Focus deals" intro="Where I’d spend selling time. The reason is on the card.">
      {deals.slice(0, 8).map((deal) => (
        <Row
          key={deal.id}
          title={deal.company}
          meta={`${deal.stage} · ${money(deal.value)}`}
          body={deal.notes || "Open this for the workspace, not the CRM form."}
          chip={
            deal.externalSource === "gohighlevel"
              ? "GHL"
              : deal.live
                ? undefined
                : "Example"
          }
          onClick={() => onOpen(deal.id)}
        />
      ))}
      {!deals.length && (
        <p className="rounded-[22px] border border-black/[0.08] bg-white px-5 py-6 text-[13px] text-[#60656e]">
          No pipeline yet. Connect GoHighLevel and sync to pull opportunities.
        </p>
      )}
    </ListView>
  );
}

export function PipelineView({
  deals,
  onOpen,
}: {
  deals: OperatorDeal[];
  onOpen: (id: string) => void;
}) {
  const groups = Array.from(
    deals.reduce((map, deal) => {
      const key = deal.stage || "Open";
      map.set(key, [...(map.get(key) ?? []), deal]);
      return map;
    }, new Map<string, OperatorDeal[]>()),
  );
  return (
    <ListView title="Pipeline intelligence" intro="A scan of attention, not a second CRM board.">
      {groups.map(([stage, rows]) => (
        <div key={stage} className="rounded-[22px] border border-black/[0.08] bg-white p-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#8a9099]">
            {stage}
          </div>
          <div className="space-y-1">
            {rows.map((deal) => (
              <button
                key={deal.id}
                type="button"
                onClick={() => onOpen(deal.id)}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-[13px] hover:bg-[#eaf1fb]"
              >
                <span>{deal.company}</span>
                <span className="text-[11px] text-[#8a9099]">{money(deal.value)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </ListView>
  );
}

export function DealWorkspace({
  deal,
  calls,
  onCall,
}: {
  deal: OperatorDeal;
  calls: OperatorCall[];
  onCall: (id: string) => void;
}) {
  const related = calls.filter(
    (call) =>
      call.company.toLowerCase().includes(deal.company.split(" ")[0].toLowerCase()) ||
      deal.company.toLowerCase().includes(call.company.split(" ")[0].toLowerCase()),
  );
  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 pb-8 pt-4">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#8a9099]">
          Deals / {deal.company}
        </div>
        <h1 className={cn(display, "mt-2 text-[36px] font-normal tracking-[-0.03em] text-[#111318]")}>
          {deal.company}
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#60656e]">
          {deal.notes || "Here’s where this one stands. I’d treat this as a workspace, not a record form."}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <InsightCard eyebrow="Stage" title={deal.stage} body={money(deal.value)} />
        <InsightCard
          eyebrow="Next move"
          title="I’d get the missing decision-maker on the next call."
          body="Don’t send another deck until that person is mapped."
          action="Draft outreach"
          onAction={() => noted("Draft stays here until email send is connected.")}
        />
        <InsightCard
          tone="risk"
          eyebrow="Risk"
          title={related[0]?.risk || "Watch the next meeting."}
          body="If nothing is booked, this cools off fast."
        />
      </div>
      <section className="rounded-[22px] border border-black/[0.08] bg-white p-5">
        <div className="mb-3 text-[12px] font-medium">Latest conversations</div>
        {(related.length ? related : calls.slice(0, 2)).map((call) => (
          <button
            key={call.id}
            type="button"
            onClick={() => onCall(call.id)}
            className="mb-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-[#eaf1fb]"
          >
            <span className="text-[13px]">
              {call.contactName} · {when(call.startedAt)}
            </span>
            <span className="text-[11px] font-medium text-[#3275d8]">Open</span>
          </button>
        ))}
      </section>
    </div>
  );
}

export function CallWorkspace({
  call,
  onApprove,
  userId,
}: {
  call: OperatorCall;
  onApprove: (call: OperatorCall, userId?: string) => void;
  userId?: string;
}) {
  const followUp = `Hi ${call.contactName.split(" ")[0]},\n\n${call.summary || "Thanks for the time today."}\n\n${call.nextSteps[0] ? `Next: ${call.nextSteps[0]}` : "I’ll send the follow-up we discussed."}\n\n—`;

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 pb-8 pt-4">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#8a9099]">
          Conversations / {call.company}
        </div>
        <h1 className={cn(display, "mt-2 text-[36px] font-normal tracking-[-0.03em] text-[#111318]")}>
          {call.contactName}
        </h1>
        <p className="mt-2 text-[14px] leading-6 text-[#60656e]">
          {call.summary || "I’m going through the call. The useful pieces are below."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#8a9099]">
          <span>{providerLabel(call.provider)}</span>
          {call.duration ? <span>· {Math.round(call.duration / 60)} min</span> : null}
          {call.startedAt ? <span>· {when(call.startedAt)}</span> : null}
        </div>
      </div>
      {call.recordingUrl && (
        <section className="rounded-[22px] border border-black/[0.08] bg-white p-5">
          <div className="mb-3 text-[12px] font-medium">Recording</div>
          <audio controls src={call.recordingUrl} className="w-full" />
        </section>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <InsightCard
          eyebrow="What changed"
          title={call.nextSteps[0] || "Next step still needs a date."}
          body={call.objections[0] ? `Watch this: ${call.objections[0]}` : "Nothing ugly jumped out."}
        />
        <InsightCard
          tone="good"
          eyebrow="Coaching"
          title={call.coaching || "Get a concrete approval process before you hang up next time."}
          body="One note. Not a score."
        />
      </div>
      {call.objections.length > 0 && (
        <InsightCard eyebrow="Objections" title={call.objections[0]} body="From the call, not a sentiment score." />
      )}
      <section className="rounded-[22px] border border-black/[0.08] bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[12px] font-medium">Follow-up is ready</div>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(followUp);
              toast.success("Copied. Send it from your inbox.");
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#3275d8]"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-[12px] leading-5 text-[#60656e]">{followUp}</pre>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => noted("Send isn’t wired for this mailbox yet.")}
            className="rounded-full bg-[#111318] px-4 py-2 text-[11px] font-semibold text-white"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => noted()}
            className="rounded-full px-4 py-2 text-[11px] font-semibold text-[#60656e]"
          >
            Regenerate
          </button>
        </div>
      </section>
      <section className="rounded-[22px] border border-black/[0.08] bg-white p-5">
        <div className="mb-2 text-[12px] font-medium">CRM updates</div>
        <p className="text-[13px] text-[#60656e]">
          {call.writebackStatus === "approved"
            ? "Approved. I won’t pretend a provider write happened if it didn’t."
            : "I logged the useful facts. Stage stays put unless you approve it."}
        </p>
        <button
          type="button"
          onClick={() => onApprove(call, userId)}
          className="mt-3 rounded-full bg-[#111318] px-4 py-2 text-[11px] font-semibold text-white"
        >
          {call.writebackStatus === "approved" ? "Already approved" : "Approve CRM update"}
        </button>
      </section>
      {call.transcript && (
        <details className="rounded-[22px] border border-black/[0.08] bg-white p-5">
          <summary className="cursor-pointer text-[12px] font-medium">Evidence</summary>
          <p className="mt-3 text-[12px] leading-5 text-[#60656e]">{call.transcript}</p>
        </details>
      )}
    </div>
  );
}

export function CallsView({
  calls,
  onOpen,
}: {
  calls: OperatorCall[];
  onOpen: (id: string) => void;
}) {
  return (
    <ListView title="Calls & meetings" intro="Outcomes first. Recordings and metadata stay secondary.">
      {calls.map((call) => (
        <Row
          key={call.id}
          title={`${call.contactName} · ${call.company}`}
          meta={`${when(call.startedAt)} · ${call.duration ? `${Math.round(call.duration / 60)}m` : "—"}`}
          body={call.summary || call.nextSteps[0] || "Open for prep or recap."}
          chip={
            call.writebackStatus === "pending_review"
              ? "Review"
              : /ready/i.test(call.provider ?? "")
                ? "ReadyMode"
                : undefined
          }
          onClick={() => onOpen(call.id)}
        />
      ))}
      {!calls.length && (
        <p className="rounded-[22px] border border-black/[0.08] bg-white px-5 py-6 text-[13px] text-[#60656e]">
          No conversations yet. ReadyMode will drop completed calls here with the recording and recap.
        </p>
      )}
    </ListView>
  );
}

export function SimpleSignalView({
  title,
  intro,
  items,
}: {
  title: string;
  intro: string;
  items: { title: string; body: string }[];
}) {
  return (
    <ListView title={title} intro={intro}>
      {items.map((item) => (
        <Row key={item.title} title={item.title} body={item.body} onClick={() => noted()} />
      ))}
    </ListView>
  );
}

export function TasksView({
  tasks,
  onComplete,
}: {
  tasks: OperatorTask[];
  onComplete: (task: OperatorTask) => void;
}) {
  return (
    <ListView title="Tasks" intro="CRM tasks, promises, and Bylda-created work in one queue.">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between rounded-[22px] border border-black/[0.08] bg-white px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onComplete(task)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border",
                task.status === "completed"
                  ? "border-[#111318] bg-[#111318] text-white"
                  : "border-[#dbe4f2]",
              )}
              aria-label="Complete task"
            >
              {task.status === "completed" && <Check className="h-3 w-3" />}
            </button>
            <div>
              <div className="text-[13px] font-semibold">{task.title}</div>
              <div className="text-[11px] text-[#8a9099]">
                {task.dueDate || "No date"} · {task.priority}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => noted("Snooze isn’t stored yet.")}
            className="text-[11px] font-semibold text-[#8a9099]"
          >
            Snooze
          </button>
        </div>
      ))}
    </ListView>
  );
}

export function FollowUpsView({ calls }: { calls: OperatorCall[] }) {
  return (
    <ListView title="Follow-ups" intro="Blank-page work, already started from the call.">
      {calls.slice(0, 5).map((call) => (
        <div key={call.id} className="rounded-[22px] border border-black/[0.08] bg-white p-4">
          <div className="text-[13px] font-semibold">
            {call.contactName} · {call.company}
          </div>
          <p className="mt-2 text-[12px] text-[#60656e]">
            {call.summary || "Follow-up draft is ready when you open the call."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(call.summary || `Follow up with ${call.contactName}`);
                toast.success("Copied.");
              }}
              className="rounded-full bg-[#111318] px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => noted("Send isn’t connected for this inbox.")}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#60656e]"
            >
              Send
            </button>
          </div>
        </div>
      ))}
    </ListView>
  );
}

export function ApprovalsView({
  calls,
  onApprove,
  userId,
}: {
  calls: OperatorCall[];
  onApprove: (call: OperatorCall, userId?: string) => void;
  userId?: string;
}) {
  const pending = calls.filter((call) => call.writebackStatus === "pending_review");
  return (
    <ListView title="Approvals" intro="Only the changes that actually need a human.">
      {(pending.length ? pending : calls.slice(0, 1)).map((call) => (
        <div key={call.id} className="rounded-[22px] border border-black/[0.08] bg-white p-4">
          <div className="text-[13px] font-semibold">{call.company} CRM update</div>
          <p className="mt-2 text-[12px] text-[#60656e]">
            I’m not confident enough to change the stage automatically. Review it?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onApprove(call, userId)}
              className="rounded-full bg-[#111318] px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => noted("Left unchanged.")}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#60656e]"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </ListView>
  );
}

export function PerformanceView({
  deals,
  calls,
  tasks,
}: {
  deals: OperatorDeal[];
  calls: OperatorCall[];
  tasks: OperatorTask[];
}) {
  const open = tasks.filter((task) => task.status !== "completed").length;
  return (
    <ListView title="My performance" intro="A few patterns. Not a vanity dashboard.">
      <InsightCard
        title={`${calls.length} conversations in this workspace`}
        body={`${open} open follow-through items. ${deals.length} live opportunities.`}
      />
      <InsightCard
        title="Next-step clarity is the lever"
        body="Calls that end without a dated next step stall. That’s the coaching to keep."
        action="See coaching"
        onAction={() => noted()}
      />
    </ListView>
  );
}

export function StaticTeamView() {
  return (
    <ListView title="Team intelligence" intro="Exceptions, not another reporting job.">
      <InsightCard
        title="Managers inspect the messy deals, not every call."
        body="Team rollups need org permissions we shouldn’t fake from the client."
        action="Got it"
        onAction={() => noted()}
      />
    </ListView>
  );
}

export function PatternsView({ calls }: { calls: OperatorCall[] }) {
  const objection = calls.flatMap((call) => call.objections)[0];
  return (
    <ListView title="Patterns & trends" intro="Directional, with evidence. No fake stats on three calls.">
      <InsightCard
        title={objection ? `“${objection}” is showing up.` : "Not enough volume for a pattern yet."}
        body="When more calls land, this is where repeated blockers surface."
      />
    </ListView>
  );
}

export function AskBanner({
  query,
  answer,
}: {
  query: string;
  answer: string;
}) {
  return (
    <div className="mx-auto mb-4 w-full max-w-[1080px] rounded-[22px] border border-black/[0.08] bg-white px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#8a9099]">
        You asked
      </div>
      <div className="mt-1 text-[13px] text-[#60656e]">{query}</div>
      <p className={cn(display, "mt-3 text-[22px] leading-7 text-[#111318]")}>{answer}</p>
    </div>
  );
}
