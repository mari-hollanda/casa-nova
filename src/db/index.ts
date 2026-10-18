import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não está definida (veja .env.example)");

// Evita abrir uma conexão nova a cada hot reload em desenvolvimento.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

// prepare:false é necessário com o pooler de transações do Supabase (porta 6543).
const client = globalForDb.pgClient ?? postgres(url, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
