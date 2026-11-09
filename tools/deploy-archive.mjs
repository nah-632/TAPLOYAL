#!/usr/bin/env node
/**
 * tools/deploy-archive.mjs
 *
 * Deploys the current working tree to an existing CranL app as an archive,
 * via POST /api/v1/deploy-source. This is an alternative path to a Git deploy:
 * it does not depend on the repository integration, and it exercises a
 * different code path on the platform.
 *
 * Usage:
 *   node tools/deploy-archive.mjs --app <id> --plan     # preview, changes nothing
 *   node tools/deploy-archive.mjs --app <id> --deploy   # build and run
 */
import { execSync } from "node:child_process";
import { readFileSync, statSync, existsSync, unlinkSync } from "node:fs";

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
if (!APP) {
  console.error("usage: deploy-archive.mjs --app <app_id> [--plan|--deploy]");
  process.exit(2);
}

// Files the container build does not need. Mirrors .dockerignore.
const EXCLUDES = [
  "./node_modules",
  "./.next",
  "./.git",
  "./.test-build",
  "./.env",
  "./.env.local",
  "./docs",
  "./test",
];
const excludeFlags = EXCLUDES.map((e) => `--exclude='${e}'`).join(" ");

const archive = "/tmp/taployal-deploy.tar.gz";
if (existsSync(archive)) unlinkSync(archive);

execSync(
  `tar czf ${archive} ${excludeFlags} -C . .`,
  { stdio: "inherit", shell: "/bin/sh" },
);

const bytes = statSync(archive).size;
const b64 = readFileSync(archive).toString("base64");
console.log(`archive: ${(bytes / 1024).toFixed(0)} KB (base64 ${(b64.length / 1024).toFixed(0)} KB)`);
if (b64.length > 8 * 1024 * 1024) {
  console.error("✗ archive exceeds the 8 MB base64 limit");
  process.exit(1);
}

const body = {
  kind: "app",
  app_id: APP,
  archive_base64: b64,
  build: "dockerfile",
  port: 3000,
};

async function call(payload) {
  const res = await fetch(`${API}/deploy-source`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => null);
}

if (!process.argv.includes("--deploy")) {
  const preview = await call({ ...body, plan: true });
  console.log("preview:", JSON.stringify(preview).slice(0, 500));
  process.exit(preview?.error ? 1 : 0);
}

let result = await call({ ...body, wait: true, timeout_seconds: 900 });
if (result?.error?.code === "confirmation_required") {
  result = await call({
    ...body,
    wait: true,
    timeout_seconds: 900,
    confirm: result.error.details?.confirm_token,
  });
}

if (result?.error) {
  console.error("FAILED:", result.error.code, "-", result.error.message);
  process.exit(1);
}
console.log("deployment:", JSON.stringify(result).slice(0, 900));
