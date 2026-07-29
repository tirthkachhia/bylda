#!/bin/bash
# Reset demo data touched by tutorial recordings so each run starts clean.
set -e
SRK="${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
URL="${SUPABASE_URL:?set SUPABASE_URL}/rest/v1"
H=(-H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json")

# deals created by crm-intro test runs
curl -s -X DELETE "$URL/leads?name=ilike.Acme*Pilot*" "${H[@]}" -o /dev/null
# restore dragged deals to their original stages
curl -s -X PATCH "$URL/leads?name=eq.Daniel%20Reyes" "${H[@]}" -d '{"stage":"Contacted"}' -o /dev/null
curl -s -X PATCH "$URL/leads?name=eq.Priya%20Raman" "${H[@]}" -d '{"stage":"Contacted"}' -o /dev/null
curl -s -X PATCH "$URL/leads?name=eq.Tom%20Becker" "${H[@]}" -d '{"stage":"Qualified"}' -o /dev/null
# contact created by leads-capture
curl -s -X DELETE "$URL/contacts?email=eq.maya@loopworks.io" "${H[@]}" -o /dev/null
# workflows saved by builder tutorials
curl -s -X DELETE "$URL/workflow_builders?name=in.(%22Welcome%20new%20leads%22,%22Lead%20nurture%20sequence%22)" "${H[@]}" -o /dev/null
# integration connected during integrations tutorial
curl -s -X DELETE "$URL/user_integrations?integration_key=eq.slack" "${H[@]}" -o /dev/null
# dashboards generated during the ai-dashboard tutorial
curl -s -X DELETE "$URL/ai_dashboards?user_id=eq.bfae05b7-f5db-4973-b319-d87776a99469" "${H[@]}" -o /dev/null 2>/dev/null || true
curl -s -X DELETE "$URL/user_dashboards?user_id=eq.bfae05b7-f5db-4973-b319-d87776a99469" "${H[@]}" -o /dev/null 2>/dev/null || true
# restore deals moved by bulk-actions
curl -s -X PATCH "$URL/leads?name=eq.Hannah%20Cole" "${H[@]}" -d '{"stage":"Won"}' -o /dev/null
curl -s -X PATCH "$URL/leads?name=eq.Emma%20Larsson" "${H[@]}" -d '{"stage":"Qualified"}' -o /dev/null
# memory artifacts logged by bylda-memory tutorial
curl -s -X DELETE "$URL/memory_artifacts?title=ilike.*5K%20enterprise*" "${H[@]}" -o /dev/null
# tool runs + generated assets from campaign tutorials (org had zero originally)
ORG="1a13f93b-0004-45d8-bbde-10f619d1ec84"
curl -s -X DELETE "$URL/tool_outputs?organization_id=eq.$ORG" "${H[@]}" -o /dev/null
curl -s -X DELETE "$URL/tool_runs?organization_id=eq.$ORG" "${H[@]}" -o /dev/null
curl -s -X DELETE "$URL/generated_assets?organization_id=eq.$ORG" "${H[@]}" -o /dev/null
curl -s -X DELETE "$URL/content_outputs?organization_id=eq.$ORG" "${H[@]}" -o /dev/null
# fresh onboarding user state
UID2="db56299b-d2e7-4433-b8d1-47093607301c"
curl -s -X PATCH "$URL/profiles?id=eq.$UID2" "${H[@]}" -d '{"onboarding_complete": false}' -o /dev/null
curl -s -X DELETE "$URL/onboarding_responses?user_id=eq.$UID2" "${H[@]}" -o /dev/null 2>/dev/null || true
curl -s -X DELETE "$URL/onboarding_sessions?user_id=eq.$UID2" "${H[@]}" -o /dev/null 2>/dev/null || true
echo "reset done"
curl -s "$URL/leads?select=name,stage&order=name" "${H[@]}" | python3 -c "import json,sys; print(', '.join(f\"{r['name']}:{r['stage']}\" for r in json.load(sys.stdin)))"