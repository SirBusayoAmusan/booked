import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Business, Profile } from "@/lib/types";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser(next = "/home") {
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

export async function getProfile(): Promise<Profile | null> {
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  return (data as Profile) ?? null;
}

// Loads a business the signed-in user owns. RLS makes another owner's
// business invisible, so a foreign id is a 404, not a 403.
export async function requireBusiness(id: string) {
  const { supabase, user } = await requireUser(`/business/${id}/today`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  return { supabase, user, business: data as Business, profile: profile as Profile };
}
