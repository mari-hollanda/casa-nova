import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations usam a conexão direta (ou o pooler em modo sessão), não o pooler de transações.
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
  entities: { roles: { provider: "supabase" } },
  strict: true,
  verbose: true,
});
