# Bylda Operating System Redesign

## Strategic Transformation from Tool Marketplace to Business Operating System

**Status:** Design Phase  
**Scope:** Frontend + UX + Navigation + Information Architecture  
**Constraint:** Zero backend/agent/infrastructure changes  
**Category:** AI Business Operating System (not SaaS)

---

## PART 1: CURRENT STATE AUDIT

### What Currently Exists (as discovered in audit)

**Current Architecture:**

- Mission-based system ✅ (good foundation)
- Multiple disconnected routes (40+ pages)
- Tool-centric thinking (Launchpad tools list)
- Dashboard-style home (Mission Control exists but feels like a dashboard)
- Sidebar navigation with 15+ items
- Chat interface (Bylda intake, chat)
- Multiple "sections" (Academy, Scale, Builder, etc.)

**Current Navigation Structure:**

```
/app/
├── dashboard (home)
├── mission-control (exists!)
├── mission-briefing
├── launchpad (tool hub)
├── builder (workflow)
├── automations
├── integrations
├── settings
├── research
├── templates
├── academy
├── memory
├── scale/
├── bylda/ (AI interface)
└── admin/
```

**Problems with Current Structure:**

1. ❌ 40+ routes feels like browsing software
2. ❌ "Launchpad" is tool-first (not outcome-first)
3. ❌ Multiple entry points (dashboard vs mission-control vs launchpad)
4. ❌ Bylda AI buried in sidebar (should be primary interface)
5. ❌ No clear "what matters most" affordance
6. ❌ Settings/integrations exposed early (should be progressive)
7. ❌ No operating system metaphor

**What's Good:**

- ✅ Mission system actually exists and works
- ✅ Step-based execution guidance (just built!)
- ✅ Founder progress tracking
- ✅ Tool execution working (once aliases fixed)
- ✅ Automation system exists
- ✅ Business context is captured

---

## PART 2: OPERATING SYSTEM REDESIGN

### The New Mental Model

**BEFORE (SaaS Mentality):**

```
Tool Hub → Tool → Run → Output → Dashboard
         ↓
      Features
      Settings
      Analytics
      Integrations
      Reports
```

**AFTER (Operating System):**

```
Mission Control
      ↓
What to Achieve? → Outcome Engine → Guided Execution → Business Graph Update
                        ↓
              (Uses tools behind scenes)
              (Progressive disclosure)
              (Connected to everything)
```

### Core Components of the OS

#### 1. Mission Control (The Central Dashboard)

**NOT a traditional dashboard.**

**IS:**

- Command center for business progress
- Shows what matters most
- Shows what's blocking
- Shows what's next
- Shows recommendations
- Shows achievements

**Screen Structure:**

```
MISSION CONTROL

┌─────────────────────────────────────────────────────────┐
│  Business Overview                                      │
│  ┌──────────────┬──────────────┬──────────────┐        │
│  │ Revenue      │ Leads         │ Customers    │        │
│  │ $0 → $5k/mo  │ 0 → 10        │ 0 → 3        │        │
│  │ On track     │ Behind        │ On track     │        │
│  └──────────────┴──────────────┴──────────────┘        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Active Mission                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │ Land Your First 10 Customers                   │    │
│  │ 2/3 steps complete                             │    │
│  │                                                 │    │
│  │ What's Next:                                   │    │
│  │ Step 3 — Send First Outreach Today             │    │
│  │ Why: Getting that first "yes" validates...     │    │
│  │ How: [Run Tool] [Guide] [Examples]             │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  What's Blocking Progress?                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🔴 No offer built yet (Step 1 of Launch path)    │   │
│  │    → Build Your Offer [Start]                    │   │
│  │                                                   │   │
│  │ 🟡 0 automations active                          │   │
│  │    → Set up first automation [Explore]           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  AI Recommendations                                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Based on your progress:                          │   │
│  │                                                   │   │
│  │ → Create positioning statement (takes 10 min)    │   │
│  │ → Test offer with 3 prospects (this week)        │   │
│  │ → Set up follow-up automation (unlocks scale)    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

#### 2. Outcome Engines (Not Tool Hub)

**REPLACE:** "Launchpad" tool collection

**WITH:** Outcome-driven workflows

**Founder Mode Outcomes:**

```
Build Your Offer
- What: Package your idea into something sellable
- Outcome: Clear offer ready to sell
- Time: 30 minutes
- Tools used: Offer Builder, GTM Strategy, Positioning
- [Start] [Learn More]

Land First Customers
- What: Get your first 10 paying customers
- Outcome: 10 customers, proven product-market fit
- Time: 2-4 weeks
- Tools used: First 10 Customers, Follow-up Sequences, CRM
- [Start] [Learn More]

Build Repeatable System
- What: Turn customer acquisition into a predictable process
- Outcome: Scalable sales machine that runs without you
- Time: 4-8 weeks
- Tools used: GTM Strategy, Automations, Team
- [Start] [Learn More]

Launch Productized Service
- What: Package your service for scale
- Outcome: Service that can be sold by others
- Time: 2-4 weeks
- Tools used: Offer Builder, SOP Creator, Pricing Engine
- [Start] [Learn More]
```

**Operator Mode Outcomes:**

```
Automate Key Process
- What: Remove manual tasks from your business
- Outcome: Process that runs 100% automated
- Time: 1-2 weeks
- Tools used: Workflow Builder, Integrations, Automations
- [Start] [Learn More]

Improve Revenue
- What: Increase customer lifetime value or conversion
- Outcome: Revenue increase of 20%+
- Time: Ongoing
- Tools used: Analytics, A/B Testing, CRM
- [Start] [Learn More]

Connect Your Systems
- What: Link all your tools so data flows automatically
- Outcome: Single source of truth for all business data
- Time: 1 day
- Tools used: Integrations, Data Mapper
- [Start] [Learn More]

Build Your Team Playbook
- What: Document all processes so team can execute
- Outcome: Team operating manual ready for delegation
- Time: 2-4 weeks
- Tools used: SOP Creator, Process Builder
- [Start] [Learn More]
```

---

#### 3. New Navigation Structure

**BEFORE:**

```
Bylda
├── Dashboard
├── Launchpad
├── Builder
├── Automations
├── Integrations
├── Academy
├── Scale
├── Settings
├── Admin
└── Research
```

**AFTER (Founder Mode):**

```
┌─ Mission Control (default, command center)
│
├─ Build (show Outcome Engines relevant to building)
│  └─ Design Offer
│  └─ Validate Idea
│  └─ Build Product
│  └─ Create Pitch
│
├─ Launch (execution focused)
│  └─ Land Customers (active mission here)
│  └─ Automate Process
│  └─ Manage Team
│
├─ Grow (scaling focused)
│  └─ Improve Conversion
│  └─ Generate Leads
│  └─ Expand Revenue
│
└─ Ask Bylda (AI interface)
   └─ "What should I do next?"
   └─ "How do I...?"
   └─ "What's blocking me?"
```

**AFTER (Operator Mode):**

```
┌─ Mission Control (command center)
│
├─ Automate (outcome-driven)
│  └─ Reduce Manual Work
│  └─ Connect Systems
│  └─ Build Workflows
│
├─ Optimize (improve operations)
│  └─ Improve Conversion
│  └─ Increase Revenue
│  └─ Reduce Costs
│
├─ Scale (team + systems)
│  └─ Hire & Train Team
│  └─ Delegate Work
│  └─ Build Playbook
│
└─ Ask Bylda (AI interface)
   └─ "What should I optimize?"
   └─ "How do I...?"
   └─ "What's our biggest bottleneck?"
```

**Key Changes:**

- ✅ No "Launchpad" (tool-first)
- ✅ No "Settings" on main nav (progressive disclosure)
- ✅ No "Admin" on main nav
- ✅ "Ask Bylda" becomes a first-class nav item
- ✅ 4-5 main sections only (not 8+)
- ✅ Every section title is an outcome

---

#### 4. Redesigned Homepage Entry Points

**CURRENT:** Users land on /app/dashboard or /app/mission-control (both feel like dashboards)

**NEW:** Single entry point—Mission Control, but reimagined as an OS

**Flow:**

```
User logs in
    ↓
Mission Control (Command Center)
    ↓
See what matters:
- Active mission
- What's blocking
- What's next
- AI recommendations
    ↓
Click outcome button (Build, Launch, Grow, Ask Bylda)
    ↓
Enter Outcome Engine
    ↓
Guided execution
(Tools used behind scenes)
    ↓
Return to Mission Control with updated state
```

---

### PART 3: COMPONENT HIERARCHY

#### The Operating System Layout

```
Bylda OS
│
├─ Header (minimal)
│  ├─ Business name
│  ├─ Current stage
│  ├─ Quick stats (3 numbers that matter)
│  └─ User menu
│
├─ Navigation (4-5 items, outcome-driven)
│  ├─ Mission Control (always available)
│  ├─ Build/Automate/Optimize (depending on mode)
│  ├─ Grow/Scale (depending on mode)
│  ├─ Bylda (AI, first-class citizen)
│  └─ (Settings hidden in menu)
│
├─ Main Content Area
│  ├─ Context (where are you?)
│  ├─ What Matters (highest priority)
│  ├─ What's Next (action items)
│  ├─ Why It Matters (business rationale)
│  └─ How to Do It (execution path)
│
└─ Footer (minimal)
   ├─ Help
   ├─ Feedback
   └─ Status
```

---

#### Mission Control Component Hierarchy

```
<MissionControl>
  ├─ <BusinessOverview>
  │  ├─ <KPICard> x3 (Revenue, Leads, Customers)
  │  └─ <Stage> (Idea → Validate → Launch → Operate → Scale)
  │
  ├─ <ActiveMission>
  │  ├─ <MissionHeader> (title, progress)
  │  ├─ <CurrentStep>
  │  │  ├─ <StepTitle>
  │  │  ├─ <WhyContext>
  │  │  ├─ <ExecutionOptions> (Run Tool / Manual / Guide)
  │  │  └─ <SuccessCriteria>
  │  │
  │  └─ <NextSteps> (3 upcoming steps)
  │
  ├─ <BlockersList>
  │  ├─ <Blocker> (icon, description, action)
  │  └─ <Blocker>
  │
  ├─ <AIRecommendations>
  │  ├─ "Based on your progress, try:"
  │  ├─ <Recommendation> (action, impact, time)
  │  └─ <Recommendation>
  │
  └─ <QuickActions>
     ├─ [Continue Mission]
     ├─ [Explore Next Outcome]
     └─ [Ask Bylda]
```

---

#### Outcome Engine Component Hierarchy

```
<OutcomeEngine name="Build Your Offer">
  │
  ├─ <OutcomeHeader>
  │  ├─ Title: "Build Your Offer"
  │  ├─ Description: "Package your idea into something sellable"
  │  ├─ Outcome: "Clear offer + pricing ready to sell"
  │  ├─ Time: "30 minutes"
  │  └─ Impact: "First step to revenue"
  │
  ├─ <ProgressTracker>
  │  ├─ Step 1/3: "Design offer with AI"
  │  ├─ Step 2/3: "Set pricing"
  │  └─ Step 3/3: "Write positioning"
  │
  ├─ <CurrentStep>
  │  ├─ <StepExecution> (from previous audit implementation!)
  │  │  ├─ Why do this
  │  │  ├─ How to do it (multiple paths)
  │  │  ├─ What's next
  │  │  └─ Common mistakes
  │  │
  │  └─ <ExecutionPanel>
  │     ├─ [Run Tool]
  │     ├─ [Manual Path]
  │     └─ [Get Help]
  │
  ├─ <RelatedOutcomes>
  │  ├─ "After you complete this:"
  │  ├─ <OutcomeCard> → "Land First Customers"
  │  └─ <OutcomeCard> → "Create GTM Strategy"
  │
  └─ <QuitButton>
     └─ [Back to Mission Control]
```

---

## PART 4: SPECIFIC IMPLEMENTATION CHANGES

### Change 1: Restructure Navigation

**FILE:** `src/routes/__root.tsx` (or layout wrapper)

**BEFORE:**

```typescript
const ROUTES = [
  { label: "Dashboard", href: "/app/dashboard" },
  { label: "Mission Control", href: "/app/mission-control" },
  { label: "Launchpad", href: "/app/launchpad" },
  { label: "Builder", href: "/app/builder" },
  { label: "Automations", href: "/app/automations" },
  { label: "Integrations", href: "/app/integrations" },
  { label: "Academy", href: "/app/academy" },
  { label: "Scale", href: "/app/scale" },
  { label: "Settings", href: "/app/settings" },
];
```

**AFTER:**

```typescript
// Determine mode (create vs operate) from workspace
const mode = workspace?.mode === "operate" ? "operate" : "create";

const NAVIGATION_ITEMS =
  mode === "create"
    ? [
        {
          id: "mission-control",
          label: "Mission Control",
          href: "/app/mission-control",
          icon: Target,
          badge: "default", // shows active mission status
          description: "Command center for your business",
        },
        {
          id: "build",
          label: "Build",
          href: "/app/outcomes/build",
          icon: Hammer,
          description: "Design offer, validate idea, build product",
        },
        {
          id: "launch",
          label: "Launch",
          href: "/app/outcomes/launch",
          icon: Rocket,
          description: "Land customers, create revenue",
        },
        {
          id: "grow",
          label: "Grow",
          href: "/app/outcomes/grow",
          icon: TrendingUp,
          description: "Scale revenue, improve conversion",
        },
        {
          id: "bylda",
          label: "Ask Bylda",
          href: "/app/bylda",
          icon: Sparkles,
          description: "AI business advisor",
          emphasis: true, // make this stand out
        },
      ]
    : [
        {
          id: "mission-control",
          label: "Mission Control",
          href: "/app/mission-control",
          icon: Target,
        },
        {
          id: "automate",
          label: "Automate",
          href: "/app/outcomes/automate",
          icon: Zap,
        },
        {
          id: "optimize",
          label: "Optimize",
          href: "/app/outcomes/optimize",
          icon: Settings,
        },
        {
          id: "scale",
          label: "Scale",
          href: "/app/outcomes/scale",
          icon: TrendingUp,
        },
        {
          id: "bylda",
          label: "Ask Bylda",
          href: "/app/bylda",
          icon: Sparkles,
          emphasis: true,
        },
      ];

// Hide settings, integrations, builder, academy behind progressive disclosure
// They appear in context when needed, not in main nav
```

**Result:**

- 4-5 navigation items instead of 8+
- Outcome-driven naming
- Mode-aware (changes based on founder vs operator)
- Settings hidden until needed
- Bylda elevated to first-class

---

### Change 2: Redesign Mission Control as OS Hub

**FILE:** `src/routes/app.mission-control.tsx` (complete rewrite of UI)

**BEFORE:** Looked like a dashboard with cards and metrics

**AFTER:** Structured as operating system with clear information hierarchy

```typescript
export function MissionControlPage() {
  const workspace = useWorkspace();
  const mission = useCurrentMission();
  const blockers = useBlockers(); // new hook
  const recommendations = useAIRecommendations(); // new hook
  const kpis = useKeyMetrics();

  return (
    <div className="mission-control-os">
      {/* 1. CONTEXT: Where are you? */}
      <ContextBreadcrumb
        businessName={workspace.name}
        stage={workspace.stage}
        mode={workspace.mode}
      />

      {/* 2. KEY METRICS: What matters most? */}
      <MetricsOverview
        metrics={kpis}
        onMetricClick={(metric) => navigateTo(`/app/insights/${metric}`)}
      />

      {/* 3. ACTIVE MISSION: What's the current priority? */}
      <ActiveMissionPanel
        mission={mission}
        onContinue={() => scrollToStep()}
        onSwitch={() => showMissionSelector()}
      />

      {/* 4. CURRENT STEP: What should I do right now? */}
      <CurrentStepExecution
        step={mission.currentStep}
        guidance={getGuidance(mission.currentStep)}
        onComplete={() => advanceMission()}
      />

      {/* 5. BLOCKERS: What's in the way? */}
      <BlockersPanel
        blockers={blockers}
        onResolve={(blockerId) => showResolutionPath(blockerId)}
      />

      {/* 6. RECOMMENDATIONS: What should I do next? */}
      <AIRecommendationsPanel
        recommendations={recommendations}
        onSelect={(rec) => startOutcome(rec.outcomeId)}
      />

      {/* 7. QUICK ACTIONS: Where can I go? */}
      <QuickActionsBar
        items={[
          { label: "Continue Mission", action: continueCurrentMission },
          { label: "Start New Outcome", action: showOutcomeSelector },
          { label: "Ask Bylda", action: openAIInterface },
        ]}
      />
    </div>
  );
}
```

**New Hooks Needed:**

```typescript
// src/hooks/use-blockers.ts
function useBlockers() {
  // Return business blockers based on:
  // - Mission progress
  // - Completed tasks
  // - KPI status
  // - Automation status
  // Example: "No automation set up" (blocks scaling)
}

// src/hooks/use-ai-recommendations.ts
function useAIRecommendations() {
  // Return next 3 AI-recommended outcomes based on:
  // - Current mission
  // - Business stage
  // - Previous actions
  // - KPI gaps
  // Example: "Create positioning statement (10 min)"
}

// src/hooks/use-key-metrics.ts
function useKeyMetrics() {
  // Return only 3 metrics that matter for this stage:
  // Founder mode: Revenue, Leads, Customers
  // Operator mode: Revenue, Efficiency, Team Size
}
```

---

### Change 3: Create Outcome Engines Route

**FILE:** `src/routes/app.outcomes.[category].tsx` (new file)

```typescript
export const Route = createFileRoute("/app/outcomes/$category")({
  component: OutcomeEnginePage,
});

interface OutcomeDefinition {
  id: string;
  name: string;
  category: "build" | "launch" | "grow" | "automate" | "optimize" | "scale";
  outcome: string;
  timeEstimate: number; // minutes
  impact: string;
  steps: StepDefinition[];
  relatedOutcomes: string[];
  blockedBy?: string[];
}

const OUTCOMES: Record<string, OutcomeDefinition> = {
  "build-offer": {
    id: "build-offer",
    name: "Build Your Offer",
    category: "build",
    outcome: "Clear offer + pricing ready to sell",
    timeEstimate: 30,
    impact: "First step to generating revenue",
    steps: [
      {
        title: "Design offer with AI",
        toolKey: "offer",
        description: "...",
      },
      {
        title: "Set pricing strategy",
        toolKey: "pricing-calculator",
        description: "...",
      },
      {
        title: "Write positioning statement",
        toolKey: null, // manual step
        description: "...",
      },
    ],
    relatedOutcomes: ["land-first-customers", "create-gtm-strategy"],
  },

  "land-first-customers": {
    id: "land-first-customers",
    name: "Land First 10 Customers",
    category: "launch",
    outcome: "10 paying customers + proven product-market fit",
    timeEstimate: 1440, // 1 day in minutes
    impact: "Transition from idea to revenue",
    steps: [
      {
        title: "Generate customer acquisition blueprint",
        toolKey: "first-10-customers",
        description: "...",
      },
      {
        title: "Set up follow-up automation",
        toolKey: "followup",
        description: "...",
      },
      {
        title: "Send first outreach today",
        toolKey: null,
        description: "...",
      },
    ],
    relatedOutcomes: ["build-repeatable-system", "improve-conversion"],
    blockedBy: ["build-offer"],
  },

  // ... more outcomes
};

function OutcomeEnginePage() {
  const { category } = useParams();
  const outcomes = Object.values(OUTCOMES).filter(
    (o) => o.category === category
  );
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  if (!selectedOutcome) {
    // Show outcome selector
    return <OutcomeSelector outcomes={outcomes} onSelect={setSelectedOutcome} />;
  }

  const outcome = OUTCOMES[selectedOutcome];

  // Show guided execution
  return (
    <OutcomeExecution
      outcome={outcome}
      onComplete={() => {
        // Mark outcome complete
        // Show related outcomes
        // Return to Mission Control
        navigate("/app/mission-control");
      }}
      onQuit={() => navigate("/app/mission-control")}
    />
  );
}
```

---

### Change 4: Reimagine Bylda AI Interface

**FILE:** `src/routes/app.bylda.tsx` (redesign)

**BEFORE:** Chat interface with "What would you like to ask?"

**AFTER:** Goal-oriented interface that guides business execution

```typescript
export function ByldaPage() {
  const workspace = useWorkspace();
  const mode = workspace?.mode === "operate" ? "operate" : "create";

  const suggestedGoals =
    mode === "create"
      ? [
          "Launch my offer",
          "Land first customers",
          "Validate my idea",
          "Create positioning",
          "Build go-to-market plan",
        ]
      : [
          "Automate key process",
          "Improve conversion rate",
          "Connect my systems",
          "Scale team",
          "Reduce costs",
        ];

  return (
    <div className="bylda-os-interface">
      <div className="bylda-header">
        <h1>What are you trying to achieve?</h1>
        <p>Bylda will help you execute and guide every step</p>
      </div>

      {/* Suggested goals for this mode/stage */}
      <div className="suggested-goals">
        {suggestedGoals.map((goal) => (
          <GoalButton
            key={goal}
            label={goal}
            onClick={() => startConversation(goal)}
          />
        ))}
      </div>

      {/* OR custom goal input */}
      <div className="custom-goal-input">
        <textarea
          placeholder="Describe what you want to achieve..."
          onChange={(e) => setCustomGoal(e.target.value)}
        />
        <button onClick={() => startConversation(customGoal)}>
          Help Me Execute
        </button>
      </div>

      {/* Conversation (if active) */}
      {activeGoal && (
        <ConversationPanel
          goal={activeGoal}
          onExecute={(action) => {
            // Execute action (run tool, start outcome, etc)
          }}
          onComplete={() => {
            // Mark goal complete
            // Return to Mission Control
          }}
        />
      )}

      {/* Quick access to common questions */}
      <div className="quick-questions">
        <h3>Common Questions</h3>
        <ul>
          <li>"What's blocking my progress?"</li>
          <li>"What should I do next?"</li>
          <li>"How do I improve conversion?"</li>
          <li>"What's my biggest bottleneck?"</li>
        </ul>
      </div>
    </div>
  );
}
```

---

### Change 5: Progressive Disclosure of Advanced Features

**Create a new hook:**

```typescript
// src/hooks/use-progressive-disclosure.ts
function useProgressiveDisclosure() {
  const workspace = useWorkspace();
  const mission = useCurrentMission();
  const toolRuns = useToolRuns();

  return {
    // Show Builder after user completes first mission
    showBuilder: toolRuns.length >= 5,

    // Show Integrations after first 3 missions
    showIntegrations: toolRuns.length >= 10,

    // Show Advanced Analytics after user has active automations
    showAdvancedAnalytics: hasActiveAutomations,

    // Show Team Tools after revenue > $0
    showTeamTools: workspace.revenue > 0,

    // Show Scale section after 10+ customers
    showScale: workspace.customerCount >= 10,
  };
}
```

**Usage in routes:**

```typescript
// Only show integrations page if user is ready for it
if (!useProgressiveDisclosure().showIntegrations) {
  return <NotAvailableYet message="Complete more missions first" />;
}
```

---

### Change 6: Restructure Routes for OS Model

**BEFORE:**

```
/app/
├── /dashboard
├── /launchpad
├── /launchpad/$tool
├── /builder
├── /automations
├── /integrations
└── /settings
```

**AFTER:**

```
/app/
├── /mission-control (command center)
├── /outcomes/:category (Build, Launch, Grow, Automate, etc)
├── /outcomes/:category/:outcomeId (specific outcome execution)
├── /bylda (AI interface)
├── /_tools/:toolId (hidden, accessed via outcomes)
├── /_builder (hidden, accessed when needed)
├── /_integrations (hidden, accessed when needed)
└── /_settings (hidden, progressive disclosure)
```

**Routes file structure:**

```typescript
// src/routes/app.mission-control.tsx
export const Route = createFileRoute("/app/mission-control")({
  component: MissionControlPage,
});

// src/routes/app.outcomes.$category.tsx
export const Route = createFileRoute("/app/outcomes/$category")({
  component: OutcomeEnginePage,
});

// src/routes/app.outcomes.$category.$outcomeId.tsx
export const Route = createFileRoute("/app/outcomes/$category/$outcomeId")({
  component: OutcomeExecutionPage,
});

// src/routes/app.bylda.tsx (redesigned)
export const Route = createFileRoute("/app/bylda")({
  component: ByldaOSPage,
});

// Hidden/Progressive routes
// src/routes/app._tools.$toolId.tsx (private, accessed via outcomes)
// src/routes/app._builder.tsx (private, accessed when ready)
// src/routes/app._integrations.tsx (private, accessed when ready)
// src/routes/app.settings.tsx (private, in menu only)
```

---

## PART 5: INFORMATION ARCHITECTURE

### Business Graph Implementation

**NOT a visible graph, but the underlying structure:**

```typescript
// src/lib/business-graph.ts
interface BusinessGraph {
  business: {
    name: string;
    stage: "Idea" | "Validate" | "Launch" | "Operate" | "Scale";
    mode: "create" | "operate";
  };

  goals: {
    primary: string; // e.g., "Land first 10 customers"
    timeline: string;
    metrics: string[];
  };

  activeMission: {
    title: string;
    progress: number;
    currentStep: string;
  };

  outcomes: {
    completed: string[];
    inProgress: string[];
    available: string[];
  };

  blockers: {
    id: string;
    description: string;
    resolution: string;
    priority: "critical" | "high" | "medium";
  }[];

  automations: {
    active: number;
    potential: number;
  };

  revenue: {
    current: number;
    target: number;
    customers: number;
    trend: "up" | "stable" | "down";
  };

  team: {
    size: number;
    roles: string[];
  };

  aiOutputs: {
    strategies: number;
    tools: number;
    recommendations: number;
  };
}
```

**Every page pulls from this graph.**
**Every action updates this graph.**
**Every recommendation is based on this graph.**

---

## PART 6: SCREEN LAYOUTS

### Screen 1: Mission Control (The OS Homepage)

```
┌─ Bylda OS ──────────────────────────────────────────────────────┐
│  Your Company Name                       Stage: Launch  ▼       │
└────────────────────────────────────────────────────────────────┘

┌─ What Matters Most ────────────────────────────────────────────┐
│  Revenue                    Leads                  Customers     │
│  $0 → $5k/month             0 → 10                 0 → 3         │
│  On track (4/4 actions)     Behind (1/5 actions)   On track      │
└────────────────────────────────────────────────────────────────┘

┌─ Your Current Mission ──────────────────────────────────────────┐
│  Land Your First 10 Customers                      2/3 complete  │
│                                                                   │
│  ┌─ What's Next: Step 3 — Send First Outreach ────────────────┐ │
│  │                                                              │ │
│  │  Why: Your first "yes" proves people want what you sell     │ │
│  │                                                              │ │
│  │  Here's how to do it:                                        │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │ Option 1: Use First Outreach Tool                   │   │ │
│  │  │ AI generates message templates + sequence            │   │ │
│  │  │ [Run Tool]                                           │   │ │
│  │  │                                                       │   │ │
│  │  │ Option 2: Manual Path                               │   │ │
│  │  │ Use the formula: "Hi [Name], I noticed...            │   │ │
│  │  │ [Learn Formula]                                      │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                              │ │
│  │  You'll be done when:                                        │ │
│  │  ☐ You've sent first message                                │ │
│  │  ☐ You've added them to Leads in Bylda                       │ │
│  │  ☐ You have follow-up scheduled                             │ │
│  │                                                              │ │
│  │  [Mark Complete]     [Skip Step]     [Get Help]             │ │
│  └──────────────────────────────────────────────────────────┘  │ │
│                                                                   │
│  Next steps in mission:                                          │
│  4. Follow up after 3 days                                       │ │
│  5. Offer solution to first interested person                   │ │
└────────────────────────────────────────────────────────────────┘

┌─ What's Blocking Progress ─────────────────────────────────────┐
│  🔴 No offer built yet                                          │
│     → Start "Build Your Offer" mission [5 min setup + 30 min]   │
│                                                                  │
│  🟡 No follow-up automation                                     │
│     → Set up email automation [15 min]                          │
│     → Automatically send follow-ups on your schedule            │
└────────────────────────────────────────────────────────────────┘

┌─ Based On Your Progress ───────────────────────────────────────┐
│  Next recommended actions:                                       │
│                                                                  │
│  1. Document positioning statement (10 min)                     │
│     Impact: Used in every sales conversation                    │
│     [Start]                                                      │
│                                                                  │
│  2. Automate email follow-ups (15 min)                          │
│     Impact: Never miss a follow-up again                        │
│     [Start]                                                      │
│                                                                  │
│  3. Create customer intake form (20 min)                        │
│     Impact: Capture all customer info automatically             │
│     [Start]                                                      │
└────────────────────────────────────────────────────────────────┘

[Continue Mission] [Start New Outcome] [Ask Bylda] [Manage Blockers]
```

---

### Screen 2: Outcome Engine (Build Your Offer)

```
┌─ Bylda OS: Outcomes ──────────────────────────────────────────────┐
│  ← Back to Mission Control                                       │
└──────────────────────────────────────────────────────────────────┘

┌─ Build Your Offer ───────────────────────────────────────────────┐
│                                                                    │
│  What: Package your idea into something sellable                  │
│  Outcome: Clear offer + pricing ready to sell                    │
│  Effort: 30 minutes                                               │
│  Impact: Foundation for all revenue                              │
│                                                                    │
│  Progress: Step 1 of 3                                            │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘

┌─ Step 1 of 3: Design Offer With AI ──────────────────────────────┐
│                                                                    │
│  Why: You need a clear, compelling offer to sell anything        │
│  If this step is unclear, you won't close customers              │
│                                                                    │
│  Here's what you'll do:                                           │
│  You'll describe your business to Bylda.                          │
│  Bylda will analyze it and design an offer.                       │
│  You'll get: target customer, core deliverable, price, bonuses   │
│                                                                    │
│  Time estimate: 10 minutes                                        │
│                                                                    │
│  How to do it:                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [Run Offer Builder Tool]                                 │   │
│  │ Opens form to describe your business                     │   │
│  │ Bylda designs offer based on your inputs                  │   │
│  │ You get structured offer architecture                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Or do it manually:                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [Use This Template]                                      │   │
│  │ Target customer: ________                                │   │
│  │ Problem they have: ________                              │   │
│  │ Your solution: ________                                  │   │
│  │ Price: ________                                          │   │
│  │ Why they should choose you: ________                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│  When you're done:                                                │
│  • You've described your offer                                   │
│  • You have target customer defined                              │
│  • You've set initial pricing                                    │
│                                                                    │
│  [Mark Complete]     [Get Help]     [Save as Draft]              │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘

┌─ Related Outcomes ───────────────────────────────────────────────┐
│  After you finish this, do these:                                │
│  1. Land First Customers (2-4 weeks)                             │
│  2. Create GTM Strategy (2 hours)                                │
│  3. Build Repeatable System (4 weeks)                            │
└──────────────────────────────────────────────────────────────────┘
```

---

### Screen 3: Ask Bylda (AI Interface)

```
┌─ Bylda OS: AI Advisor ──────────────────────────────────────────┐
│  ← Back to Mission Control                                     │
└────────────────────────────────────────────────────────────────┘

┌─ What Are You Trying To Achieve? ──────────────────────────────┐
│                                                                 │
│  [Launch my offer]                                            │
│  [Land first customers]                                       │
│  [Create positioning]                                         │
│  [Build go-to-market plan]                                    │
│  [Validate my idea]                                           │
│                                                                 │
│  Or describe your own goal:                                    │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ I want to...                                           │   │
│  │ ________________________________                        │   │
│  │                                                         │   │
│  │ [Help Me Execute]                                      │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌─ Conversation (if goal selected) ──────────────────────────────┐
│                                                                 │
│  Bylda: You want to land your first customers.                 │
│        Based on your business stage, here's my advice:        │
│                                                                 │
│        1. First, your offer must be crystal clear             │
│           Timeline: 30 min                                     │
│           → Start "Build Your Offer" mission [→]              │
│                                                                 │
│        2. Second, identify your ideal customer                │
│           Timeline: 20 min                                     │
│           → Complete Step 3 in current mission [→]            │
│                                                                 │
│        3. Third, create customer acquisition plan             │
│           Timeline: 2 hours                                    │
│           → Use "Land First Customers" outcome [→]            │
│                                                                 │
│        Which should we tackle first?                          │
│        [Build Offer] [Identify Customer] [Get Plan]           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

Quick questions:
• "What's my biggest bottleneck right now?"
• "What should I do next?"
• "How do I improve my conversion rate?"
• "What's blocking my progress?"
```

---

## PART 7: DESIGN TOKENS & FEEL

### Color & Typography Strategy

**Feeling: 40% Apple + 30% Linear + 20% Arc Browser + 10% Palantir**

```
Color Palette:
- Primary (Action): Energetic blue (#3B82F6)
- Success: Calm green (#22C55E)
- Warning: Warm amber (#F59E0B)
- Danger: Direct red (#EF4444)
- Neutral: Professional grays (used for hierarchy)

Typography:
- Headlines: San Francisco (Apple-like), bold, tight line-height
- Body: Inter (clean, readable), regular
- Code: Fira Code (monospace)

Spacing:
- Extreme consistency: 4, 8, 16, 24, 32, 48, 64px
- Generous whitespace
- Never crowded

Shadows:
- Subtle: 0 1px 2px rgba(0,0,0,0.05)
- Medium: 0 4px 6px rgba(0,0,0,0.07)
- Never heavy or dramatic

Borders:
- 1px, very subtle
- Colors: rgba(0,0,0,0.05) on light backgrounds

Animations:
- Spring physics (quick, natural)
- Never flashy
- Help users understand state changes
- 200-300ms duration

Interaction:
- Hover states: subtle color shift + shadow
- Active states: bold primary color
- Loading: calm spinner or progress bar
- Empty states: helpful illustration + clear next action
```

---

## PART 8: MIGRATION STRATEGY

### How to Transition Without Breaking Things

**Phase 1 (Week 1): Set up new routes**

- Create `/app/outcomes/` routes (inactive)
- Create new Bylda interface (inactive)
- Create Mission Control v2 (inactive)

**Phase 2 (Week 2): Soft launch**

- Redirect `/app/dashboard` → `/app/mission-control`
- Add "Try New Navigation" experiment flag
- Show navigation redesign to 10% of users

**Phase 3 (Week 3): Monitor & iterate**

- Measure completion rates
- Gather feedback from experiment group
- Fix bugs, improve messaging

**Phase 4 (Week 4): Full rollout**

- Roll out to all users
- Hide old Launchpad in menu (progressive disclosure)
- Archive old routes

**Phase 5 (Week 5+): Deep integration**

- Integrate business graph fully
- Add AI recommendations
- Optimize based on usage data

---

## PART 9: IMPLEMENTATION PRIORITY

### Must Have (Week 1-2)

- [ ] Mission Control redesign (command center feel)
- [ ] Navigation restructure (4-5 items, outcome-driven)
- [ ] Outcome Engine framework (render outcomes)
- [ ] Ask Bylda redesign (goal-oriented)

### Should Have (Week 2-3)

- [ ] Progressive disclosure system
- [ ] Business graph backend
- [ ] Blocker detection
- [ ] AI recommendations

### Nice to Have (Week 3+)

- [ ] Advanced analytics
- [ ] Team management
- [ ] Detailed integrations UI
- [ ] Custom workflows UI

---

## FINAL: THE REALIZATION

**Current State:** Bylda feels like a tool collection

```
User: "I'm in Bylda"
Means: "I'm browsing software"

User thinks: "What tool should I use?"
User feels: Overwhelmed by options
```

**Desired State:** Bylda feels like an OS

```
User: "I'm in Bylda"
Means: "I'm running my business"

User thinks: "What should I achieve today?"
User feels: Guided, powerful, capable
```

**The Difference:** Mission first, tools hidden

- ✅ Stop saying "use the Offer Builder"
- ✅ Start saying "build your offer"
- ✅ Stop showing 15 menu items
- ✅ Start showing 5 outcome paths
- ✅ Stop asking "what tool do you want?"
- ✅ Start asking "what do you want to achieve?"

**This is the redesign.**

Everything else is supporting this mental model shift.

---

**Ready to implement? The structure is complete. The routes are mapped. The components are defined. The journey is clear.**

**What's next: Code it and ship it.**
