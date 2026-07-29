// Tutorial screen-recorder: drives the real app with Playwright while
// recording, so every video shows the actual operation being performed.
// Usage: node record.mjs <tutorialId...> | all
const { chromium } = await import(process.env.PLAYWRIGHT_LIB || "playwright");
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.APP_BASE_URL || "http://127.0.0.1:8080";
const OUT = process.env.OUT_DIR || "/tmp/tut/out";
const RAW = process.env.RAW_DIR || "/tmp/tut/raw";
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FFPROBE = process.env.FFPROBE || "ffprobe";
const USER = {
  email: process.env.TUTORIAL_EMAIL || "tutorial.recorder@bylda-ops.dev",
  pass: process.env.TUTORIAL_PASSWORD,
};
const ONBOARD_USER = {
  email: process.env.ONBOARDING_EMAIL || "tutorial.onboarding@bylda-ops.dev",
  pass: process.env.TUTORIAL_PASSWORD,
};
if (!USER.pass) {
  console.error("Set TUTORIAL_PASSWORD (demo recorder user password)");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

/* ───────────────────────── overlay injected into the page ───────────── */
const OVERLAY_JS = `
(() => {
  if (document.getElementById('tut-cursor')) return;
  const cur = document.createElement('div');
  cur.id = 'tut-cursor';
  cur.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3l14 9-6.6 1.4L9 20z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  Object.assign(cur.style, {position:'fixed',left:'0px',top:'0px',zIndex:2147483647,pointerEvents:'none',filter:'drop-shadow(0 1px 2px rgba(0,0,0,.5))',transition:'none'});
  document.documentElement.appendChild(cur);
  const cap = document.createElement('div');
  cap.id = 'tut-caption';
  Object.assign(cap.style, {position:'fixed',left:'50%',bottom:'26px',transform:'translateX(-50%)',zIndex:2147483646,pointerEvents:'none',background:'rgba(13,16,28,0.88)',color:'#fff',padding:'10px 22px',borderRadius:'999px',font:'600 15px/1.4 Inter,system-ui,sans-serif',letterSpacing:'.01em',boxShadow:'0 4px 18px rgba(0,0,0,.35)',opacity:'0',transition:'opacity .35s ease',maxWidth:'80%',textAlign:'center',whiteSpace:'nowrap'});
  document.documentElement.appendChild(cap);
  if (window.__tutListeners) return; window.__tutListeners = true;
  document.addEventListener('mousemove', e => { const c = document.getElementById('tut-cursor'); if (c) { c.style.left = e.clientX+'px'; c.style.top = e.clientY+'px'; } }, true);
  document.addEventListener('mousedown', e => {
    const r = document.createElement('div');
    Object.assign(r.style, {position:'fixed',left:e.clientX+'px',top:e.clientY+'px',zIndex:2147483645,pointerEvents:'none',width:'10px',height:'10px',marginLeft:'-5px',marginTop:'-5px',borderRadius:'50%',border:'2.5px solid #60A5FA',opacity:'0.9',transform:'scale(1)',transition:'transform .45s ease, opacity .45s ease'});
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(4.5)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 600);
  }, true);
})();`;

/* ───────────────────────── per-page helper kit ───────────────────────── */
function kit(page) {
  const h = {};
  h.ensureOverlay = async () => {
    await page.evaluate(OVERLAY_JS).catch(() => {});
  };
  h.sleep = (ms) => page.waitForTimeout(ms);
  h.goTo = async (path, settle = 2800) => {
    await page.evaluate((p) => {
      history.pushState({}, "", p);
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    }, path);
    await h.sleep(settle);
    await h.ensureOverlay();
  };
  h.cap = async (text, hold = 1400) => {
    await h.ensureOverlay();
    await page.evaluate((t) => {
      const c = document.getElementById("tut-caption");
      if (!c) return;
      c.textContent = t;
      c.style.opacity = t ? "1" : "0";
    }, text);
    if (hold) await h.sleep(hold);
  };
  h.capOff = async () => {
    await page
      .evaluate(() => {
        const c = document.getElementById("tut-caption");
        if (c) c.style.opacity = "0";
      })
      .catch(() => {});
  };
  h.title = async (titleText, sub) => {
    await h.ensureOverlay();
    await page.evaluate(
      ([t, s]) => {
        const d = document.createElement("div");
        d.id = "tut-title";
        Object.assign(d.style, {
          position: "fixed",
          inset: "0",
          zIndex: 2147483647,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(9,11,22,0.82)",
          backdropFilter: "blur(5px)",
          opacity: "0",
          transition: "opacity .35s ease",
          fontFamily: "Inter,system-ui,sans-serif",
          textAlign: "center",
          padding: "0 60px",
        });
        d.innerHTML = `<div style="color:#60A5FA;font:700 12px/1 Inter;letter-spacing:.32em;margin-bottom:18px">BYLDA TUTORIAL</div>
          <div style="color:#fff;font:700 34px/1.25 Inter;max-width:820px">${t}</div>
          ${s ? `<div style="color:#A5B4CC;font:500 16px/1.5 Inter;margin-top:14px;max-width:680px">${s}</div>` : ""}`;
        document.documentElement.appendChild(d);
        requestAnimationFrame(() => (d.style.opacity = "1"));
      },
      [titleText, sub || ""],
    );
    await h.sleep(2300);
    await page.evaluate(() => {
      const d = document.getElementById("tut-title");
      if (d) {
        d.style.opacity = "0";
        setTimeout(() => d.remove(), 450);
      }
    });
    await h.sleep(550);
  };
  h.move = async (loc, opts = {}) => {
    const el = typeof loc === "string" ? page.locator(loc).first() : loc.first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const box = await el.boundingBox();
    if (!box) throw new Error("no box for locator");
    const x = box.x + box.width * (opts.fx ?? 0.5);
    const y = box.y + box.height * (opts.fy ?? 0.5);
    await page.mouse.move(x, y, { steps: opts.steps ?? 26 });
    await h.sleep(opts.pause ?? 380);
    return { x, y };
  };
  h.click = async (loc, opts = {}) => {
    const { x, y } = await h.move(loc, opts);
    await page.mouse.down();
    await h.sleep(90);
    await page.mouse.up();
    await h.sleep(opts.after ?? 900);
    return { x, y };
  };
  h.type = async (loc, text, opts = {}) => {
    await h.click(loc, { after: 250 });
    const el = typeof loc === "string" ? page.locator(loc).first() : loc.first();
    if (opts.clear) await el.fill("");
    await el.pressSequentially(text, { delay: opts.delay ?? 38 });
    await h.sleep(opts.after ?? 450);
  };
  h.drag = async (fromLoc, toLoc, opts = {}) => {
    const fromEl = typeof fromLoc === "string" ? page.locator(fromLoc).first() : fromLoc.first();
    const toEl = typeof toLoc === "string" ? page.locator(toLoc).first() : toLoc.first();
    // caller is responsible for having both source and target visible
    const fb = await fromEl.boundingBox();
    const tb = await toEl.boundingBox();
    if (!fb || !tb) throw new Error("drag: missing boxes");
    if (process.env.DRAG_DEBUG)
      console.log("  drag from", JSON.stringify(fb), "to", JSON.stringify(tb));
    const point = (b) => [
      b.x + b.width * (opts.fx ?? 0.5) + (opts.dx ?? 0),
      b.y + Math.min(b.height * (opts.fy ?? 0.3), 140),
    ];
    const [tx, ty] = point(tb);
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2, { steps: 24 });
    await h.sleep(500);
    await page.mouse.down();
    await h.sleep(250);
    // small initial movement to satisfy dnd-kit activation distance
    await page.mouse.move(fb.x + fb.width / 2 + 12, fb.y + fb.height / 2 + 8, { steps: 4 });
    await h.sleep(200);
    await page.mouse.move(tx, ty, { steps: 30 });
    await h.sleep(700);
    // re-resolve the target right before release in case anything scrolled,
    // then release immediately so no further drift can accumulate
    const tb2 = (await toEl.boundingBox().catch(() => null)) || tb;
    if (process.env.DRAG_DEBUG) console.log("  drop target now", JSON.stringify(tb2));
    const [ax, ay] = point(tb2);
    await page.mouse.move(ax, ay, { steps: 5 });
    await h.sleep(80);
    await page.mouse.up();
    await h.sleep(opts.after ?? 1100);
  };
  h.hoverPath = async (locs, pause = 900) => {
    for (const l of locs) {
      try {
        await h.move(l, { pause });
      } catch {}
    }
  };
  h.scrollMain = async (dy, ms = 900) => {
    await page.mouse.wheel(0, dy);
    await h.sleep(ms);
  };
  h.btn = (text) => page.locator(`button:has-text("${text}")`).first();
  h.link = (text) => page.locator(`a:has-text("${text}")`).first();
  h.ph = (placeholder) => page.locator(`[placeholder="${placeholder}"]`).first();
  h.card = (text) => page.locator(`[role="button"]:has-text("${text}")`).last();
  h.visBlock = async (text) => {
    const l = page.locator(`[role="button"]:has-text("${text}")`);
    const n = await l.count();
    for (let i = 0; i < n; i++) if (await l.nth(i).isVisible()) return l.nth(i);
    throw new Error(`no visible block: ${text}`);
  };
  h.marks = {};
  h.mark = (name) => {
    h.marks[name] = Date.now();
  };
  h.waitForOutput = async (maxMs = 110000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      await page.waitForTimeout(2500);
      const st = await page.evaluate(() => {
        const txt = document.body.innerText;
        return {
          busy: /generating|drafting|thinking|writing/i.test(txt),
          empty: txt.includes("No output yet"),
        };
      });
      if (!st.busy && !st.empty) return true;
    }
    return false;
  };
  return h;
}

/* ───────────────────────── auth bootstrap ────────────────────────────── */
async function signIn(ctx, user) {
  const p = await ctx.newPage();
  await p.goto(BASE + "/auth/sign-in", { waitUntil: "networkidle", timeout: 60000 });
  if (!/\/(app|onboarding)/.test(p.url())) {
    await p.fill('input[type="email"]', user.email);
    await p.fill('input[type="password"]', user.pass);
    await p.click('button[type="submit"]');
    await p.waitForURL(/\/(app|onboarding)/, { timeout: 30000 });
  }
  await p.waitForTimeout(2500);
  const v = p.video();
  await p.close();
  if (v) {
    try {
      fs.rmSync(await v.path());
    } catch {}
  }
}

/* ───────────────────────── scenarios ─────────────────────────────────── */
// Each scenario: { path, title, sub, run(page, h), user? }
const S = {};

S.welcome = {
  path: "/app/dashboard",
  title: "Welcome to Bylda — Platform Overview",
  sub: "A quick tour of your AI operating system",
  async run(page, h) {
    await h.cap("This is Home — your daily command center", 2000);
    await h.hoverPath([page.locator("h1").first(), h.link("View pipeline")], 1100);
    await h.cap("Build — tools, automations and the visual builder", 600);
    await h.click(h.link("Build"), { after: 2400 });
    await h.cap("Launch — take your product to market", 600);
    await h.click(h.link("Launch"), { after: 2400 });
    await h.cap("Grow — pipeline, campaigns and customers", 600);
    await h.click(h.link("Grow"), { after: 2400 });
    await h.cap("Ask Bylda anything, any time", 600);
    await h.click(h.link("Ask Bylda"), { after: 2400 });
    await h.cap("Back home — let's build something", 600);
    await h.click(h.link("Home"), { after: 2200 });
    await h.cap("You're ready. Pick a tutorial and dive in.", 1800);
  },
};

S["account-setup"] = {
  path: "/app/settings",
  title: "Setting Up Your Account",
  sub: "Profile, organization and first-time configuration",
  async run(page, h) {
    await h.cap("Start in Settings — complete your profile", 1500);
    await h.type(page.locator('input:below(:text("Full name"))').first(), "Alex Carter", {
      clear: true,
    });
    await h.cap("Save your profile", 500);
    await h.click(h.btn("Save profile"), { after: 1500 });
    await h.cap("Add your business context for better AI output", 700);
    await h.click(h.btn("Business Context"), { after: 1800 });
    await h.scrollMain(250);
    await h.cap("Set up your organization", 600);
    await h.click(h.btn("Organization"), { after: 1800 });
    await h.type(page.locator('input:below(:text("Business name"))').first(), "Bylda Demo Co", {
      clear: true,
    });
    await h.click(h.btn("Save organization"), { after: 1600 });
    await h.cap("Done — your account is configured", 1800);
  },
};

S["dashboard-tour"] = {
  path: "/app/dashboard",
  title: "Navigating the Dashboard",
  sub: "Command center, sidebar and key metrics",
  async run(page, h) {
    await h.cap("Your dashboard greets you with today's focus", 1700);
    await h.move(page.locator("h1").first(), { pause: 900 });
    await h.cap("The sidebar is your map — five destinations", 900);
    await h.hoverPath(
      [h.link("Home"), h.link("Build"), h.link("Launch"), h.link("Grow"), h.link("Ask Bylda")],
      650,
    );
    await h.cap("Search anything with ⌘K", 700);
    await h.move(h.btn("Search anything"), { pause: 900 });
    await h.cap("Live metrics — contacts and tool runs", 800);
    await h.hoverPath([h.link("CONTACTS"), h.link("TOOLS RUN")], 1000);
    await h.cap("Your guided next steps live here", 800);
    await h.scrollMain(350);
    await h.hoverPath([h.link("Tell Bylda about your business")], 1100);
    await h.scrollMain(-350, 700);
    await h.cap("That's the dashboard — everything one click away", 1800);
  },
};

S["onboarding-wizard"] = {
  path: "/onboarding",
  title: "Completing Your Onboarding",
  sub: "Personalize Bylda for your business",
  user: ONBOARD_USER,
  async run(page, h) {
    await h.cap("Pick what you're here to do", 1600);
    await h.click(page.locator('button:has-text("Operate a business")'), { after: 2500 });
    await h.cap("Bylda interviews you about your business", 1500);
    const answers = [
      "Bright Brew Coffee",
      "Specialty coffee subscriptions for remote-first teams — monthly tasting boxes.",
      "Leads come from our website and partner referrals; fulfillment runs on Shopify.",
    ];
    let ai = 0;
    for (let turn = 0; turn < 4; turn++) {
      await h.sleep(900);
      const input = page.locator("textarea:visible, input:visible").last();
      const hasInput = await input.isVisible().catch(() => false);
      if (hasInput && ai < answers.length) {
        await h.type(input, answers[ai++], { delay: 24 });
        await page.keyboard.press("Enter");
      } else {
        // question presented as option cards instead of free text
        const card = page
          .locator('button:has-text("E-commerce"), button:has-text("SaaS / software")')
          .first();
        if (!(await card.isVisible().catch(() => false))) break;
        await h.cap("Or just pick from Bylda's suggestions", 600);
        await h.click(card, { after: 1500 });
      }
      // wait for Bylda's next question to land
      for (let i = 0; i < 10; i++) {
        const en = await page
          .locator("textarea:visible, input:visible, button:has-text('E-commerce')")
          .last()
          .isVisible()
          .catch(() => false);
        if (en) break;
        await h.sleep(1500);
      }
      await h.sleep(800);
    }
    await h.cap("Each answer tunes your dashboards and AI tools", 2000);
    await h.cap("A few minutes of questions — a fully personal OS", 2200);
  },
};

S["crm-intro"] = {
  path: "/app/bylda/crm",
  title: "CRM Overview: Contacts, Deals & Pipeline",
  sub: "Create a deal and manage your pipeline",
  async run(page, h) {
    await h.cap("This is your pipeline — every deal at a glance", 1800);
    await h.hoverPath([h.btn("Kanban"), h.btn("Table")], 700);
    await h.cap("Let's create a deal", 700);
    await h.click(h.btn("New Deal"), { after: 1400 });
    await h.type(h.ph("Acme Corp — Enterprise"), "Acme Corp — Pilot");
    await h.type(h.ph("Acme Corp"), "Acme Corp");
    await h.type(h.ph("contact@example.com"), "dana@acme.com");
    await h.type(page.locator('input[type="number"]').first(), "7500");
    await h.cap("Pick a starting stage", 500);
    await h.click(
      page
        .locator('[role="dialog"] button:has-text("Contacted"), button:has-text("Contacted")')
        .last(),
      { after: 700 },
    );
    await h.cap("Tag it for easy filtering", 500);
    await h.click(h.btn("+ saas"), { after: 700 });
    await h.click(h.btn("Create Deal"), { after: 1800 });
    await h.cap("Done — the deal is live in your pipeline", 1400);
    try {
      await h.move(h.card("Acme Corp"), { pause: 1300 });
    } catch {}
  },
};

S["kanban-dnd"] = {
  path: "/app/bylda/crm",
  title: "Drag & Drop Kanban Board",
  sub: "Move deals between stages",
  async run(page, h) {
    await h.cap("Each column is a pipeline stage", 1700);
    await h.cap("Drag a deal to move it forward", 800);
    const col = (stage) =>
      page.locator(`div[class*="w-[264px]"]:has(span:text-is("${stage}"))`).first();
    // center the target column so dnd-kit's edge auto-scroll never kicks in
    const center = async (stage) => {
      await page.evaluate((s) => {
        const span = [...document.querySelectorAll("span")].find(
          (el) => el.textContent === s && el.closest('div[class*="w-[264px]"]'),
        );
        span
          ?.closest('div[class*="w-[264px]"]')
          ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      }, stage);
      await h.sleep(900);
    };
    // dx compensates the app's stale droppable rects (offset by one column)
    await center("Qualified");
    await h.drag(h.card("Priya Raman"), col("Qualified"), { dx: -276, after: 1600 });
    await h.cap("Stage updated — no forms, no clicks", 1300);
    await h.cap("Drag again to keep your pipeline honest", 700);
    await center("Proposal");
    await h.drag(h.card("Tom Becker"), col("Proposal"), { dx: -276, after: 1600 });
    await h.cap("That's it — pipeline management at speed", 1600);
  },
};

S["tags-scoring"] = {
  path: "/app/bylda/crm",
  title: "Tags, Lead Scoring & Priority",
  sub: "Organize deals for better focus",
  async run(page, h) {
    await h.cap("Open a deal to set tags, score and priority", 1500);
    await h.click(h.card("Priya Raman"), { after: 1600 });
    await h.cap("Open the full editor", 600);
    await h.click(h.btn("Edit Deal"), { after: 1500 });
    await h.cap("Lead score — how hot is this deal?", 800);
    const slider = page.locator('input[type="range"]:visible').last();
    const box = await slider.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.74, box.y + box.height / 2, { steps: 20 });
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.88, box.y + box.height / 2, { steps: 16 });
      await page.mouse.up();
      await h.sleep(800);
    }
    await h.cap("Set the priority", 600);
    await h.click(page.locator('button:has-text("High")').last(), { after: 800 });
    await h.cap("Add a tag", 600);
    await h.click(h.btn("+ enterprise"), { after: 800 });
    await h.click(page.locator('button:has-text("Save Changes")').first(), { after: 1800 });
    await h.cap("Saved — tags and score now drive your focus", 1800);
  },
};

S["pipeline-views"] = {
  path: "/app/bylda/crm",
  title: "Pipeline Views: Kanban, Table, List & Forecast",
  sub: "Four ways to see your deals",
  async run(page, h) {
    await h.cap("Kanban — drag deals through stages", 1700);
    await h.cap("Table — sort and scan every field", 700);
    await h.click(h.btn("Table"), { after: 2200 });
    await h.cap("List — compact view for fast triage", 700);
    await h.click(h.btn("List"), { after: 2200 });
    await h.cap("Forecast — weighted revenue by stage", 700);
    await h.click(h.btn("Forecast"), { after: 2400 });
    await h.scrollMain(280);
    await h.scrollMain(-280, 700);
    await h.cap("Back to Kanban — pick the view that fits the job", 700);
    await h.click(h.btn("Kanban"), { after: 1800 });
    await h.cap("Same deals, four angles", 1500);
  },
};

S["bulk-actions"] = {
  path: "/app/bylda/crm",
  title: "Bulk Actions & Team Operations",
  sub: "Update many deals at once",
  async run(page, h) {
    await h.click(h.btn("Table"), { after: 2000 });
    await h.cap("Select several deals in Table view", 1200);
    const boxes = page.locator("table tbody tr td:first-child button");
    for (let i = 0; i < Math.min(await boxes.count(), 3); i++)
      await h.click(boxes.nth(i), { after: 600 });
    await h.cap("A bulk bar appears — act on all of them", 1400);
    await h.click(h.btn("Move to Stage"), { after: 1100 });
    await h.click(page.locator('div[class*="z-50"] button:has-text("Qualified")').first(), {
      after: 1800,
    });
    await h.cap("Three deals updated in one click", 1800);
  },
};

S["activity-timeline"] = {
  path: "/app/bylda/crm",
  title: "Activity Timeline & Deal History",
  sub: "Log calls, notes and meetings on a deal",
  async run(page, h) {
    await h.cap("Open a deal to see its full history", 1400);
    await h.click(h.card("Emma Larsson"), { after: 1800 });
    await h.cap("The Activity tab is the deal's timeline", 800);
    await h.click(h.btn("Activity"), { after: 2000 });
    await h.cap("Every stage change and note is recorded here", 1800);
    await h.click(h.btn("Overview"), { after: 1500 });
    await h.cap("Add a note so the team has context", 900);
    await h.type(
      h.ph("Add notes about this deal…"),
      "Discovery call done — send proposal by Friday.",
      { delay: 30 },
    );
    await h.click(h.btn("Save Notes"), { after: 1800 });
    await h.cap("Saved — the deal history stays complete", 1700);
  },
};

S["forecast-view"] = {
  path: "/app/bylda/crm",
  title: "Revenue Forecasting & Pipeline Analytics",
  sub: "Weighted pipeline value, by stage",
  async run(page, h) {
    await h.cap("Switch to the Forecast view", 1100);
    await h.click(h.btn("Forecast"), { after: 2400 });
    await h.cap("Each stage is weighted by win probability", 1600);
    await h.scrollMain(220);
    await h.cap("Weighted value = realistic revenue outlook", 1500);
    await h.scrollMain(260);
    await h.scrollMain(-480, 800);
    await h.cap("Use it weekly to predict the quarter", 1800);
  },
};

S["crm-settings"] = {
  path: "/app/bylda/crm",
  title: "CRM Display Settings & Custom Views",
  sub: "Choose what your pipeline shows",
  async run(page, h) {
    await h.cap("Open Display settings", 1100);
    await h.click(h.btn("Display"), { after: 1500 });
    await h.cap("Toggle the fields your cards display", 1100);
    const toggles = page.locator(
      '[role="dialog"] [role="switch"], [role="switch"], [data-state][role="checkbox"]',
    );
    const n = Math.min(await toggles.count(), 3);
    for (let i = 0; i < n; i++) await h.click(toggles.nth(i), { after: 700 });
    await h.cap("Changes apply instantly", 1100);
    for (let i = 0; i < n; i++) await h.click(toggles.nth(i), { after: 400 });
    await page.keyboard.press("Escape");
    await h.sleep(900);
    await h.cap("Your pipeline, your layout", 1600);
  },
};

S["workflow-builder"] = {
  path: "/app/builder",
  title: "Building Your First Automation Workflow",
  sub: "Trigger + action, in the visual builder",
  async run(page, h) {
    await h.cap("This is the visual workflow builder", 1700);
    await h.cap("Step 1 — drag a trigger onto the canvas", 900);
    await h.drag(await h.visBlock("New Lead"), page.locator('text="Drag a block here to start"'), {
      fy: 0.5,
      after: 1600,
    });
    await h.cap("Step 2 — add an action", 900);
    await h.click(h.btn("Actions"), { after: 1200 });
    await h.drag(await h.visBlock("Send Email"), page.locator('text="Add next step"'), {
      fy: 0.5,
      after: 1600,
    });
    await h.cap("Trigger + action — that's a working automation", 1300);
    await h.cap("Save it — the automation is ready", 700);
    await h.click(h.btn("Save"), { after: 2200 });
    await h.cap("Done — your first workflow is built", 1800);
  },
};

S["trigger-types"] = {
  path: "/app/builder",
  title: "Trigger Types: Forms, Stage Changes & More",
  sub: "Every way an automation can start",
  async run(page, h) {
    await h.cap("Triggers decide when a workflow runs", 1600);
    await h.move(await h.visBlock("New Lead"), { pause: 1000 });
    await h.cap("New Lead — fires when a lead hits your CRM", 1300);
    await h.move(await h.visBlock("Form Submitted"), { pause: 900 });
    await h.cap("Form Submitted — capture from any form", 1300);
    await h.move(await h.visBlock("Scheduled Time"), { pause: 900 });
    await h.cap("Scheduled — run daily, weekly, any cadence", 1300);
    await h.move(await h.visBlock("Webhook"), { pause: 900 });
    await h.cap("Webhook — react to any outside app", 1300);
    await h.move(await h.visBlock("Payment Received"), { pause: 900 });
    await h.cap("Payment Received — act the moment money lands", 1300);
    await h.cap("Let's use Form Submitted", 700);
    await h.drag(
      await h.visBlock("Form Submitted"),
      page.locator('text="Drag a block here to start"'),
      { fy: 0.5, after: 1800 },
    );
    await h.cap("Trigger placed — now add your actions", 1700);
  },
};

S["multi-step"] = {
  path: "/app/builder",
  title: "Multi-Step Automation Sequences",
  sub: "Branching and delays in one flow",
  async run(page, h) {
    await h.cap("Start with a trigger", 1200);
    await h.drag(await h.visBlock("New Lead"), page.locator('text="Drag a block here to start"'), {
      fy: 0.5,
      after: 1500,
    });
    await h.cap("Add logic — branch on conditions", 800);
    await h.click(h.btn("Logic"), { after: 1200 });
    await h.drag(await h.visBlock("If / Else"), page.locator('text="Add next step"'), {
      fy: 0.5,
      after: 1500,
    });
    await h.cap("Add a delay between steps", 700);
    await h.drag(await h.visBlock("Wait"), page.locator('text="Add next step"'), {
      fy: 0.5,
      after: 1500,
    });
    await h.cap("Then add the action", 800);
    await h.click(h.btn("Actions"), { after: 1200 });
    await h.drag(await h.visBlock("Send Email"), page.locator('text="Add next step"'), {
      fy: 0.5,
      after: 1600,
    });
    await h.cap("A real multi-step sequence — branch, wait, act", 1300);
    await h.click(h.btn("Save"), { after: 2200 });
    await h.cap("Saved — branching, delays and actions in one flow", 1800);
  },
};

S.integrations = {
  path: "/app/integrations",
  title: "Connecting Third-Party Integrations",
  sub: "Plug your stack into Bylda",
  async run(page, h) {
    await h.cap("Browse the integration catalog", 1500);
    await h.click(h.btn("Communication"), { after: 1500 });
    await h.cap("Let's connect Slack", 800);
    const slackCard = page
      .locator('div:has(h3:text-is("Slack")):has(button:has-text("Connect"))')
      .last();
    await h.click(slackCard.locator('button:has-text("Connect")').first(), { after: 1500 });
    await h.cap("Paste your Slack webhook URL", 700);
    const dlg = page.locator('[role="dialog"]');
    await h.type(
      dlg.locator("input").first(),
      "https://hooks.slack.com/services/T0DEMO/B0DEMO/bylda",
      { delay: 18 },
    );
    await h.click(dlg.locator('button:has-text("Connect")').first(), { after: 2200 });
    await h.cap("Connected — Bylda can now use this tool", 1800);
  },
};

S.campaigns = {
  path: "/app/scale/campaigns",
  title: "Creating Your First Campaign",
  sub: "Generate a real campaign asset with Bylda",
  async run(page, h) {
    await h.cap("Campaigns collects all your marketing assets", 1700);
    await h.cap("Create your first asset — a landing page", 900);
    await h.click(h.link("Landing Page"), { after: 3200 });
    await h.cap("Brief Bylda on the campaign", 1000);
    await h.type(h.ph("e.g. Northwind Labs — initial launch"), "Bright Brew launch", { delay: 26 });
    await h.type(
      page.locator("textarea:visible").first(),
      "Specialty coffee subscriptions that make remote teams feel connected.",
      { delay: 18 },
    );
    await h.type(
      h.ph("e.g. B2B founders, solo consultants, DTC brands"),
      "Office managers at remote startups",
      { delay: 24 },
    );
    await h.type(
      h.ph("e.g. Cut churn by 30% without a single sales call"),
      "Boost remote team morale fast",
      { delay: 24 },
    );
    await h.cap("Run the tool — Bylda drafts the page for real", 800);
    await h.click(h.btn("Generate with AI"), { after: 1500 });
    await h.cap("Generating — fast-forward ≈1 minute", 500);
    h.mark("ffStart");
    await h.waitForOutput();
    h.mark("ffEnd");
    await h.cap("Done — real landing page copy, ready to ship", 1600);
    await h.scrollMain(300);
    await h.scrollMain(-300, 700);
    await h.cap("Every asset lands back in Campaigns", 800);
    await h.goTo("/app/scale/campaigns");
    await h.cap("Your first campaign asset is live", 2000);
  },
};

S["leads-capture"] = {
  path: "/app/contacts",
  title: "Lead Capture & Qualification",
  sub: "Capture a lead and qualify it",
  async run(page, h) {
    await h.cap("All your leads live in Contacts", 1500);
    await h.cap("Capture a new lead", 700);
    await h.click(h.btn("Add Contact"), { after: 1400 });
    await h.type(h.ph("Jane"), "Maya");
    await h.type(h.ph("Doe"), "Chen");
    await h.type(h.ph("jane@example.com"), "maya@loopworks.io");
    await h.type(page.locator('[placeholder="Acme Corp"]:visible').first(), "Loopworks");
    await h.type(h.ph("LinkedIn, referral, ad…"), "Website form");
    const save = page.locator('button:has-text("Add Contact"), button:has-text("Save")').last();
    await h.click(save, { after: 2000 });
    await h.cap("Lead captured — now qualify it", 1400);
    await h.click(page.locator('text="Maya Chen"').first(), { after: 1500 }).catch(() => {});
    await h.cap("Move leads through Contacted → Qualified → Engaged", 1500);
    await h.hoverPath([h.btn("Contacted"), h.btn("Qualified"), h.btn("Engaged")], 800);
    await h.cap("Qualified leads feed straight into your pipeline", 1800);
  },
};

S["email-sequences"] = {
  path: "/app/launchpad/email-sequence",
  title: "Email Sequences & Drip Campaigns",
  sub: "A real multi-email nurture sequence, drafted by Bylda",
  async run(page, h) {
    await h.cap("The Email Sequence Writer builds full drip campaigns", 1700);
    await h.type(page.locator('input:below(:text("Business name"))').first(), "Bright Brew", {
      delay: 28,
    });
    await h.type(
      page.locator('input:below(:text("Product"))').first(),
      "Specialty coffee subscriptions for remote teams",
      { delay: 18 },
    );
    await h.cap("Pick the sequence type — we'll nurture leads", 700);
    const sel = page.locator("select:visible").first();
    await h.move(sel, { pause: 400 });
    await sel.selectOption({ label: "Nurture" }).catch(() => sel.selectOption({ index: 1 }));
    await h.sleep(700);
    await h.type(
      page.locator("textarea:visible").first(),
      "Turning trial users into paying subscribers with helpful coffee-culture tips.",
      { delay: 16 },
    );
    await h.type(
      page.locator('input:below(:text("Audience"))').first(),
      "Trial users who haven't upgraded yet",
      { delay: 20 },
    );
    await h.cap("Run it — Bylda writes every email in the drip", 800);
    await h.click(h.btn("Generate with AI"), { after: 1500 });
    await h.cap("Generating — fast-forward ≈1 minute", 500);
    h.mark("ffStart");
    await h.waitForOutput();
    h.mark("ffEnd");
    await h.cap("A complete nurture sequence, spaced over days", 1700);
    await h.scrollMain(350);
    await h.scrollMain(-350, 700);
    await h.cap("Drip campaigns that nurture leads on autopilot", 1900);
  },
};

S["reports-overview"] = {
  path: "/app/bylda/reports",
  title: "Reports Overview",
  sub: "Pipeline, activity and revenue at a glance",
  async run(page, h) {
    await h.cap("Reporting — your weekly source of truth", 1700);
    await h.cap("Activity — what ran, what changed", 800);
    await h.click(h.btn("Activity"), { after: 2200 });
    await h.scrollMain(220);
    await h.cap("ROI Analytics — what it's all worth", 800);
    await h.click(h.btn("ROI Analytics"), { after: 2200 });
    await h.scrollMain(220);
    await h.scrollMain(-440, 700);
    await h.cap("Generate a weekly review with one click", 900);
    await h.move(h.btn("Generate this week's review"), { pause: 1400 });
    await h.cap("Read it Monday, act all week", 1700);
  },
};

S["ai-dashboard"] = {
  path: "/app/ai-dashboard",
  title: "AI Dashboard & Intelligence Metrics",
  sub: "A dashboard generated for your business",
  async run(page, h) {
    await h.cap("Describe your business — Bylda builds the dashboard", 1600);
    await h.type(
      page.locator("textarea:visible").first(),
      "B2B SaaS that automates lead follow-up for coffee subscription brands",
      { delay: 22 },
    );
    await h.type(h.ph("e.g. PropTech, Health"), "Food & Beverage SaaS", { delay: 26 });
    await h.type(h.ph("e.g. Get 10 paying customers, hit $5k MRR"), "Hit $5k MRR by September", {
      delay: 26,
    });
    await h.cap("One click — Bylda assembles your metrics", 900);
    await h.click(h.btn("Generate My Dashboard"), { after: 1500 });
    await h.cap("Generating — fast-forward ≈1 minute", 500);
    h.mark("ffStart");
    await h.waitForOutput();
    h.mark("ffEnd");
    await h.cap("A live dashboard, built for your business", 1800);
    await h.scrollMain(320);
    await h.scrollMain(-320, 700);
    await h.cap("Track usage, performance and cost in one place", 1900);
  },
};

S["admin-analytics"] = {
  path: "/app/admin",
  title: "Admin Hub: Platform-Wide Analytics",
  sub: "Every event, user and metric in one place",
  async run(page, h) {
    await h.cap("The Admin Hub sees everything", 1600);
    await h.cap("Analytics — platform-wide trends", 700);
    await h.click(h.btn("Analytics"), { after: 2300 });
    await h.scrollMain(240);
    await h.cap("Users — every account, every role", 700);
    await h.click(h.btn("Users"), { after: 2300 });
    await h.cap("Tool Runs — every AI action, audited", 700);
    await h.click(h.btn("Tool Runs"), { after: 2300 });
    await h.cap("Subscriptions — revenue at a glance", 700);
    await h.click(h.btn("Subscriptions"), { after: 2300 });
    await h.cap("Total operational visibility", 1700);
  },
};

S.billing = {
  path: "/app/billing",
  title: "Billing & Subscription Management",
  sub: "Plans, invoices and upgrades",
  async run(page, h) {
    await h.cap("Your plan and usage, in one place", 1700);
    await h.move(h.btn("Current plan"), { pause: 1100 });
    await h.scrollMain(260);
    await h.cap("Compare plans side by side", 1300);
    await h.cap("Upgrading takes two clicks", 700);
    await h.click(h.btn("Upgrade to launch"), { after: 2400 });
    await h.cap("Checkout happens right here — no redirects", 1600);
    await page.keyboard.press("Escape");
    await h.sleep(1200);
    await h.cap("Cancel or switch plans any time", 1700);
  },
};

S["team-management"] = {
  path: "/app/admin",
  title: "Team Management & Permissions",
  sub: "Users, roles and access control",
  async run(page, h) {
    await h.cap("Manage your team from the Admin Hub", 1500);
    await h.click(h.btn("Users"), { after: 2300 });
    await h.cap("Every member, with their role and activity", 1500);
    await h.scrollMain(220);
    await h.scrollMain(-220, 700);
    await h.cap("Workspaces — control access per workspace", 800);
    await h.click(h.btn("Workspaces"), { after: 2300 });
    await h.cap("Org-wide defaults live in Settings", 800);
    await h.goTo("/app/settings");
    await h.click(h.btn("Organization"), { after: 1800 });
    await h.cap("Set the business profile your whole team shares", 1800);
  },
};

S["bylda-memory"] = {
  path: "/app/memory",
  title: "Bylda Memory & Personalization",
  sub: "Teach Bylda your business context",
  async run(page, h) {
    await h.cap("Bylda Memory — your AI-queryable knowledge base", 1700);
    await h.cap("Log a win so Bylda learns what works", 800);
    await h.click(h.btn("Log a win"), { after: 1400 });
    await h.type(h.ph("e.g. Closed first $5K deal"), "Closed first $5K enterprise deal", {
      delay: 28,
    });
    await h.type(
      page.locator("textarea:visible").first(),
      "Demo-first outreach to ops managers — repeatable.",
      { delay: 24 },
    );
    await h.type(h.ph("e.g. $5K MRR, 1 new enterprise logo"), "$5K MRR, 1 enterprise logo", {
      delay: 28,
    });
    await h.click(h.btn("Save to memory"), { after: 2000 });
    await h.cap("Saved — every AI output now uses this context", 1500);
    await h.cap("Sources and artifacts make memory searchable", 800);
    await h.click(h.btn("Sources"), { after: 2000 });
    await h.click(h.btn("Ask AI"), { after: 2000 });
    await h.cap("Ask questions — Bylda answers from your memory", 1800);
  },
};

/* ───────────────────────── runner ────────────────────────────────────── */
function ffprobeDuration(file) {
  const out = execFileSync(FFPROBE, [
    "-v",
    "quiet",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ])
    .toString()
    .trim();
  return parseFloat(out);
}

async function recordOne(ctx, id, scenario) {
  const t0 = Date.now();
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  let webm;
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const h = kit(page);
    await h.goTo(scenario.path, 3200);
    // park the mouse somewhere sensible & show overlay before marking start
    await page.mouse.move(640, 400, { steps: 5 });
    await h.ensureOverlay();
    await page.waitForTimeout(400);
    const tStart = Date.now();
    await h.title(scenario.title, scenario.sub);
    await scenario.run(page, h);
    await h.capOff();
    await page.waitForTimeout(1200);
    const video = page.video();
    await page.close();
    webm = await video.path();
    const offset = Math.max((tStart - t0) / 1000 - 0.25, 0);
    const mp4 = `${OUT}/${id}.mp4`;
    const jpg = `${OUT}/${id}.jpg`;
    const enc = [
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-r",
      "25",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
    ];
    if (h.marks.ffStart && h.marks.ffEnd) {
      // speed up the generation wait so the video shows the real output
      const A = ((h.marks.ffStart - t0) / 1000 - offset).toFixed(2);
      const B = ((h.marks.ffEnd - t0) / 1000 - offset).toFixed(2);
      const fc = `[0:v]split=3[s0][s1][s2];[s0]trim=end=${A},setpts=PTS-STARTPTS[v0];[s1]trim=start=${A}:end=${B},setpts=(PTS-STARTPTS)/14[v1];[s2]trim=start=${B},setpts=PTS-STARTPTS[v2];[v0][v1][v2]concat=n=3:v=1:a=0[v]`;
      execFileSync(
        FFMPEG,
        [
          "-y",
          "-ss",
          offset.toFixed(2),
          "-i",
          webm,
          "-filter_complex",
          fc,
          "-map",
          "[v]",
          ...enc,
          mp4,
        ],
        { stdio: "pipe" },
      );
    } else {
      execFileSync(FFMPEG, ["-y", "-ss", offset.toFixed(2), "-i", webm, ...enc, mp4], {
        stdio: "pipe",
      });
    }
    execFileSync(FFMPEG, ["-y", "-ss", "3.2", "-i", mp4, "-frames:v", "1", "-q:v", "3", jpg], {
      stdio: "pipe",
    });
    const dur = ffprobeDuration(mp4);
    fs.rmSync(webm, { force: true });
    console.log(`✔ ${id}: ${dur.toFixed(1)}s → ${mp4}`);
    return { id, ok: true, duration: Math.round(dur) };
  } catch (e) {
    try {
      await page.close();
    } catch {}
    console.log(`✘ ${id}: ${e.message.split("\n")[0]}`);
    return { id, ok: false, error: e.message.split("\n")[0] };
  }
}

const ids = process.argv.slice(2).flatMap((a) => (a === "all" ? Object.keys(S) : [a]));
if (!ids.length) {
  console.log("usage: node record.mjs <id...>|all");
  process.exit(1);
}

const browser = await chromium.launch();
const results = [];

// main signed-in context (recorder user)
const mainIds = ids.filter((i) => !S[i].user);
if (mainIds.length) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("bylda-rail-open", "0");
    } catch {}
  });
  await ctx.addInitScript(OVERLAY_JS);
  await signIn(ctx, USER);
  for (const id of mainIds) results.push(await recordOne(ctx, id, S[id]));
  await ctx.close();
}
// special-user scenarios (fresh context each)
for (const id of ids.filter((i) => S[i].user)) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("bylda-rail-open", "0");
    } catch {}
  });
  await ctx.addInitScript(OVERLAY_JS);
  await signIn(ctx, S[id].user);
  results.push(await recordOne(ctx, id, S[id]));
  await ctx.close();
}
await browser.close();

const manifestPath = `${OUT}/manifest.json`;
const prev = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
for (const r of results) prev[r.id] = r;
fs.writeFileSync(manifestPath, JSON.stringify(prev, null, 2));
console.log("\nRESULTS:", JSON.stringify(results));
