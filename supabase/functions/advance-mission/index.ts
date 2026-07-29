// TASK-057 · Mission Progression Engine
// TASK-056 · First-mission assignment engine (referenced here; seeding in provision-workspace)
//
// Handles:
//   - Mark a mission step complete
//   - Complete the whole mission and assign next one
//   - Log 'mission_step_completed' and 'first_mission_completed' events

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Action = "complete_step" | "complete_mission" | "skip_step";

// Next missions to assign after the first one completes, by lane.
// Descriptions are written at a 5th-grade reading level with clear WHY, WHAT, and HOW.
const NEXT_MISSIONS: Record<
  string,
  Array<{
    title: string;
    description: string;
    steps: Array<{ title: string; description: string; tool_key: string | null }>;
  }>
> = {
  Idea: [
    {
      title: "Go to Market — Find Your First Customer",
      description:
        "You've proven your idea is solid. Now it's time to find the first person who will pay for it. " +
        "This mission builds your go-to-market plan and your pitch — the tools you need to walk out the door and get your first sale.",
      steps: [
        {
          title: "Step 1 — Build a Full Go-To-Market Plan",
          description:
            "Open the GTM Strategy tool. Tell Bylda about your business, who your ideal customer is, and what problem you solve. " +
            "Bylda will create a detailed plan that covers: (1) which type of customer to target first, " +
            "(2) exactly where to find them (LinkedIn, cold email, local networking, Facebook groups, etc.), " +
            "(3) what to say to get their attention, and (4) a week-by-week schedule for the next 90 days. " +
            "After reading the plan, highlight the ONE channel you will focus on for the first 30 days. " +
            "Write it on a sticky note and put it somewhere you see every day.",
          tool_key: "gtm-strategy",
        },
        {
          title: "Step 2 — Create a Pitch That Gets People Excited",
          description:
            "A pitch is the story you tell about your business that makes people want to learn more or invest. " +
            "Open the Pitch Generator tool and describe your business, the problem you solve, and who your customer is. " +
            "Bylda will write a short, compelling pitch you can use in emails, social media posts, investor meetings, or conversations. " +
            "Practice saying the pitch out loud 5 times. Then record yourself on your phone saying it. " +
            "Watch it back. If you sound confident and clear, you're ready. If you stumble, practice more. " +
            "Share your pitch with one trusted person and ask: 'Does this make sense? Would you buy this?'",
          tool_key: "pitch-generator",
        },
        {
          title: "Step 3 — Write Down Your Ideal Customer Profile (ICP)",
          description:
            "An ICP (Ideal Customer Profile) is a detailed description of the PERFECT person or company to buy from you. " +
            "Open a Google Doc or notes app. Fill in these blanks: " +
            "'My ideal customer is a [job title or type of person] who works at/runs [type of company or situation]. " +
            "They struggle with [specific problem]. They want [specific result]. They currently [how they solve the problem today]. " +
            "They are willing to pay [price range] for a solution.' " +
            "Be as specific as possible. The more specific your ICP, the easier it is to find and sell to them. " +
            "Save this document — you will use it in every sales and marketing decision going forward.",
          tool_key: null,
        },
      ],
    },
  ],
  Offer: [
    {
      title: "Close Your First 10 Paying Customers",
      description:
        "Your offer is built — now let's fill it with paying customers. " +
        "This mission gives you the exact scripts, strategies, and sequences to go from zero customers to ten. " +
        "Each step builds on the last. Do them in order.",
      steps: [
        {
          title: "Step 1 — Get Your First 10 Customers Blueprint",
          description:
            "Open the First 10 Customers tool. Enter your offer details, your target customer type, and your price. " +
            "Bylda will give you a specific, step-by-step plan to land 10 customers within 30 days. " +
            "The plan will include outreach scripts, platforms to use, and daily actions. " +
            "After reading the output, DO THIS: make a list of 20 specific people or businesses who fit your target customer. " +
            "Not categories — actual names or company names. Real people. This list is your 'hit list.' " +
            "Your goal is to reach out to all 20 within the next 7 days.",
          tool_key: "first-10-customers",
        },
        {
          title: "Step 2 — Set Up Your Follow-Up Email Sequence",
          description:
            "Most people say no the first time — not because they don't want your product, but because they're busy. " +
            "The key is following up without being annoying. Open the Follow-Up Sequence tool. " +
            "Tell Bylda your business type and target customer. Bylda will write 5 emails spread over 14 days. " +
            "Each email has one job: Email 1 introduces you. Email 2 gives free value. Email 3 handles the most common objection. " +
            "Email 4 shares a story or testimonial. Email 5 makes a clear, direct ask for the sale. " +
            "Set these up as templates in your email tool right now. Every prospect on your hit list gets this sequence after your first message.",
          tool_key: "followup",
        },
        {
          title: "Step 3 — Send Your First Invoice and Get Paid",
          description:
            "The moment you get a 'yes' — even a soft yes like 'sounds interesting, tell me more' — send an invoice immediately. " +
            "Don't wait until everything is 'perfect.' A verbal yes means nothing until money is exchanged. " +
            "Use any invoicing tool (Wave, PayPal, Stripe, Venmo for small amounts) to send a professional invoice. " +
            "Include: what they're buying, the price, and a due date (usually 7 days). " +
            "Add a note that says payment is required before work begins. " +
            "When you receive your first payment, come back and mark this complete. " +
            "Congratulations — you're officially a business owner with a paying customer.",
          tool_key: null,
        },
      ],
    },
  ],
  Customer: [
    {
      title: "Turn Customer Acquisition into a Repeatable System",
      description:
        "You've gotten customers — amazing! But if getting each customer requires your personal time and effort, " +
        "your business can only grow as fast as you can work. " +
        "This mission helps you build a system that brings in customers even when you're not actively selling.",
      steps: [
        {
          title: "Step 1 — Document Your Full Go-To-Market Strategy",
          description:
            "Open the GTM Strategy tool and enter your current business details: how you currently get customers, your pricing, and your target customer. " +
            "This time, ask Bylda to build a strategy a team member could execute. " +
            "The goal is to turn YOUR personal selling skills into a documented process anyone could follow. " +
            "After getting the output, take each major step in the strategy and write: " +
            "'Who does this? How long does it take? What does success look like?' " +
            "This becomes your Sales & Marketing Playbook. Store it in a shared Google Doc your whole team can access.",
          tool_key: "gtm-strategy",
        },
        {
          title: "Step 2 — Build Your Operations Plan",
          description:
            "An operations plan answers the question: 'How does this business actually work every day?' " +
            "Open the Operations Plan tool. Describe your current business in detail — " +
            "how you deliver your product or service, how customers interact with you, how you get paid, and any recurring tasks. " +
            "Bylda will output a plan that shows your key processes, tools to use, team roles, and automation opportunities. " +
            "After reading the plan, identify the 3 tasks that take the most time in your week. " +
            "Those are the first things to automate or delegate. If you can free up even 5 hours per week, you can use that time to get more customers.",
          tool_key: "generate-ops-plan",
        },
        {
          title: "Step 3 — Design Your Referral System",
          description:
            "The cheapest and most powerful way to get new customers is through referrals — happy customers telling their friends. " +
            "Right now, referrals probably happen randomly when a happy customer mentions you. " +
            "Your job is to make referrals happen ON PURPOSE. Here's how: " +
            "(1) After every successful project or sale, send a 3-sentence message: " +
            "'Thanks for working with me. I'm glad I could help with [specific result]. " +
            "If you know anyone else who struggles with [problem], I'd love an introduction.' " +
            "(2) Consider offering a small incentive: 'For every referral that becomes a client, I'll give you [discount/cash/gift].' " +
            "(3) Write this referral message as a template. Send it to your last 5 customers this week. " +
            "Mark complete when you've sent the referral message to at least 3 past customers.",
          tool_key: null,
        },
      ],
    },
  ],
  Systems: [
    {
      title: "Build Your Content and Brand Authority Engine",
      description:
        "Your operations are running. Now it's time to make people come to YOU instead of you always going to them. " +
        "Content marketing and thought leadership put your business in front of thousands of potential customers " +
        "while you sleep. This mission builds that engine.",
      steps: [
        {
          title: "Step 1 — Create a Content Strategy That Attracts Your Ideal Customers",
          description:
            "Open the GTM Strategy tool and ask Bylda to build a CONTENT-focused GTM strategy for your business. " +
            "Tell it: your business type, your target customer, and the platforms where your customers spend time " +
            "(LinkedIn, Instagram, YouTube, TikTok, Twitter/X, industry blogs, etc.). " +
            "Bylda will create a content plan that includes: what topics to cover, what formats to use " +
            "(short videos, long articles, social posts), how often to post, and how to repurpose one piece of content across multiple platforms. " +
            "Pick ONE platform to start. Post consistently for 30 days before adding a second platform.",
          tool_key: "gtm-strategy",
        },
        {
          title: "Step 2 — Build a Partnership Pitch to Accelerate Your Reach",
          description:
            "A partnership is when another business promotes you to their audience — and you do the same for them. " +
            "This is one of the fastest ways to grow because you're borrowing someone else's trust with their customers. " +
            "Open the Pitch Generator tool and select 'Partnership Pitch' as the type. " +
            "Describe your business and the type of business you want to partner with (complementary, not a competitor). " +
            "Bylda will write a professional partnership proposal email you can send. " +
            "After getting the pitch, make a list of 10 businesses that serve your same target customer but don't compete with you. " +
            "Send the partnership pitch to all 10 this week.",
          tool_key: "pitch-generator",
        },
        {
          title: "Step 3 — Write Your First 3 Standard Operating Procedures (SOPs)",
          description:
            "An SOP is a step-by-step instruction guide for one task in your business. " +
            "Think of it as the manual that lets someone else do your job without asking you a hundred questions. " +
            "Identify the 3 tasks YOU do most often that someone else could do if they had instructions. " +
            "For each task, open a Google Doc and write: (1) The name of the task. (2) When to do it and how often. " +
            "(3) Every single step in order, numbered, like a recipe. (4) What 'done correctly' looks like. " +
            "(5) Common mistakes to avoid. " +
            "Keep each SOP under 1 page. Simple is better. " +
            "Once written, give it to someone else to test — if they can do the task correctly without asking you anything, the SOP is ready. " +
            "Store all SOPs in a shared folder labeled 'Business Playbook.'",
          tool_key: null,
        },
      ],
    },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let body: { action: Action; step_id?: string; mission_id?: string; workspace_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { action, step_id, mission_id, workspace_id } = body;
  if (!action) return json({ error: "action is required" }, 400);

  // ── complete_step ──────────────────────────────────────────────────
  if (action === "complete_step") {
    if (!step_id) return json({ error: "step_id required for complete_step" }, 400);

    const { error } = await admin
      .from("mission_steps")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", step_id);
    if (error) return json({ error: error.message }, 500);

    // Resolve organization_id once per request (bylda_events dual-write only).
    // Only when workspace_id is present — not part of the top-level auth flow.
    let ws: { organization_id: string | null } | null = null;
    if (workspace_id) {
      const { data } = await admin
        .from("workspaces")
        .select("organization_id")
        .eq("id", workspace_id)
        .maybeSingle();
      ws = data;
    }

    // Log activation event
    if (workspace_id) {
      await admin.from("activation_events").insert({
        user_id: userId,
        workspace_id,
        event_name: "mission_step_completed",
        properties: { step_id, mission_id },
      });

      // Dual-write to bylda_events (best-effort, non-blocking — a failure here
      // must not affect the step_completed response).
      if (ws?.organization_id) {
        await admin
          .from("bylda_events")
          .insert({
            organization_id: ws.organization_id,
            source: "mission",
            event_type: "step.completed",
            subject_type: "mission_step",
            subject_id: step_id,
            payload: { mission_id, workspace_id },
          })
          .then(
            () => {},
            () => {},
          ); // swallow — mirrors this file's best-effort activation_events calls
      }
    }

    // Check if all steps are done → auto-complete the mission
    if (mission_id) {
      const { data: steps } = await admin
        .from("mission_steps")
        .select("status")
        .eq("mission_id", mission_id);

      const allDone = steps?.every((s) => s.status === "completed" || s.status === "skipped");
      if (allDone) {
        await admin
          .from("missions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", mission_id);

        if (workspace_id) {
          await admin.from("activation_events").insert({
            user_id: userId,
            workspace_id,
            event_name: "first_mission_completed",
            properties: { mission_id },
          });

          // Dual-write to bylda_events (best-effort, non-blocking).
          if (ws?.organization_id) {
            await admin
              .from("bylda_events")
              .insert({
                organization_id: ws.organization_id,
                source: "mission",
                event_type: "mission.completed",
                subject_type: "mission",
                subject_id: mission_id,
                payload: { workspace_id, auto_completed: true },
              })
              .then(
                () => {},
                () => {},
              ); // swallow — mirrors this file's best-effort activation_events calls
          }
        }

        // Founder Course: when a course module completes, the next locked module
        // is unlocked by the `unlock_next_course_module` DB trigger on missions
        // (migration 20260722000001) — DB-enforced, atomic, no logic here.

        return json({ ok: true, step_completed: true, mission_auto_completed: true });
      }
    }

    return json({ ok: true, step_completed: true, mission_auto_completed: false });
  }

  // ── skip_step ─────────────────────────────────────────────────────
  if (action === "skip_step") {
    if (!step_id) return json({ error: "step_id required for skip_step" }, 400);
    const { error } = await admin
      .from("mission_steps")
      .update({ status: "skipped" })
      .eq("id", step_id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── complete_mission ───────────────────────────────────────────────
  if (action === "complete_mission") {
    if (!mission_id || !workspace_id) {
      return json({ error: "mission_id and workspace_id required for complete_mission" }, 400);
    }

    // Mark mission done
    await admin
      .from("missions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", mission_id);

    // Determine workspace lane for next mission
    const { data: ws } = await admin
      .from("workspaces")
      .select("lane, id")
      .eq("id", workspace_id)
      .maybeSingle();

    const lane = (ws?.lane as string) ?? "Idea";
    const nextMissions = NEXT_MISSIONS[lane] ?? NEXT_MISSIONS["Idea"];

    // Find highest sort_order so far
    const { data: existingMissions } = await admin
      .from("missions")
      .select("sort_order")
      .eq("workspace_id", workspace_id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = ((existingMissions?.[0]?.sort_order as number) ?? 0) + 1;

    // nextMissions is 0-indexed; the first next mission is always at index 0.
    // We only have one next mission per lane currently, so we always use index 0.
    const nextMissionIndex = 0;
    let newMissionId: string | null = null;
    if (nextMissions[nextMissionIndex]) {
      const seed = nextMissions[nextMissionIndex];
      const { data: newMission } = await admin
        .from("missions")
        .insert({
          workspace_id,
          title: seed.title,
          description: seed.description,
          lane,
          status: "active",
          sort_order: nextOrder,
        })
        .select("id")
        .single();

      if (newMission) {
        newMissionId = newMission.id as string;
        const stepRows = seed.steps.map((s, i) => ({
          mission_id: newMissionId,
          title: s.title,
          description: s.description,
          tool_key: s.tool_key,
          sort_order: i,
          status: "pending",
        }));
        await admin.from("mission_steps").insert(stepRows);

        // Update workspace current_mission_id
        await admin
          .from("workspaces")
          .update({ current_mission_id: newMissionId })
          .eq("id", workspace_id);

        await admin.from("activation_events").insert([
          {
            user_id: userId,
            workspace_id,
            event_name: "first_mission_completed",
            properties: { mission_id, completed_at: new Date().toISOString() },
          },
          {
            user_id: userId,
            workspace_id,
            event_name: "first_mission_assigned",
            properties: { mission_id: newMissionId, mission_title: seed.title, lane },
          },
        ]);
      }
    }

    return json({ ok: true, mission_completed: true, next_mission_id: newMissionId });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
