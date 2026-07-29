-- ════════════════════════════════════════════════════════════════════════════
-- Bylda Launchpad · Demo data seed for a single account (client showcase)
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT THIS DOES
--   Populates one real account with believable-but-fake data so you can log in
--   and tour the full platform + test the CRM in front of a client:
--     • Marks onboarding complete  → unlocks the whole /app (the "final spot")
--     • Operate-mode workspace at the "Scale" stage + Scale plan (all tools open)
--     • A populated Business Context Graph (every AI surface reads this)
--     • CRM: companies, contacts (scored), and a deal pipeline across every stage
--     • Activity: succeeded tool runs, generated assets, automations, usage
--     • Intelligence: mentor insights feed (the signals rail / "hooks")
--
-- TARGET ACCOUNT
--   ansh.patel102104@gmail.com   (the user must have signed up at least once so
--   the auth.users row exists — this script does NOT create the login itself).
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   (Runs as the privileged "postgres" role, so RLS does not get in the way.)
--
-- SAFE TO RE-RUN
--   Every demo row carries a marker (custom_fields.seed='demo',
--   metadata.seed='demo', insights n8n_run_id='demo-seed', a known contact email
--   list). Re-running clears the previous demo rows first, so you never get
--   duplicates. To remove the demo data entirely, run teardown-demo-account.sql.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_email   text := 'ansh.patel102104@gmail.com';
  v_user    uuid;
  v_org     uuid;
  v_ws      uuid;
  v_now     timestamptz := now();
  v_mission jsonb;
  -- Known seeded contact emails — used as the idempotency key for contacts
  -- (so we can clean up without leaving a visible "demo" tag in the UI).
  v_contact_emails text[] := array[
    'sarah.chen@northwindlabs.io',
    'marcus.webb@vortexdigital.co',
    'aisha.rao@brightpathhealth.com',
    'diego.romero@heliostudio.io',
    'yuki.tanaka@orbitcraft.jp',
    'hannah.cole@lumenretail.com',
    'tom.becker@cedarandco.com',
    'priya.menon@quantafoods.com',
    'liam.osullivan@northwindlabs.io',
    'noah.kim@vortexdigital.co',
    'emma.larsson@brightpathhealth.com',
    'olivia.grant@lumenretail.com',
    'daniel.reyes@orbitcraft.jp',
    'sofia.marino@quantafoods.com'
  ];
begin
  -- ── 0. Resolve the auth user ──────────────────────────────────────────────
  select id into v_user from auth.users where lower(email) = lower(v_email) limit 1;
  if v_user is null then
    raise exception
      'No auth user for %. Sign up / log in once with that email first, then re-run.',
      v_email;
  end if;
  raise notice 'Seeding demo data for % (user %)', v_email, v_user;

  -- ── 1. Profile: name + mark onboarding complete (the /app gate) ───────────
  insert into public.profiles (id, email, full_name, onboarding_complete)
  values (v_user, v_email, 'Ansh Patel', true)
  on conflict (id) do update
    set onboarding_complete = true,
        full_name = coalesce(nullif(public.profiles.full_name, ''), 'Ansh Patel'),
        email     = coalesce(public.profiles.email, excluded.email);

  -- ── 1b. Full access: grant the admin role (Admin hub + owner mode) ────────
  -- Plan-level "max for free" is handled by the Scale subscription in step 4;
  -- the admin role additionally unlocks the internal Admin hub and owner mode.
  insert into public.user_roles (user_id, role)
  values (v_user, 'admin')
  on conflict (user_id, role) do nothing;

  -- ── 2. Organization + owner membership (idempotent) ───────────────────────
  select organization_id into v_org
  from public.organization_members
  where user_id = v_user
  order by created_at
  limit 1;

  if v_org is null then
    insert into public.organizations
      (owner_id, name, business_type, niche, location, target_customer, offer, goal, stage, website_url)
    values
      (v_user, 'Apex Growth Partners', 'Agency', 'B2B growth & RevOps',
       'Austin, TX', 'Seed–Series B SaaS founders',
       'Done-for-you growth engine: CRM, outbound, and reporting on autopilot',
       'Reach $120k MRR and 25 retained clients', 'Scale',
       'https://apexgrowth.partners')
    returning id into v_org;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_org, v_user, 'owner')
    on conflict (organization_id, user_id) do nothing;
  else
    update public.organizations
       set name            = 'Apex Growth Partners',
           business_type   = 'Agency',
           niche           = 'B2B growth & RevOps',
           location        = 'Austin, TX',
           target_customer = 'Seed–Series B SaaS founders',
           offer           = 'Done-for-you growth engine: CRM, outbound, and reporting on autopilot',
           goal            = 'Reach $120k MRR and 25 retained clients',
           stage           = 'Scale',
           website_url     = 'https://apexgrowth.partners'
     where id = v_org;
  end if;
  raise notice 'Organization: %', v_org;

  -- ── 3. Workspace + first mission (atomic, operate mode @ Scale) ───────────
  v_mission := jsonb_build_object(
    'title', 'Stand up your growth engine',
    'description', 'Get the CRM, follow-up, and reporting running on autopilot.',
    'steps', jsonb_build_array(
      jsonb_build_object('title','Load your pipeline',     'description','Bring active deals into the CRM',        'tool_key', null),
      jsonb_build_object('title','Turn on lead follow-up', 'description','Automate first-touch + nurture',         'tool_key','generate-followup-sequence'),
      jsonb_build_object('title','Generate your GTM plan', 'description','Channels, ICP, and messaging map',       'tool_key','gtm-strategy-builder'),
      jsonb_build_object('title','Publish a client report','description','Weekly executive summary per client',    'tool_key','client_report')
    )
  );

  select (public.provision_workspace_tx(
            v_org, v_user, 'Apex Growth Partners',
            'Systems',  -- workspace_lane
            'Scale',    -- business_stage
            'operate',  -- mode
            v_mission
          ) ->> 'workspace_id')::uuid
    into v_ws;
  raise notice 'Workspace: %', v_ws;

  -- ── 4. Subscription → Scale, FREE & non-expiring (max plan, no payment) ───
  -- Scale unlocks every feature gate and has an unlimited generation limit.
  -- No Stripe IDs are set, so it is comped/free; the far-future period end means
  -- it never lapses back to a paid prompt.
  insert into public.subscriptions
    (organization_id, plan, status, current_period_end, cancel_at_period_end)
  values
    (v_org, 'scale', 'active', v_now + interval '10 years', false)
  on conflict (organization_id) do update
    set plan = 'scale', status = 'active',
        current_period_end = v_now + interval '10 years',
        cancel_at_period_end = false,
        stripe_customer_id = null, stripe_subscription_id = null;

  -- ── 5. Business Context Graph (canonical context for every AI surface) ────
  insert into public.business_context
    (organization_id, workspace_id, identity, customer, stage, model, goals, constraints, verdicts, motion, activity)
  values (
    v_org, v_ws,
    jsonb_build_object('name','Apex Growth Partners',
      'description','Done-for-you growth engine for B2B SaaS — CRM, outbound, and reporting on autopilot.',
      'industry','Marketing & Growth Agency','niche','B2B growth & RevOps','mode','operate'),
    jsonb_build_object('target','Seed–Series B SaaS founders',
      'description','Technical founders doing $15k–$80k MRR who need a repeatable growth motion without hiring a full team.',
      'personas', jsonb_build_array('Solo technical founder','Head of Growth at a 10–40 person SaaS')),
    jsonb_build_object('stage','Scale','lane','Systems','revenue_band','$80k–$120k MRR','team_size','6–10'),
    jsonb_build_object('monetization','Monthly retainer + performance bonus','price_point','$6k–$12k / mo','fulfillment','Pods of 2 + Bylda automations'),
    jsonb_build_object('goal_90d','Add 6 retained clients and cut reporting time 80%','scale_goal','$120k MRR, 25 clients','timeline','Q3'),
    jsonb_build_object('time','~50 hrs/wk','budget','Reinvesting ~20% of revenue','experience','8 yrs agency + RevOps','assets', jsonb_build_array('Referral network','Proven outbound playbook')),
    jsonb_build_object('validator_score',82,'validator_verdict','Strong, proven demand','risks', jsonb_build_array('Founder-led sales bottleneck','Delivery capacity'),'funding_readiness','Bootstrapped — not raising'),
    jsonb_build_object('channels', jsonb_build_array('Outbound email','LinkedIn','Referrals','Webinars'),
      'sales_maturity','Repeatable, documented','bottlenecks', jsonb_build_array('Manual follow-up','Client reporting'),
      'tool_stack', jsonb_build_array('Bylda','Slack','Stripe','Notion'),'reporting_gaps', jsonb_build_array('Per-client ROI rollups')),
    jsonb_build_object('onboarded_at', v_now, 'summary','Scaling agency wiring its delivery onto Bylda OS.')
  )
  on conflict (organization_id) do update
    set workspace_id = excluded.workspace_id,
        identity = excluded.identity, customer = excluded.customer, stage = excluded.stage,
        model = excluded.model, goals = excluded.goals, constraints = excluded.constraints,
        verdicts = excluded.verdicts, motion = excluded.motion, activity = excluded.activity;

  -- ── 6. Legacy onboarding write-through (read by AI dashboard generator) ───
  insert into public.onboarding_responses
    (user_id, organization_id, offer, niche, target_customer, goal, current_revenue, stage, biggest_blocker, completed, completed_at)
  values
    (v_user, v_org,
     'Done-for-you growth engine for B2B SaaS',
     'B2B growth & RevOps', 'Seed–Series B SaaS founders',
     'Reach $120k MRR and 25 retained clients', '$80k–$120k MRR', 'Scale',
     'Manual follow-up and client reporting eat the week', true, v_now)
  on conflict (user_id) do update
    set organization_id = excluded.organization_id, offer = excluded.offer, niche = excluded.niche,
        target_customer = excluded.target_customer, goal = excluded.goal,
        current_revenue = excluded.current_revenue, stage = excluded.stage,
        biggest_blocker = excluded.biggest_blocker, completed = true, completed_at = v_now;

  if v_ws is not null then
    insert into public.workspace_intake
      (workspace_id, user_id, full_name, idea, stage, challenge, lane, raw_answers, completed, completed_at)
    values
      (v_ws, v_user, 'Ansh Patel',
       'Done-for-you growth engine for B2B SaaS', 'Scale',
       'Manual follow-up and client reporting', 'Systems',
       '{"mode":"operate"}'::jsonb, true, v_now)
    on conflict (workspace_id) do update
      set idea = excluded.idea, stage = excluded.stage, challenge = excluded.challenge,
          lane = excluded.lane, completed = true, completed_at = v_now;
  end if;

  insert into public.onboarding_sessions (user_id, mode, step, answers, status)
  values (v_user, 'operate', 99, '{"seed":"demo"}'::jsonb, 'completed')
  on conflict (user_id) do update set status = 'completed', mode = 'operate';

  -- ── 7. Clear any prior demo rows (idempotency; FK-safe order) ─────────────
  delete from public.crm_activities  where organization_id = v_org and coalesce(metadata->>'seed','') = 'demo';
  delete from public.leads           where organization_id = v_org and coalesce(custom_fields->>'seed','') = 'demo';
  delete from public.contacts        where user_id = v_user and email = any(v_contact_emails);
  delete from public.companies       where organization_id = v_org and coalesce(custom_fields->>'seed','') = 'demo';
  delete from public.tool_runs       where organization_id = v_org and coalesce(metadata->>'seed','') = 'demo';
  delete from public.generated_assets where organization_id = v_org and coalesce(metadata->>'seed','') = 'demo';
  delete from public.mentor_insights where org_id = v_org and n8n_run_id = 'demo-seed';
  delete from public.automation_settings where organization_id = v_org and coalesce(config->>'seed','') = 'demo';

  -- ── 8. Companies (CRM accounts) ───────────────────────────────────────────
  insert into public.companies (organization_id, name, domain, website, industry, size, location, notes, custom_fields)
  values
    (v_org,'Northwind Labs','northwindlabs.io','https://northwindlabs.io','Developer tools','25–50','San Francisco, CA','Expanding into enterprise; budget approved for Q3.','{"seed":"demo"}'::jsonb),
    (v_org,'Vortex Digital','vortexdigital.co','https://vortexdigital.co','Media & advertising','50–100','London, UK','Referred by an existing client. Fast mover.','{"seed":"demo"}'::jsonb),
    (v_org,'BrightPath Health','brightpathhealth.com','https://brightpathhealth.com','Healthtech','100–250','Boston, MA','Compliance-heavy; longer sales cycle.','{"seed":"demo"}'::jsonb),
    (v_org,'Helio Studio','heliostudio.io','https://heliostudio.io','Design agency','10–25','Barcelona, ES','Cold-outbound origin. Strong fit on creative ops.','{"seed":"demo"}'::jsonb),
    (v_org,'OrbitCraft','orbitcraft.jp','https://orbitcraft.jp','SaaS / PLG','25–50','Tokyo, JP','Closed-won. Upsell candidate for reporting add-on.','{"seed":"demo"}'::jsonb),
    (v_org,'Lumen Retail','lumenretail.com','https://lumenretail.com','E-commerce','100–250','Chicago, IL','Seasonal spikes; wants automation before Q4.','{"seed":"demo"}'::jsonb),
    (v_org,'Cedar and Co','cedarandco.com','https://cedarandco.com','Professional services','10–25','Denver, CO','Evaluating two vendors. Price sensitive.','{"seed":"demo"}'::jsonb),
    (v_org,'Quanta Foods','quantafoods.com','https://quantafoods.com','CPG / DTC','50–100','Austin, TX','Champion is the VP Growth. Needs ROI proof.','{"seed":"demo"}'::jsonb);

  -- ── 9. Contacts (scored leads) ────────────────────────────────────────────
  insert into public.contacts
    (user_id, org_id, first_name, last_name, email, phone, company, company_id, lead_score, status, source, tags, notes, last_contacted_at, created_at)
  values
    (v_user,v_org,'Sarah','Chen','sarah.chen@northwindlabs.io','+1 415 555 0114','Northwind Labs',(select id from public.companies where organization_id=v_org and name='Northwind Labs'),88,'qualified','LinkedIn',array['hot','enterprise','decision-maker'],'VP Eng. Wants a Q3 rollout. Sent proposal.',v_now - interval '1 day',v_now - interval '12 days'),
    (v_user,v_org,'Marcus','Webb','marcus.webb@vortexdigital.co','+44 20 7946 0091','Vortex Digital',(select id from public.companies where organization_id=v_org and name='Vortex Digital'),81,'engaged','Referral',array['hot','referral'],'Referred by OrbitCraft. Demo booked.',v_now - interval '2 days',v_now - interval '9 days'),
    (v_user,v_org,'Aisha','Rao','aisha.rao@brightpathhealth.com','+1 617 555 0177','BrightPath Health',(select id from public.companies where organization_id=v_org and name='BrightPath Health'),64,'contacted','Webinar',array['mid-market','compliance'],'Attended the RevOps webinar. Security review pending.',v_now - interval '4 days',v_now - interval '15 days'),
    (v_user,v_org,'Diego','Romero','diego.romero@heliostudio.io','+34 91 555 7820','Helio Studio',(select id from public.companies where organization_id=v_org and name='Helio Studio'),47,'nurture','Cold email',array['smb'],'Interested but no budget until next quarter.',v_now - interval '8 days',v_now - interval '21 days'),
    (v_user,v_org,'Yuki','Tanaka','yuki.tanaka@orbitcraft.jp','+81 3 5555 0190','OrbitCraft',(select id from public.companies where organization_id=v_org and name='OrbitCraft'),95,'qualified','Twitter',array['hot','customer','upsell'],'Closed-won. Reporting add-on upsell in motion.',v_now - interval '1 day',v_now - interval '40 days'),
    (v_user,v_org,'Hannah','Cole','hannah.cole@lumenretail.com','+1 312 555 0145','Lumen Retail',(select id from public.companies where organization_id=v_org and name='Lumen Retail'),73,'engaged','Inbound',array['mid-market','seasonal'],'Wants automation live before Q4 peak.',v_now - interval '3 days',v_now - interval '11 days'),
    (v_user,v_org,'Tom','Becker','tom.becker@cedarandco.com','+1 720 555 0133','Cedar and Co',(select id from public.companies where organization_id=v_org and name='Cedar and Co'),55,'contacted','Cold email',array['smb','price-sensitive'],'Comparing two vendors. Follow up Friday.',v_now - interval '5 days',v_now - interval '14 days'),
    (v_user,v_org,'Priya','Menon','priya.menon@quantafoods.com','+1 512 555 0166','Quanta Foods',(select id from public.companies where organization_id=v_org and name='Quanta Foods'),69,'engaged','Referral',array['dtc','champion'],'VP Growth is championing internally. Needs ROI deck.',v_now - interval '2 days',v_now - interval '7 days'),
    (v_user,v_org,'Liam','OSullivan','liam.osullivan@northwindlabs.io','+1 415 555 0188','Northwind Labs',(select id from public.companies where organization_id=v_org and name='Northwind Labs'),58,'contacted','LinkedIn',array['enterprise','technical'],'Technical buyer at Northwind. Looped into eval.',v_now - interval '6 days',v_now - interval '10 days'),
    (v_user,v_org,'Noah','Kim','noah.kim@vortexdigital.co','+44 20 7946 0123','Vortex Digital',(select id from public.companies where organization_id=v_org and name='Vortex Digital'),42,'new','LinkedIn',array['mid-market'],'New inbound from the Vortex team.',v_now - interval '1 day',v_now - interval '2 days'),
    (v_user,v_org,'Emma','Larsson','emma.larsson@brightpathhealth.com','+1 617 555 0199','BrightPath Health',(select id from public.companies where organization_id=v_org and name='BrightPath Health'),77,'qualified','Webinar',array['mid-market','hot'],'Budget confirmed. Procurement next.',v_now - interval '2 days',v_now - interval '18 days'),
    (v_user,v_org,'Olivia','Grant','olivia.grant@lumenretail.com','+1 312 555 0150','Lumen Retail',(select id from public.companies where organization_id=v_org and name='Lumen Retail'),38,'nurture','Inbound',array['smb'],'Early stage. Drip nurture for now.',v_now - interval '12 days',v_now - interval '20 days'),
    (v_user,v_org,'Daniel','Reyes','daniel.reyes@orbitcraft.jp','+81 3 5555 0205','OrbitCraft',(select id from public.companies where organization_id=v_org and name='OrbitCraft'),60,'contacted','Customer intro',array['expansion'],'Intro from Yuki for a sister team.',v_now - interval '4 days',v_now - interval '6 days'),
    (v_user,v_org,'Sofia','Marino','sofia.marino@quantafoods.com','+1 512 555 0170','Quanta Foods',(select id from public.companies where organization_id=v_org and name='Quanta Foods'),34,'cold','Cold email',array['dtc'],'No response after 4 touches. Pausing.',v_now - interval '25 days',v_now - interval '30 days');

  -- ── 10. Deals / pipeline (leads table — drives CRM + Pipeline metric) ─────
  insert into public.leads
    (organization_id, user_id, name, email, phone, company, stage, source, notes, value, tags, score, priority, owner_name, custom_fields, company_id, contact_id, created_at, updated_at)
  values
    (v_org,v_user,'Northwind Labs — Enterprise rollout','sarah.chen@northwindlabs.io','+1 415 555 0114','Northwind Labs','Proposal','LinkedIn','Proposal sent; verbal yes pending legal.',48000,array['enterprise','hot'],88,'high','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Northwind Labs'),(select id from public.contacts where user_id=v_user and email='sarah.chen@northwindlabs.io'),v_now - interval '12 days',v_now - interval '1 day'),
    (v_org,v_user,'Vortex Digital — Growth retainer','marcus.webb@vortexdigital.co','+44 20 7946 0091','Vortex Digital','Qualified','Referral','Demo done; scoping a 6-month retainer.',36000,array['referral','hot'],81,'high','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Vortex Digital'),(select id from public.contacts where user_id=v_user and email='marcus.webb@vortexdigital.co'),v_now - interval '9 days',v_now - interval '2 days'),
    (v_org,v_user,'BrightPath Health — RevOps build','aisha.rao@brightpathhealth.com','+1 617 555 0177','BrightPath Health','Contacted','Webinar','Security review in progress.',54000,array['compliance','mid-market'],64,'medium','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='BrightPath Health'),(select id from public.contacts where user_id=v_user and email='aisha.rao@brightpathhealth.com'),v_now - interval '15 days',v_now - interval '4 days'),
    (v_org,v_user,'Helio Studio — Creative ops pilot','diego.romero@heliostudio.io','+34 91 555 7820','Helio Studio','New','Cold email','Inbound reply; qualifying budget.',12000,array['smb'],47,'low','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Helio Studio'),(select id from public.contacts where user_id=v_user and email='diego.romero@heliostudio.io'),v_now - interval '21 days',v_now - interval '8 days'),
    (v_org,v_user,'OrbitCraft — Annual contract','yuki.tanaka@orbitcraft.jp','+81 3 5555 0190','OrbitCraft','Won','Twitter','Closed-won. 12-month retainer signed.',60000,array['customer','flagship'],95,'high','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='OrbitCraft'),(select id from public.contacts where user_id=v_user and email='yuki.tanaka@orbitcraft.jp'),v_now - interval '40 days',v_now - interval '6 days'),
    (v_org,v_user,'Lumen Retail — Automation package','hannah.cole@lumenretail.com','+1 312 555 0145','Lumen Retail','Qualified','Inbound','Wants live before Q4. Strong urgency.',42000,array['seasonal','hot'],73,'high','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Lumen Retail'),(select id from public.contacts where user_id=v_user and email='hannah.cole@lumenretail.com'),v_now - interval '11 days',v_now - interval '3 days'),
    (v_org,v_user,'Cedar and Co — Starter engagement','tom.becker@cedarandco.com','+1 720 555 0133','Cedar and Co','Contacted','Cold email','Comparing vendors; price sensitive.',9000,array['smb','price-sensitive'],55,'medium','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Cedar and Co'),(select id from public.contacts where user_id=v_user and email='tom.becker@cedarandco.com'),v_now - interval '14 days',v_now - interval '5 days'),
    (v_org,v_user,'Quanta Foods — Growth sprint','priya.menon@quantafoods.com','+1 512 555 0166','Quanta Foods','Proposal','Referral','ROI deck delivered; awaiting sign-off.',30000,array['dtc','champion'],69,'high','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Quanta Foods'),(select id from public.contacts where user_id=v_user and email='priya.menon@quantafoods.com'),v_now - interval '7 days',v_now - interval '2 days'),
    (v_org,v_user,'OrbitCraft — Reporting add-on','daniel.reyes@orbitcraft.jp','+81 3 5555 0205','OrbitCraft','Qualified','Customer intro','Expansion via Yuki referral.',15000,array['expansion'],60,'medium','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='OrbitCraft'),(select id from public.contacts where user_id=v_user and email='daniel.reyes@orbitcraft.jp'),v_now - interval '6 days',v_now - interval '1 day'),
    (v_org,v_user,'BrightPath Health — Phase 2','emma.larsson@brightpathhealth.com','+1 617 555 0199','BrightPath Health','Qualified','Webinar','Budget confirmed; procurement next.',24000,array['mid-market','hot'],77,'high','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='BrightPath Health'),(select id from public.contacts where user_id=v_user and email='emma.larsson@brightpathhealth.com'),v_now - interval '18 days',v_now - interval '2 days'),
    (v_org,v_user,'Lumen Retail — Pilot (lost)','olivia.grant@lumenretail.com','+1 312 555 0150','Lumen Retail','Lost','Inbound','Went with an in-house hire. Revisit in 6 mo.',8000,array['smb'],38,'low','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Lumen Retail'),(select id from public.contacts where user_id=v_user and email='olivia.grant@lumenretail.com'),v_now - interval '28 days',v_now - interval '9 days'),
    (v_org,v_user,'Vortex Digital — Net-new pod','noah.kim@vortexdigital.co','+44 20 7946 0123','Vortex Digital','New','LinkedIn','Fresh inbound from the Vortex team.',18000,array['mid-market'],42,'medium','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Vortex Digital'),(select id from public.contacts where user_id=v_user and email='noah.kim@vortexdigital.co'),v_now - interval '2 days',v_now - interval '1 day'),
    (v_org,v_user,'Northwind Labs — Add-on seats','liam.osullivan@northwindlabs.io','+1 415 555 0188','Northwind Labs','Contacted','LinkedIn','Technical buyer looped into the eval.',13000,array['enterprise'],58,'medium','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Northwind Labs'),(select id from public.contacts where user_id=v_user and email='liam.osullivan@northwindlabs.io'),v_now - interval '10 days',v_now - interval '3 days'),
    (v_org,v_user,'Quanta Foods — Lapsed (cold)','sofia.marino@quantafoods.com','+1 512 555 0170','Quanta Foods','Lost','Cold email','No response after 4 touches.',6000,array['dtc'],34,'low','Ansh Patel','{"seed":"demo"}'::jsonb,(select id from public.companies where organization_id=v_org and name='Quanta Foods'),(select id from public.contacts where user_id=v_user and email='sofia.marino@quantafoods.com'),v_now - interval '30 days',v_now - interval '25 days');

  -- ── 11. CRM activity timeline on a few key deals ──────────────────────────
  insert into public.crm_activities (organization_id, deal_id, user_id, type, content, metadata, created_at)
  select v_org, l.id, v_user, a.type, a.content, '{"seed":"demo"}'::jsonb, v_now - a.ago
  from public.leads l
  join (values
    ('Northwind Labs — Enterprise rollout','note','Sent the enterprise proposal; legal reviewing MSA.', interval '1 day'),
    ('Northwind Labs — Enterprise rollout','call','30-min call with Sarah — strong intent, Q3 timeline.', interval '3 days'),
    ('Northwind Labs — Enterprise rollout','stage_change','Moved Contacted → Proposal.', interval '5 days'),
    ('Vortex Digital — Growth retainer','meeting','Live demo with Marcus + 2 stakeholders.', interval '2 days'),
    ('OrbitCraft — Annual contract','stage_change','Moved Proposal → Won. Contract signed.', interval '6 days'),
    ('Quanta Foods — Growth sprint','email','Delivered the ROI deck to Priya.', interval '2 days'),
    ('Lumen Retail — Automation package','task','Prep Q4 automation scope for Hannah.', interval '1 day')
  ) as a(deal_name, type, content, ago) on a.deal_name = l.name
  where l.organization_id = v_org and coalesce(l.custom_fields->>'seed','') = 'demo';

  -- ── 12. Tool runs (succeeded → execution index, ROI, blocker clearing) ────
  insert into public.tool_runs (organization_id, user_id, tool_key, status, input, output, metadata, created_at, updated_at)
  values
    (v_org,v_user,'validate-idea','succeeded','{}'::jsonb, jsonb_build_object('verdict','Strong','score',82), '{"seed":"demo"}'::jsonb, v_now - interval '34 days', v_now - interval '34 days'),
    (v_org,v_user,'competitor-scanner','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '30 days', v_now - interval '30 days'),
    (v_org,v_user,'persona-builder','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '29 days', v_now - interval '29 days'),
    (v_org,v_user,'positioning-engine','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '27 days', v_now - interval '27 days'),
    (v_org,v_user,'generate-offer','succeeded','{}'::jsonb, jsonb_build_object('offer','Done-for-you growth engine'), '{"seed":"demo"}'::jsonb, v_now - interval '25 days', v_now - interval '25 days'),
    (v_org,v_user,'pricing-calculator','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '24 days', v_now - interval '24 days'),
    (v_org,v_user,'gtm-strategy-builder','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '21 days', v_now - interval '21 days'),
    (v_org,v_user,'landing-page-creator','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '19 days', v_now - interval '19 days'),
    (v_org,v_user,'first-10-customers-finder','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '17 days', v_now - interval '17 days'),
    (v_org,v_user,'generate-followup-sequence','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '14 days', v_now - interval '14 days'),
    (v_org,v_user,'cold_email','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '12 days', v_now - interval '12 days'),
    (v_org,v_user,'kpi-dashboard','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '9 days', v_now - interval '9 days'),
    (v_org,v_user,'seo-audit','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '7 days', v_now - interval '7 days'),
    (v_org,v_user,'client_report','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '4 days', v_now - interval '4 days'),
    (v_org,v_user,'social','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '2 days', v_now - interval '2 days'),
    (v_org,v_user,'ad-copy','succeeded','{}'::jsonb,'{}'::jsonb,'{"seed":"demo"}'::jsonb, v_now - interval '1 day', v_now - interval '1 day');

  -- ── 13. Generated assets (library) ────────────────────────────────────────
  insert into public.generated_assets (organization_id, user_id, category, kind, title, content, metadata, created_at)
  values
    (v_org,v_user,'strategy','gtm-strategy-builder','GTM Plan — Apex Growth Partners', jsonb_build_object('summary','90-day go-to-market across outbound, LinkedIn, and referrals.'),'{"seed":"demo"}'::jsonb, v_now - interval '21 days'),
    (v_org,v_user,'sales','generate-offer','Offer — Done-for-you growth engine', jsonb_build_object('price','$6k–$12k / mo'),'{"seed":"demo"}'::jsonb, v_now - interval '25 days'),
    (v_org,v_user,'launch','landing-page-creator','Landing Page — Growth engine for SaaS', jsonb_build_object('hero','Your growth engine, on autopilot.'),'{"seed":"demo"}'::jsonb, v_now - interval '19 days'),
    (v_org,v_user,'sales','generate-followup-sequence','5-Touch Reactivation Sequence', jsonb_build_object('emails',5),'{"seed":"demo"}'::jsonb, v_now - interval '14 days'),
    (v_org,v_user,'reporting','client_report','OrbitCraft — Monthly Client Report', jsonb_build_object('period','last_30_days'),'{"seed":"demo"}'::jsonb, v_now - interval '4 days'),
    (v_org,v_user,'strategy','competitor-scanner','Competitor Scan — RevOps agencies', jsonb_build_object('tiers',3,'gaps',5),'{"seed":"demo"}'::jsonb, v_now - interval '30 days');

  -- ── 14. Automations (org-scoped — drives KPIs + ROI + launch control) ─────
  insert into public.automation_settings (organization_id, key, label, enabled, config)
  values
    (v_org,'lead_followup','New-lead instant follow-up', true, '{"seed":"demo","channel":"email"}'::jsonb),
    (v_org,'nurture_sequence','Cold-lead nurture sequence', true, '{"seed":"demo","cadence":"weekly"}'::jsonb),
    (v_org,'stage_alerts','Deal stage-change Slack alerts', true, '{"seed":"demo"}'::jsonb),
    (v_org,'weekly_report','Weekly client report auto-send', true, '{"seed":"demo"}'::jsonb),
    (v_org,'review_request','Post-win review request', true, '{"seed":"demo"}'::jsonb),
    (v_org,'invoice_reminder','Invoice payment reminders', false, '{"seed":"demo"}'::jsonb)
  on conflict (organization_id, key) do update
    set label = excluded.label, enabled = excluded.enabled, config = excluded.config;

  -- Best-effort: the operate Home reads active automations from automation_configs
  -- (user-scoped, lives in production via schema drift). Skip cleanly if absent
  -- or if its column shape differs.
  begin
    if to_regclass('public.automation_configs') is not null then
      execute 'delete from public.automation_configs where user_id = $1' using v_user;
      execute 'insert into public.automation_configs (user_id, enabled) values ($1, true), ($1, true), ($1, true)' using v_user;
    end if;
  exception when others then
    raise notice 'automation_configs seed skipped (%).', sqlerrm;
  end;

  -- ── 15. Usage tracking (current period) ───────────────────────────────────
  insert into public.usage_tracking (organization_id, tool_key, period, count)
  values
    (v_org,'generate-followup-sequence', to_char(v_now,'YYYY-MM'), 6),
    (v_org,'client_report',              to_char(v_now,'YYYY-MM'), 4),
    (v_org,'gtm-strategy-builder',       to_char(v_now,'YYYY-MM'), 3),
    (v_org,'cold_email',                 to_char(v_now,'YYYY-MM'), 5)
  on conflict (organization_id, tool_key, period) do update set count = excluded.count;

  -- ── 16. Mentor insights (intelligence rail / signals feed) ────────────────
  insert into public.mentor_insights (org_id, agent_id, type, title, detail, priority, read, n8n_run_id, created_at)
  values
    (v_org,'sales','opportunity','3 deals are stuck in Proposal','Northwind, Quanta, and BrightPath have been in Proposal 5+ days. A nudge sequence could recover ~$102k.', 'high', false,'demo-seed', v_now - interval '6 hours'),
    (v_org,'growth','signal','Referrals are your best channel','Referral leads convert 2.4x higher than cold. Ask your 3 happiest clients for intros this week.', 'medium', false,'demo-seed', v_now - interval '1 day'),
    (v_org,'automation','recommendation','Turn on invoice reminders','It is the only automation still off. Clients pay ~6 days faster with reminders on.', 'medium', false,'demo-seed', v_now - interval '2 days'),
    (v_org,'finance','signal','Pipeline up 18% week-over-week','Open pipeline grew to ~$272k. Won this month: OrbitCraft ($60k).', 'low', true,'demo-seed', v_now - interval '3 days'),
    (v_org,'content','opportunity','Repurpose the OrbitCraft win','A case study from the OrbitCraft rollout would arm outbound to similar PLG SaaS.', 'medium', false,'demo-seed', v_now - interval '4 days'),
    (v_org,'sales','warning','Quanta Foods is going cold','No reply after 4 touches on the lapsed deal. Last chance before close-lost.', 'high', false,'demo-seed', v_now - interval '5 days');

  raise notice 'Demo seed complete for %.', v_email;
end $$;

-- ── Quick verification (optional — read after running) ────────────────────────
select
  (select count(*) from public.leads     l join public.organizations o on o.id=l.organization_id where o.owner_id=u.id) as deals,
  (select count(*) from public.contacts  c where c.user_id=u.id)                                                       as contacts,
  (select count(*) from public.companies cm join public.organizations o on o.id=cm.organization_id where o.owner_id=u.id) as companies,
  (select count(*) from public.tool_runs t join public.organizations o on o.id=t.organization_id where o.owner_id=u.id) as tool_runs,
  (select count(*) from public.mentor_insights mi join public.organizations o on o.id=mi.org_id where o.owner_id=u.id)  as insights
from auth.users u
where lower(u.email) = lower('ansh.patel102104@gmail.com');
