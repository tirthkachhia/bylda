import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { currentMissionQuery } from "@/lib/queries";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Users,
  Target,
  Mail,
  MessageCircle,
  LayoutList,
} from "lucide-react";

export const Route = createFileRoute("/app/launchpad/first-customers")({
  component: FirstCustomersPage,
});

type StepStatus = "done" | "in_progress" | "pending";

interface WorkflowStep {
  order: number;
  icon: typeof Target;
  label: string;
  description: string;
  cta: string | null;
  to: string | null;
  isExternal: boolean;
}

const STEPS: WorkflowStep[] = [
  {
    order: 1,
    icon: Target,
    label: "Generate Your First 10 Customers Blueprint",
    description:
      "Run the AI tool to get a personalised outreach playbook with scripts, channels, and exact messaging for your business.",
    cta: "Run tool",
    to: "/app/launchpad/first-10-customers-finder",
    isExternal: false,
  },
  {
    order: 2,
    icon: Mail,
    label: "Build a Follow-Up Email Sequence",
    description:
      "Create a 5-email follow-up sequence that turns cold leads into paying customers — customised for your offer and audience.",
    cta: "Run tool",
    to: "/app/launchpad/email-sequence",
    isExternal: false,
  },
  {
    order: 3,
    icon: MessageCircle,
    label: "Send Your First Outreach Message TODAY",
    description:
      "Use your blueprint and sequence to reach out to your first 5 prospects. One message sent beats ten messages planned.",
    cta: null,
    to: null,
    isExternal: false,
  },
  {
    order: 4,
    icon: LayoutList,
    label: "Log Your Leads & Track Progress",
    description:
      "Add everyone you've reached out to in the leads pipeline. Tracking turns effort into insight and keeps momentum high.",
    cta: "Open leads",
    to: "/app/leads",
    isExternal: false,
  },
];

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--success)" }} />;
  if (status === "in_progress")
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin" style={{ color: "#7DD3FC" }} />;
  return <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />;
}

function FirstCustomersPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const missionQ = useQuery({ ...currentMissionQuery(userId), enabled: !!userId });
  const missionSteps = (missionQ.data?.steps ?? []) as Array<{
    sort_order: number;
    status: string;
    tool_key: string | null;
  }>;

  // Detect if the current mission is the "first customers" mission by checking tool_key presence
  const isFirstCustomersMission = missionSteps.some((s) => s.tool_key === "first-10-customers");
  const stepStatusMap: Record<number, StepStatus> = isFirstCustomersMission
    ? Object.fromEntries(
        missionSteps.map((s) => [
          s.sort_order,
          s.status === "completed"
            ? "done"
            : s.status === "in_progress"
              ? "in_progress"
              : "pending",
        ]),
      )
    : {};

  const doneCount = isFirstCustomersMission
    ? missionSteps.filter((s) => s.status === "completed").length
    : 0;
  const totalMissionSteps = isFirstCustomersMission ? missionSteps.length : 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Link
            to="/app/launchpad"
            className="inline-flex items-center gap-1.5 transition hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Bylda
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">First Customers</span>
        </div>
        <h1 className="mt-3 font-display text-[1.75rem] font-semibold tracking-tight">
          Land Your First 10 Customers
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          A four-step workflow: AI-generated playbook → follow-up sequences → first outreach → track
          in leads pipeline.
        </p>
      </div>

      {/* Mission progress banner (only when mission is active) */}
      {isFirstCustomersMission && (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{
            borderColor: "rgba(52,211,153,0.25)",
            background: "rgba(52,211,153,0.06)",
          }}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#34D399" }} />
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-medium" style={{ color: "#34D399" }}>
              Active mission
            </span>
            <span className="text-[13px] text-muted-foreground ml-1.5">
              — {doneCount}/{totalMissionSteps} steps complete
            </span>
          </div>
          <Link
            to="/app/mission-control"
            className="flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground shrink-0 hover:text-foreground transition"
          >
            Mission Control <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Workflow steps */}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const status: StepStatus = stepStatusMap[step.order] ?? "pending";
          const isDone = status === "done";
          const StepLucideIcon = step.icon;

          return (
            <div
              key={step.order}
              className="bylda-card rounded-xl p-5"
              style={{
                opacity: isDone ? 0.65 : 1,
                borderColor: isDone ? "rgba(52,211,153,0.2)" : undefined,
              }}
            >
              <div className="flex items-start gap-4">
                {/* Step number + icon */}
                <div className="flex flex-col items-center gap-1 shrink-0 w-8">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold font-mono"
                    style={{
                      background: isDone ? "rgba(52,211,153,0.1)" : "rgba(249,115,22,0.08)",
                      color: isDone ? "#34D399" : "rgba(249,115,22,0.8)",
                    }}
                  >
                    {step.order}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StepLucideIcon
                        className="h-4 w-4 shrink-0"
                        style={{ color: isDone ? "#34D399" : "var(--primary)" }}
                      />
                      <h3
                        className="text-[14.5px] font-semibold"
                        style={{
                          color: isDone ? "var(--muted-foreground)" : "var(--foreground)",
                          textDecoration: isDone ? "line-through" : "none",
                        }}
                      >
                        {step.label}
                      </h3>
                    </div>
                    <StepIcon status={status} />
                  </div>

                  <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>

                  {step.cta && step.to && !isDone && (
                    <Link
                      to={step.to as Parameters<typeof Link>[0]["to"]}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition"
                      style={{
                        background: "rgba(249,115,22,0.1)",
                        color: "var(--primary)",
                        border: "1px solid rgba(249,115,22,0.2)",
                      }}
                    >
                      {step.cta}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}

                  {step.order === 3 && !isDone && (
                    <div
                      className="mt-3 rounded-lg px-3 py-2 text-[11.5px]"
                      style={{
                        background: "rgba(125,211,252,0.06)",
                        border: "1px solid rgba(125,211,252,0.2)",
                        color: "#7DD3FC",
                      }}
                    >
                      Tip: reach out to 5 people today — even imperfect messages get replies. Copy
                      from your blueprint and send before you overthink it.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer prompt */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-2/40 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">
            Following this workflow? Track every person you reach out to in the leads pipeline.
          </span>
        </div>
        <Link
          to="/app/leads"
          className="flex items-center gap-1 text-[12.5px] font-medium shrink-0 ml-3"
          style={{ color: "var(--primary)" }}
        >
          Open leads <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
