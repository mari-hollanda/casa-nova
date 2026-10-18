"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

const credentials = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const generic = { error: "E-mail ou senha inválidos." };
  // Recusa antes de tentar autenticar qualquer conta que não seja a do dono.
  if (owner && parsed.data.email.toLowerCase() !== owner) return generic;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return generic;

  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
