-- Closes a narrow gap in the `launch` tier's allowed_tools left over from the previous
-- expansion (20260608000001): three tools are outliers relative to their peer group —
--   * competitor-scanner        (plan="0"  in LAUNCHPAD_TOOLS — the only one of 7 free
--                                tools missing from `launch`; present in operate/scale)
--   * business-plan-generator   (plan="49" — one of only 2 of 7 Launch-tier tools
--   * pricing-calculator         missing from `launch`; both already in operate/scale)
-- Purely additive — unions these three slugs into `launch` only, leaving every other
-- tier and every other slug untouched.
update public.plan_tier_limits
set allowed_tools = (
  select array_agg(distinct t order by t)
  from unnest(
    allowed_tools || array['competitor-scanner', 'business-plan-generator', 'pricing-calculator']
  ) as t
),
updated_at = now()
where plan = 'launch';
