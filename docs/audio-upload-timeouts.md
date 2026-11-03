# Recording upload timeout repair

The upload screen still accepts multiple recordings up to 100 MB each, with the
same frontend messages. This change starts from main `f13c7a2`, including the Figma
frontend updates.

Previously each recording went through one standard Storage upload request.
The new transport uses Supabase's TUS resumable endpoint on the direct storage
host. Files transfer in 6 MiB chunks and are stored as one object at the same
organization/user/import path. A timeout or interrupted PATCH recovers the
server's confirmed offset and continues without retransmitting the entire file.
Each chunk has bounded retries; the complete file has no short application
deadline. Access tokens are refreshed from the current session on each request,
and existing objects are not overwritten.

This follows [Supabase's recommendation for uploads above 6 MB](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).
The observed Cloudflare zone is on the Free plan. Raising the proxy read timeout
is [an Enterprise feature](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/),
so increasing a browser or Worker timeout cannot raise that limit. The repair
reduces the size of each request and recovers from transient 524 responses.

No failed-request trace was supplied, so the exact historical failing request
has not been proven. This repair targets the foreground audio upload. The existing
background transcription, scoring and analysis pipeline is unchanged; it can
still report independent provider/runtime failures. No Cloudflare settings,
database policies, bucket limits or backend deployments are changed.

Validation uses the real TUS client with a simulated storage server: multiple
100 MB files, 6 MiB chunk limits, recovery from a 524 after partially accepted
bytes, fresh authorization on subsequent requests, no retries on 403, and no
credential forwarding to another origin. Existing import and file-limit tests,
the complete app test suite, TypeScript, targeted lint and production build are
also checked. A real authenticated upload remains a deployment acceptance check.
