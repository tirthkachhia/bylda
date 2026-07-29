-- Cross-system Connection 8: Nova → full CRM command set. Nova already proposes
-- update_lead_stage / log_crm_note / log_memory / trigger_n8n_workflow via the
-- propose_action tool; this widens the nova_actions.action_type CHECK so Nova can
-- also create_task and create_contact (the remaining crm-action capabilities),
-- executed after founder approval by the nova-action executor.

alter table public.nova_actions
  drop constraint if exists nova_actions_action_type_check;

alter table public.nova_actions
  add constraint nova_actions_action_type_check
  check (action_type = any (array[
    'update_lead_stage',
    'log_crm_note',
    'create_task',
    'create_contact',
    'log_memory',
    'trigger_n8n_workflow'
  ]::text[]));
