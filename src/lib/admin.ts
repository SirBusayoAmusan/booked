import "server-only";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";

export async function requireAdmin() {
  const { supabase, user } = await getUser();
  if (!user) notFound();
  const { data } = await supabase.from("profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!data?.is_admin) notFound();
  return user;
}
