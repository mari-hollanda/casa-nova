import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão do Supabase e faz o redirecionamento otimista para /login.
 * Isto é só uma conveniência: a autorização de verdade acontece em requireUser(),
 * em cada página e Server Action.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const email = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : null;
  // Mesma regra de getCurrentUser(): evita loop /login ↔ / quando a conta logada não é a do dono.
  const isLoggedIn = Boolean(data?.claims) && (!owner || email === owner);
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
