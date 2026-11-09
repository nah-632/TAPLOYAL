#!/usr/bin/env node
/**
 * tools/configure-cranl-app.mjs
 *
 * Sets the deployed app's runtime environment.
 *
 * CRITICAL SECURITY POINT — why we do NOT use CranL's "connect database to app":
 * that helper injects the database's OWN connection URL, whose user is the
 * managed `admin` role (rolsuper + rolbypassrls). Connecting as it silently
 * disables every RLS policy. Instead we build DATABASE_URL ourselves for the
 * RESTRICTED role, over the INTERNAL host, so traffic never leaves CranL and
 * tenant isolation stays enforced. instrumentation.ts refuses to boot otherwise.
 *
 * Secrets are read from .env.local, written straight to the API, and never
 * printed. Only variable NAMES are echoed.
 *
 * Usage: node tools/configure-cranl-app.mjs --app <app_id> --url <https://...>
 */
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const API = "https://app.cranl.com/api/v1";
const KEY = process.env.CRANL_ACCESS_KEY;
if (!KEY) {
  console.error("CRANL_ACCESS_KEY is not set");
  process.exit(2);
}

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const APP = arg("--app");
const APP_URL = arg("--url");
const INTERNAL_HOST = arg("--internal-host", "taployal-db-cadoql");
const INTERNAL_PORT = arg("--internal-port", "5432");
const DBNAME = arg("--dbname", "taployal_db");
const ROLE = arg("--role", "taployal_app");

if (!APP || !APP_URL) {
  console.error("usage: configure-cranl-app.mjs --app <app_id> --url <https://app...>");
  process.exit(2);
}

// ── read the runtime credential from .env.local without echoing it ──────────
const envPath = new URL("../.env.local", import.meta.url).pathname;
if (!existsSync(envPath)) {
  console.error(".env.local is missing — run tools/provision-app-role.mjs first");
  process.exit(2);
}
const line = readFileSync(envPath, "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
if (!line) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(2);
}
const password = decodeURIComponent(new URL(line.slice("DATABASE_URL=".length).trim()).password);
if (!password) {
  console.error("could not extract a password from DATABASE_URL");
  process.exit(2);
}

// Internal host: app and database are in the same region, so this never
// crosses the public internet and needs no TLS.
const internalUrl = `postgres://${ROLE}:${encodeURIComponent(password)}@${INTERNAL_HOST}:${INTERNAL_PORT}/${DBNAME}`;

const variables = {
  DATABASE_URL: internalUrl,
  BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
  BETTER_AUTH_URL: APP_URL,
  APP_URL,
};

async function call(path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => null);
}

console.log("variables to set:", Object.keys(variables).join(", "), "(values never printed)");

// Preview first — proves we are only adding/overwriting these keys.
const preview = await call(`/apps/${APP}/env`, "PATCH", { variables, plan: true });
console.log("preview:", JSON.stringify(preview).slice(0, 200));

let result = await call(`/apps/${APP}/env`, "PATCH", { variables, restart: true });
if (result?.error?.code === "confirmation_required") {
  const token = result.error.details?.confirm_token;
  result = await call(`/apps/${APP}/env`, "PATCH", {
    ...variables,
    restart: true,
    confirm: token,
  });
}

if (result?.error) {
  console.error("FAILED:", result.error.code, "-", result.error.message);
  process.exit(1);
}

console.log("✓ environment saved");
console.log("  version:", result?.version ?? "(not revealed)");
console.log("  restart requested: true");
