"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/ui";

const links = [
  { href: "/", label: "Resumo" },
  { href: "/rooms", label: "Cômodos" },
  { href: "/orders", label: "Pedidos" },
];

export function Nav({ email }: { email: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-2 pb-4 pt-2 sm:px-4">
      <Link href="/" aria-label="Casa Nova, página inicial">
        <Logo />
      </Link>
      <nav aria-label="Principal" className="order-last flex w-full justify-center gap-6 sm:order-0 sm:w-auto">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={`border-b-2 py-1 text-sm font-medium ${
              isActive(l.href) ? "border-primary text-foreground" : "border-transparent text-foreground/80 hover:border-primary/40"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <form action={logout} className="flex items-center gap-3">
        <span className="hidden text-sm text-muted md:inline">{email}</span>
        <button type="submit" className="btn">
          Sair
        </button>
      </form>
    </header>
  );
}
