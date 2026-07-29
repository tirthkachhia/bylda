import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  useGuest,
  guestStore,
  isDemoEmail,
  GUEST_USER,
  GUEST_ORG_ID,
  GUEST_ORG,
} from "@/lib/guest";
import { useImpersonation } from "@/lib/impersonation";

function syncDemoMode(email: string | null | undefined) {
  if (isDemoEmail(email)) guestStore.enable();
  else guestStore.disable();
}

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  onboarding_complete: boolean;
};

type OrgSummary = { id: string; name: string };

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

  const loadProfile = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, email, full_name, onboarding_complete")
      .eq("id", userId)
      .maybeSingle();
    setProfile(prof ?? null);

    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(id, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (member) {
      setCurrentOrgId(member.organization_id);
      const org = (member as { organizations?: OrgSummary | OrgSummary[] }).organizations;
      const orgObj = Array.isArray(org) ? org[0] : org;
      setCurrentOrg(orgObj ?? null);
    } else {
      setCurrentOrgId(null);
      setCurrentOrg(null);
    }
  };

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      syncDemoMode(sess?.user?.email);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => {
          void loadProfile(sess.user.id);
        }, 0);
      } else {
        setProfile(null);
        setCurrentOrgId(null);
        setCurrentOrg(null);
      }
    });

    // Then existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      syncDemoMode(sess?.user?.email);
      if (sess?.user) void loadProfile(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
  const { isGuest } = useGuest();
  const imp = useImpersonation();
  if (isGuest) {
    return {
      ...ctx,
      session: null,
      user: { id: GUEST_USER.id, email: GUEST_USER.email } as unknown as User,
      profile: {
        id: GUEST_USER.id,
        email: GUEST_USER.email,
        full_name: GUEST_USER.full_name,
        onboarding_complete: true,
      },
      currentOrgId: GUEST_ORG_ID,
      currentOrg: { id: GUEST_ORG_ID, name: GUEST_ORG.name },
      loading: false,
    };
  }
  // Admin impersonation: keep the real admin session/JWT (so is_admin() RLS still
  // applies), but point the app's user/org context at the target account so every
  // org-/user-scoped query and mutation targets that account.
  if (imp.active && imp.userId) {
    return {
      ...ctx,
      user: ctx.user ? ({ ...ctx.user, id: imp.userId } as User) : ctx.user,
      profile: ctx.profile ? { ...ctx.profile, id: imp.userId } : ctx.profile,
      currentOrgId: imp.orgId ?? ctx.currentOrgId,
      currentOrg: imp.orgId ? { id: imp.orgId, name: imp.label ?? "Account" } : ctx.currentOrg,
    };
  }
  return ctx;
}
