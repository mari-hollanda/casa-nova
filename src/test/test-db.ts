import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const USER_A = "11111111-1111-1111-1111-111111111111";
export const USER_B = "22222222-2222-2222-2222-222222222222";

/**
 * Cria um Postgres em memória (PGlite) com um stub mínimo do schema `auth` do Supabase
 * e aplica as migrations reais da pasta /drizzle.
 */
export async function createMigratedPglite(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');
  `);

  const dir = path.resolve(__dirname, "../../drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    for (const statement of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await pg.exec(statement);
    }
  }
  await pg.exec("grant select, insert, update, delete on all tables in schema public to authenticated;");
  return pg;
}
