import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load local env (DATABASE_URL / DIRECT_URL) for CLI commands.
config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    // Use the DIRECT (non-pooled) connection for migrations.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  // We manage the auth schema (Supabase) and RLS via a custom SQL migration,
  // so keep drizzle focused on the public schema only.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
