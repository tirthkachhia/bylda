// bylda-contacts-api
// GET    /api/contacts         — paginated, filterable list
// POST   /api/contacts         — create contact
// PATCH  /api/contacts/:id     — update contact fields
// DELETE /api/contacts/:id     — soft delete (status = 'archived')

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const ALLOWED_ORIGIN = "https://app.usebylda.com";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function validateJWT(token: string, env: Env): Promise<{ sub: string } | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string };
    return { sub: user.id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Supabase headers
// ---------------------------------------------------------------------------
function sbHeaders(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleList(request: Request, env: Env, user: { sub: string }): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "25", 10), 100);
  const offset = (page - 1) * limit;
  const status = url.searchParams.get("status");
  const minScore = url.searchParams.get("min_score");

  // Build filter string
  let filters = `user_id=eq.${user.sub}&status=neq.archived`;
  if (status) filters += `&status=eq.${status}`;
  if (minScore) filters += `&lead_score=gte.${minScore}`;

  const contactsRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/contacts?${filters}&order=created_at.desc&limit=${limit}&offset=${offset}`,
    {
      headers: {
        ...sbHeaders(env),
        Prefer: "count=exact",
      },
    },
  );

  if (!contactsRes.ok) {
    return jsonResponse({ error: "Failed to fetch contacts" }, 502);
  }

  const contacts = await contactsRes.json();
  const contentRange = contactsRes.headers.get("Content-Range") ?? "";
  // Content-Range: 0-24/150
  const totalMatch = contentRange.match(/\/(\d+)$/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

  return jsonResponse({
    data: contacts,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
}

async function handleCreate(request: Request, env: Env, user: { sub: string }): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;

  const contact = {
    ...body,
    user_id: user.sub,
    status: (body.status as string) ?? "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contacts`, {
    method: "POST",
    headers: {
      ...sbHeaders(env),
      Prefer: "return=representation",
    },
    body: JSON.stringify(contact),
  });

  if (!res.ok) {
    const err = await res.text();
    return jsonResponse({ error: "Failed to create contact", detail: err }, 502);
  }

  const created = (await res.json()) as unknown[];
  return jsonResponse((created as unknown[])[0], 201);
}

async function handleUpdate(
  request: Request,
  env: Env,
  user: { sub: string },
  contactId: string,
): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;

  // Ensure user owns the contact
  const checkRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/contacts?id=eq.${contactId}&user_id=eq.${user.sub}&select=id`,
    { headers: sbHeaders(env) },
  );
  const existing = (await checkRes.json()) as unknown[];
  if (!existing.length) {
    return jsonResponse({ error: "Contact not found" }, 404);
  }

  const updates = {
    ...body,
    user_id: user.sub, // Prevent user_id overwrite
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/contacts?id=eq.${contactId}&user_id=eq.${user.sub}`,
    {
      method: "PATCH",
      headers: {
        ...sbHeaders(env),
        Prefer: "return=representation",
      },
      body: JSON.stringify(updates),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return jsonResponse({ error: "Failed to update contact", detail: err }, 502);
  }

  const updated = (await res.json()) as unknown[];
  return jsonResponse((updated as unknown[])[0]);
}

async function handleDelete(env: Env, user: { sub: string }, contactId: string): Promise<Response> {
  // Soft delete — set status = 'archived'
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/contacts?id=eq.${contactId}&user_id=eq.${user.sub}`,
    {
      method: "PATCH",
      headers: {
        ...sbHeaders(env),
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status: "archived", updated_at: new Date().toISOString() }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return jsonResponse({ error: "Failed to archive contact", detail: err }, 502);
  }

  const result = (await res.json()) as unknown[];
  if (!(result as unknown[]).length) {
    return jsonResponse({ error: "Contact not found" }, 404);
  }

  return jsonResponse({ success: true, status: "archived" });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Auth
    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const user = await validateJWT(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Extract optional contact ID from path: /api/contacts/:id
    const contactIdMatch = path.match(/^\/api\/contacts\/([^/]+)$/);
    const contactId = contactIdMatch ? contactIdMatch[1] : null;

    let response: Response;

    if (request.method === "GET" && path === "/api/contacts") {
      response = await handleList(request, env, user);
    } else if (request.method === "POST" && path === "/api/contacts") {
      response = await handleCreate(request, env, user);
    } else if (request.method === "PATCH" && contactId) {
      response = await handleUpdate(request, env, user, contactId);
    } else if (request.method === "DELETE" && contactId) {
      response = await handleDelete(env, user, contactId);
    } else {
      response = jsonResponse({ error: "Not found" }, 404);
    }

    // Inject CORS headers into final response
    const newHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors)) {
      newHeaders.set(k, v);
    }
    return new Response(response.body, { status: response.status, headers: newHeaders });
  },
};
