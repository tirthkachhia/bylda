import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SalesforceCredential = {
  access_token?: string;
  refresh_token?: string;
  instance_url?: string;
  identity_url?: string;
  scope?: string[];
  external_account_id?: string;
};

type SalesforceContact = {
  Id: string;
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Title?: string | null;
  Account?: { Name?: string | null } | null;
  LastModifiedDate?: string;
};

type SalesforceOpportunity = {
  Id: string;
  Name?: string | null;
  StageName?: string | null;
  Amount?: number | null;
  CloseDate?: string | null;
  Probability?: number | null;
  Type?: string | null;
  LeadSource?: string | null;
  Account?: { Name?: string | null } | null;
  LastModifiedDate?: string;
};

type QueryResult<T> = {
  records?: T[];
  nextRecordsUrl?: string;
  done?: boolean;
};

function validInstanceUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "salesforce.com" || url.hostname.endsWith(".salesforce.com"))
    );
  } catch {
    return false;
  }
}

function byldaStage(stageName?: string | null) {
  const stage = (stageName ?? "").toLowerCase();
  if (stage.includes("closed won")) return "Won";
  if (stage.includes("closed lost")) return "Lost";
  if (stage.includes("proposal") || stage.includes("quote") || stage.includes("negotiat")) {
    return "Proposal";
  }
  if (stage.includes("qualif") || stage.includes("needs") || stage.includes("value proposition")) {
    return "Qualified";
  }
  if (stage.includes("prospect") || !stage) return "New";
  return "Contacted";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id as string | undefined;
  if (!orgId) return json({ error: "No Bylda organization found" }, 400);

  const encryptionKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  if (!encryptionKey) return json({ error: "Integration storage is not configured" }, 503);

  try {
    const { data: storedCredential, error: credentialError } = await admin.rpc(
      "get_user_integration",
      {
        _user_id: user.id,
        _integration_key: "salesforce",
        _encryption_key: encryptionKey,
      },
    );
    if (credentialError || typeof storedCredential !== "string" || !storedCredential) {
      return json({ error: "Connect your Salesforce account first" }, 400);
    }

    let oauth: SalesforceCredential;
    try {
      oauth = JSON.parse(storedCredential) as SalesforceCredential;
    } catch {
      return json({ error: "Reconnect Salesforce using secure sign-in." }, 400);
    }

    let accessToken = oauth.access_token ?? "";
    let instanceUrl = (oauth.instance_url ?? "").replace(/\/$/, "");
    if (!accessToken || !validInstanceUrl(instanceUrl)) {
      return json({ error: "Reconnect Salesforce to finish configuring the connection." }, 400);
    }

    const saveCredential = async () => {
      const { error } = await admin.rpc("set_oauth_integration", {
        _user_id: user.id,
        _integration_key: "salesforce",
        _token_payload: JSON.stringify(oauth),
        _account_label: oauth.external_account_id
          ? `Salesforce organization ${oauth.external_account_id}`
          : "Salesforce account",
        _external_account_id: oauth.external_account_id ?? "",
        _scopes: oauth.scope ?? [],
        _token_expires_at: null,
        _encryption_key: encryptionKey,
      });
      if (error) throw new Error("Could not securely store the refreshed Salesforce token");
    };

    const refreshAccessToken = async () => {
      const clientId = Deno.env.get("SALESFORCE_CLIENT_ID");
      const clientSecret = Deno.env.get("SALESFORCE_CLIENT_SECRET");
      if (!oauth.refresh_token || !clientId || !clientSecret) {
        throw new Error("Salesforce access expired. Reconnect the account.");
      }
      const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: oauth.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const refreshed = await response.json().catch(() => ({}));
      if (!response.ok || !refreshed.access_token) {
        throw new Error("Salesforce access expired. Reconnect the account.");
      }
      accessToken = String(refreshed.access_token);
      if (refreshed.instance_url && validInstanceUrl(String(refreshed.instance_url))) {
        instanceUrl = String(refreshed.instance_url).replace(/\/$/, "");
      }
      oauth = { ...oauth, access_token: accessToken, instance_url: instanceUrl };
      await saveCredential();
    };

    const salesforceFetch = async (path: string) => {
      const relativePath = path.startsWith("/") ? path : `/${path}`;
      let response = await fetch(`${instanceUrl}${relativePath}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      if (response.status === 401) {
        await refreshAccessToken();
        response = await fetch(`${instanceUrl}${relativePath}`, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
      }
      return response;
    };

    const versionsResponse = await salesforceFetch("/services/data/");
    if (!versionsResponse.ok) throw new Error("Could not read Salesforce API versions");
    const versions = (await versionsResponse.json()) as { version?: string; url?: string }[];
    const latest = versions
      .filter((version) => version.version && version.url)
      .sort((a, b) => Number(b.version) - Number(a.version))[0];
    if (!latest?.url) throw new Error("Salesforce did not return an available REST API version");

    const runQuery = async <T>(soql: string) => {
      const records: T[] = [];
      let path = `${latest.url}/query?q=${encodeURIComponent(soql)}`;
      while (path && records.length < 2000) {
        const response = await salesforceFetch(path);
        if (!response.ok) {
          const detail = await response.text();
          console.error("[sync-salesforce] query", response.status, detail.slice(0, 500));
          throw new Error(
            "Salesforce rejected a CRM data query. Check the connected user's permissions.",
          );
        }
        const result = (await response.json()) as QueryResult<T>;
        records.push(...(result.records ?? []));
        path = result.done ? "" : (result.nextRecordsUrl ?? "");
      }
      return records.slice(0, 2000);
    };

    const [contacts, opportunities] = await Promise.all([
      runQuery<SalesforceContact>(
        "SELECT Id, FirstName, LastName, Email, Phone, Title, Account.Name, LastModifiedDate FROM Contact ORDER BY LastModifiedDate DESC LIMIT 2000",
      ),
      runQuery<SalesforceOpportunity>(
        "SELECT Id, Name, StageName, Amount, CloseDate, Probability, Type, LeadSource, Account.Name, LastModifiedDate FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT 2000",
      ),
    ]);

    const now = new Date().toISOString();
    const contactRows = contacts.map((contact) => ({
      user_id: user.id,
      org_id: orgId,
      first_name: contact.FirstName ?? null,
      last_name: contact.LastName ?? null,
      email: contact.Email ?? null,
      phone: contact.Phone ?? null,
      company: contact.Account?.Name ?? null,
      status: "new",
      source: "Salesforce",
      tags: contact.Title ? [contact.Title] : [],
      custom_fields: { salesforce: { title: contact.Title ?? null } },
      external_source: "salesforce",
      external_id: contact.Id,
      updated_at: now,
    }));

    let contactsImported = 0;
    if (contactRows.length) {
      const { data, error } = await admin
        .from("contacts")
        .upsert(contactRows, { onConflict: "org_id,external_source,external_id" })
        .select("id");
      if (error) throw new Error(`Contact import failed: ${error.message}`);
      contactsImported = data?.length ?? contactRows.length;
    }

    const opportunityRows = opportunities.map((opportunity) => ({
      organization_id: orgId,
      user_id: user.id,
      name: opportunity.Name ?? "Salesforce opportunity",
      company: opportunity.Account?.Name ?? null,
      stage: byldaStage(opportunity.StageName),
      source: opportunity.LeadSource ?? "Salesforce",
      value: opportunity.Amount ?? null,
      external_source: "salesforce",
      external_id: opportunity.Id,
      external_data: {
        salesforce_stage: opportunity.StageName ?? null,
        close_date: opportunity.CloseDate ?? null,
        probability: opportunity.Probability ?? null,
        type: opportunity.Type ?? null,
      },
      updated_at: now,
    }));

    let opportunitiesImported = 0;
    if (opportunityRows.length) {
      const { data, error } = await admin
        .from("leads")
        .upsert(opportunityRows, { onConflict: "organization_id,external_source,external_id" })
        .select("id");
      if (error) throw new Error(`Opportunity import failed: ${error.message}`);
      opportunitiesImported = data?.length ?? opportunityRows.length;
    }

    return json({
      ok: true,
      contacts_received: contacts.length,
      contacts_imported: contactsImported,
      opportunities_received: opportunities.length,
      opportunities_imported: opportunitiesImported,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Salesforce sync failed";
    console.error("[sync-salesforce]", message);
    const status = message.includes("Reconnect") || message.includes("expired") ? 401 : 500;
    return json({ error: message }, status);
  }
});
