import { supabase } from "../core/db";

/** REAL — the viewer's notifications (RLS: user_id = auth.uid()). */
export async function fetchNotifications(userId: string) {
  const res = await supabase
    .from("notifications")
    .select("id,type,message,read,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function markRead(id: string) {
  const res = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}
