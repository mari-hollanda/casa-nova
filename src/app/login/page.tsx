import type { Metadata } from "next";
import { Logo, Sparkle } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-2 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo />
        <h1 className="flex items-center gap-2 text-4xl">
          Boas-vindas
          <Sparkle className="h-4 w-4 self-start text-primary" />
        </h1>
        <p className="hint">Acesso restrito.</p>
      </div>
      <LoginForm />
    </main>
  );
}
