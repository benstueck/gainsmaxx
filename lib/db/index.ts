import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/*
  Server-side Drizzle client (postgres-js).
  Lazy singleton so importing this module never requires DATABASE_URL at build
  time — the connection is created on first use. Cached on globalThis to avoid
  exhausting connections across HMR reloads in dev.

  `prepare: false` is required when connecting through Supabase's transaction-mode
  connection pooler (pgbouncer). Use the pooled DATABASE_URL for the app.
*/

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __gm_client?: ReturnType<typeof postgres>;
  __gm_db?: Db;
};

export function getDb(): Db {
  if (globalForDb.__gm_db) return globalForDb.__gm_db;

  // Prefer the pooled DATABASE_URL (best for serverless); fall back to the
  // direct DIRECT_URL so dev works with only the migration string configured.
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!url) {
    throw new Error(
      "Set DATABASE_URL (or DIRECT_URL) in .env.local — see .env.example.",
    );
  }

  const client = globalForDb.__gm_client ?? postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  globalForDb.__gm_client = client;
  globalForDb.__gm_db = db;
  return db;
}

export { schema };
