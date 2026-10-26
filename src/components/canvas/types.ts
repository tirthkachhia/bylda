export type CanvasView =
  | "brief"
  | "upcoming"
  | "actions"
  | "changes"
  | "deals"
  | "pipeline"
  | "deal"
  | "risks"
  | "stakeholders"
  | "commitments"
  | "calls"
  | "call"
  | "objections"
  | "signals"
  | "coaching"
  | "nba"
  | "followups"
  | "tasks"
  | "approvals"
  | "performance"
  | "team"
  | "patterns";

export type CanvasState = {
  view: CanvasView;
  entityId?: string;
};

export type OperatorDeal = {
  id: string;
  name: string;
  company: string;
  stage: string;
  value: number | null;
  notes: string | null;
  email?: string | null;
  source?: string | null;
  externalSource?: string | null;
  updatedAt: string;
  live: boolean;
};

export type OperatorCall = {
  id: string;
  contactName: string;
  company: string;
  direction: string;
  status: string;
  duration: number | null;
  startedAt: string | null;
  summary: string | null;
  objections: string[];
  nextSteps: string[];
  competitors: string[];
  writebackStatus: string | null;
  insightId: string | null;
  transcript: string | null;
  coaching: string | null;
  risk: string | null;
  provider?: string | null;
  recordingUrl?: string | null;
  live: boolean;
};

export type CanvasConnections = {
  readymode: boolean;
  gohighlevel: boolean;
  syncing: boolean;
  lastSync: string | null;
};

export type OperatorTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  status: string;
  live: boolean;
};

export type OperatorAction = {
  kind: string;
  title: string;
  detail: string;
  score: number;
  entityType: string;
  entityId: string;
  live: boolean;
};

export type CrmAnswers = {
  business_description: string;
  buyer_and_motion: string;
  call_goal: string;
  must_capture: string[];
  custom_capture: string;
  review_mode: "conservative" | "balanced" | "fast";
};

export type CrmProfile = {
  status: string;
  generated_at: string;
  generated_profile: {
    label?: string;
    summary?: string;
    insightQuestions?: string[];
  };
};
