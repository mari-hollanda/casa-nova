import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
}

/**
 * Autoriza a requisição no servidor. Usa getUser(), que valida o token junto ao Supabase Auth
 * (não confia apenas no cookie). Se OWNER_EMAIL estiver definido, só essa conta é aceita,
 * mesmo que outro usuário venha a existir no projeto Supabase.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (owner && data.user.email.toLowerCase() !== owner) return null;

  return { id: data.user.id, email: data.user.email };
}

/** Para páginas e actions: redireciona ao login se não houver usuário autorizado. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
