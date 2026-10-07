# Bylda signup emails

Implementation verification: 176 existing regression tests pass; the rollback-only
`scripts/test-signup-email.sql` passed against the target project (verification
gate, one-time enqueue, consent capture and permission checks). The deployed
dispatch endpoint rejects unauthenticated requests with HTTP 401. Actual email
delivery and scheduling have not been enabled or tested because sender secrets
are not configured.

Admin console: `/app/admin` → **Signup emails**. Users manage optional updates
under Settings → Profile → Email notifications. Signup consent is unchecked by
default. Existing users are not opted in or sent retroactive welcome emails.

Welcome messages enter the queue only after email confirmation. Product updates
are queued explicitly by a platform admin, and consent is checked again at send
time. Plain text avoids arbitrary HTML injection. Unsubscribe links use random
tokens and require a POST confirmation so link scanners do not silently opt out.

## Activate delivery

Set these Supabase Edge Function secrets (never frontend environment variables):

- `RESEND_API_KEY`: sending key for a verified Resend domain.
- `EMAIL_FROM`: verified sender, e.g. `Bylda <hello@usebylda.com>`.
- `EMAIL_POSTAL_ADDRESS`: the business mailing address appended to messages.
- `SIGNUP_EMAIL_DISPATCH_KEY`: random shared secret for the scheduler.

Store that last value in Supabase Vault as `signup_email_dispatch_key` and create
the schedule below. Do not use a user JWT. `pg_cron` and `pg_net` must be enabled.
Apply migration `20260928000003_signup_email.sql`, deploy `signup-email` and
`signup-email-unsubscribe`, and deploy the frontend first.

```sql
select cron.schedule('bylda-signup-emails', '*/5 * * * *', $$
 select net.http_post(
   url := 'https://ipidfqwlszuhjgjygbvx.supabase.co/functions/v1/signup-email',
   headers := jsonb_build_object('Content-Type','application/json',
     'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='signup_email_dispatch_key')),
   body := '{"action":"process"}'::jsonb,
   timeout_milliseconds := 180000
 );
$$);
```

Until provider setup and scheduling are completed, welcome messages remain queued;
the admin console explicitly shows delivery disabled. Admins can process ten queued
messages at a time manually once configured. No marketing broadcast was sent as
part of implementation.

Queue claims are atomic (`FOR UPDATE SKIP LOCKED`). A provider idempotency key is
used for each immutable job. Failed or interrupted sends are not automatically
retried: check provider logs before recovery to avoid duplicate sends outside the
provider's deduplication window. `accepted` means accepted by the email provider,
not delivered to inbox. Bounce/delivery webhooks and suppression automation are not
implemented yet; monitor the provider dashboard before sending at scale.
