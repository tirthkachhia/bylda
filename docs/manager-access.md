# Manager access

- Managers sign in with their own credentials at `/auth/manager-sign-in` and land at `/app/manager`.
- Managers and agents use the Page 30 interface. Manager sign-in still requires server role verification to open the dedicated manager entry and agent invitation panel. Reloading preserves that verified login selection in the tab, and sign-out clears it.
- Owners/admins invite managers or change a member's role under Settings → Users. Manager access does not grant billing, API-key or workspace-administration privileges.
- Managers open **Manage my agents** from their dashboard, create a team (assigned to themselves by default), and add agents by name and email. New accounts receive an invitation to set a password; existing accounts keep their credentials.
- Adding an agent atomically creates their workspace membership, links their auth identity to the rep profile, and assigns the rep to the selected team. Invites never silently downgrade or promote existing memberships.
- Team rep links open the existing call, evidence, coaching and report views. Managers see assigned teams and their unassigned rep profiles; agents see only their own work. Workspace owners/admins retain workspace visibility.
- Owners/admins can transfer an agent by removing the rep from the original team and assigning them to the new team. The original creator's access ends once another manager owns the assignment.
- Existing team managers are upgraded from member to manager by the migration. Existing reps with matching workspace-member emails get explicit login links; later email changes do not transfer access.

## Deployment

Apply `20261111000001_manager_role.sql` and `20261111000002_manager_access.sql` in order, then deploy `team-invite`, `coaching-report` and `analyze-call` before releasing the frontend. `APP_URL` must point to the frontend and Supabase Auth must allow redirects to its `/auth/invite` path. The invitation stores a workspace hint in user metadata; membership is verified before selecting that workspace.

Validation: `bun run test`, `bunx tsc --noEmit`, `bun run build`, and ESLint on the changed frontend files. Manager storage tests execute the actual migration in PostgreSQL (PGlite) with permissive baseline policies and verify that the restrictive policies enforce team boundaries.
