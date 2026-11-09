import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` works fully offline (no DB connection) — which is how
 * migrations are produced here. They are then applied to CranL through
 * `POST /api/v1/databases/{id}/migrations`, so the DB password never has to
 * exist in this environment (see ADR-001 §17).
 */
export default defineConfig({
  schema: "./src/db/sql/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://unused:unused@localhost:5432/unused",
  },
});
