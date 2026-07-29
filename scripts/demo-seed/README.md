# Demo account seed

Populates **one real account** with believable-but-fake data so you can log in,
tour the whole platform, and test the CRM in front of a client.

- **Target:** `ansh.patel102104@gmail.com`
- **Files:**
  - `seed-demo-account.sql` — loads the demo data (idempotent / safe to re-run)
  - `teardown-demo-account.sql` — removes only the demo rows

## What you get

| Area                 | Seeded                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Access**           | `onboarding_complete = true` (unlocks all of `/app`), **Scale** plan (every feature, unlimited, **free / no payment, non-expiring**), and the **admin** role (Admin hub + owner mode) |
| **Workspace**        | Operate-mode workspace at the **Scale** stage, with a first mission + steps                                                                                                           |
| **Business context** | Full Business Context Graph (the canonical record every AI surface reads)                                                                                                             |
| **CRM**              | 8 companies, 14 scored contacts, 14 deals across every pipeline stage (~$272k open pipeline, OrbitCraft won), plus activity timelines                                                 |
| **Activity**         | 16 succeeded tool runs, 6 generated assets, 6 automations, current-period usage                                                                                                       |
| **Intelligence**     | 6 mentor insights in the signals rail                                                                                                                                                 |

All numbers are fake but internally consistent (pipeline = sum of deal values,
execution index from tool runs, etc.).

## How to run

1. Open the **Supabase Dashboard → SQL Editor** for the project
   (`ipidfqwlszuhjgjygbvx`).
2. Make sure the account has logged in at least once (so the `auth.users` row
   exists — this script does **not** create the login).
3. Paste the contents of `seed-demo-account.sql` and click **Run**.
4. Log in to the app as `ansh.patel102104@gmail.com` — you land on the populated
   Bylda OS home with a full CRM.

> Re-running is safe: every demo row is tagged and cleared before re-insert, so
> you never get duplicates.

### Alternative: run it from a machine with DB access

If you prefer to run it via CLI from a machine that can reach Supabase (this
seed needs the privileged connection because it reads `auth.users` and calls a
`security definer` RPC):

```bash
# Using the project's pooled/direct Postgres connection string:
psql "$SUPABASE_DB_URL" -f scripts/demo-seed/seed-demo-account.sql
```

(The Claude Code web sandbox cannot reach the Supabase host unless it is added
to the environment's **network egress allowlist** — see
https://code.claude.com/docs/en/claude-code-on-the-web — so the SQL Editor is
the simplest path.)

## Undo

Paste `teardown-demo-account.sql` into the SQL Editor and run it. It removes the
demo rows only; uncomment the block at the bottom to also revert the plan, admin
role, and onboarding flag.
