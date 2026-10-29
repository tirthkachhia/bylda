import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { guestStore } from "@/lib/guest";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  onboarding_complete: boolean;
};

type OrgSummary = { id: string; name: string; owner_id: string };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  currentOrgId: string | null;
  currentOrg: OrgSummary | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentOrg, setCurrentOrg] = useState<OrgSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const identity = useRef<string | null>(null);
  const profileRequest = useRef(0);

  const loadProfile = async (userId: string) => {
    const request = ++profileRequest.current;
    const [profileResult, memberResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, onboarding_complete")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("organization_members")
        .select("organization_id, organizations(id, name, owner_id)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    // A late response for the previous identity must not restore its workspace.
    if (identity.current !== userId || profileRequest.current !== request) return;
    const prof = profileResult.data;
    const member = memberResult.data;
    setProfile(prof ?? null);

    if (member) {
      setCurrentOrgId(member.organization_id);
      const org = (member as { organizations?: OrgSummary | OrgSummary[] }).organizations;
      const orgObj = Array.isArray(org) ? org[0] : org;
      setCurrentOrg(orgObj ?? null);
    } else {
      setCurrentOrgId(null);
      setCurrentOrg(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Retired demo state must never replace an authenticated MVP identity.
    guestStore.disable();
    let active = true;
    let authEvent = 0;
    const invalidateProfileRequest = () => {
      ++profileRequest.current;
    };
    const applySession = (sess: Session | null) => {
      if (!active) return;
      const nextId = sess?.user.id ?? null;
      const changedIdentity = identity.current !== nextId;
      if (changedIdentity) {
        ++profileRequest.current;
        setProfile(null);
        setCurrentOrgId(null);
        setCurrentOrg(null);
      }
      identity.current = nextId;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess?.user) {
        setLoading(false);
        return;
      }
      if (changedIdentity) setLoading(true);
      // Defer Supabase queries outside the auth callback to avoid its lock.
      setTimeout(() => {
        if (active && identity.current === nextId)
          void loadProfile(sess.user.id).catch(() => {
            if (active && identity.current === nextId) setLoading(false);
          });
      }, 0);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      ++authEvent;
      applySession(sess);
    });

    // Then existing session
    const beforeRead = authEvent;
    void supabase.auth
      .getSession()
      .then(({ data: { session: sess } }) => {
        if (authEvent === beforeRead) applySession(sess);
      })
      .catch(() => {
        if (active && authEvent === beforeRead) setLoading(false);
      });

    return () => {
      active = false;
      identity.current = null;
      invalidateProfileRequest();
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, currentOrgId, currentOrg, loading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
