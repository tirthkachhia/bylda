-- plan_tier_limits.allowed_tools gates app.launchpad.$tool's `isToolLocked` check
-- (`currentEnt.allowed_tools.includes(tool.toolKey)`). The live table has drifted
-- from both its original seed (20260516000000_squash.sql) and the catalog — it
-- contains a number of stale slugs that match no current tool.toolKey (harmless,
-- they unlock nothing reachable) and is missing the toolKey for every Launchpad
-- tool added since the original ~17-tool seed, including the new positioning-engine
-- / niche-scorer / mvp-planner tools. Net effect: ~16 wired, paid-tier tools show
-- "Upgrade required" for every real (non-admin) user on every plan.
--
-- This additively unions in the missing current-catalog toolKeys per tier (matching
-- each tool's `requiredPlan` from src/lib/mock.ts, cumulative across higher tiers)
-- without removing any existing entries — purely expands what each tier can reach.
update public.plan_tier_limits
set allowed_tools = (
  select array_agg(distinct t order by t)
  from unnest(
    allowed_tools ||
    case plan::text
      when 'launch' then
        array['blog','social','email_sequence','sales_script','cold_email','pitch_deck',
              'lead_magnet','niche_validator','icp','positioning-engine','niche-scorer',
              'mvp-planner']
      when 'operate' then
        array['blog','social','email_sequence','sales_script','cold_email','pitch_deck',
              'lead_magnet','niche_validator','icp','positioning-engine','niche-scorer',
              'mvp-planner','ad_creative','vsl','automation','client_report']
      when 'scale' then
        array['blog','social','email_sequence','sales_script','cold_email','pitch_deck',
              'lead_magnet','niche_validator','icp','positioning-engine','niche-scorer',
              'mvp-planner','ad_creative','vsl','automation','client_report']
      else array[]::text[]
    end
  ) as t
),
updated_at = now()
where plan in ('starter','launch','operate','scale');
