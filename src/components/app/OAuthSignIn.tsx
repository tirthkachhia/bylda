import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
export function OAuthSignIn({
  provider,
  redirect = "/app",
}: {
  provider: "google" | "azure";
  redirect?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className="figma-button"
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          const path =
            /^\/app(?:\/|\?|$)/.test(redirect) || redirect === "/onboarding" ? redirect : "/app";
          void supabase.auth
            .signInWithOAuth({
              provider,
              options: {
                redirectTo: new URL(path, window.location.origin).toString(),
                ...(provider === "azure" ? { scopes: "email" } : {}),
              },
            })
            .then(({ error }) => {
              if (error) throw error;
            })
            .catch((e) => {
              setError(e.message);
              setBusy(false);
            });
        }}
      >
        {busy ? "Connecting…" : `Continue with ${provider === "azure" ? "Microsoft" : "Google"}`}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
