import { supabase } from "../core/db";

/** REAL — Supabase auth (the same client src/lib/auth.tsx listens to). */
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}
export async function signUp(email: string, password: string, fullName: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/welcome/verify`,
    },
  });
  if (error) throw new Error(error.message);
}
export async function sendReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/welcome/forgot`,
  });
  if (error) throw new Error(error.message);
}
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw new Error(error.message);
}
