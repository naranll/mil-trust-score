// Copies the registry into the extension (Chrome cannot load files outside the unpacked folder).
// Run after any edit:  node registry/sync.mjs        Check only (CI / tests):  node registry/sync.mjs --check
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "..", "extension", "registry");
export const FILES = ["tools.json", "mongolia.json", "lessons.json", "measurement.json", "buildLink.js"];

const { validateRegistry } = createRequire(import.meta.url)("./validate.js");
const errors = validateRegistry(JSON.parse(readFileSync(join(here, "tools.json"), "utf8")));
if (errors.length) {
  console.error("tools.json is invalid:\n  " + errors.join("\n  "));
  process.exit(1);
}

const check = process.argv.includes("--check");
let stale = [];
mkdirSync(dest, { recursive: true });
for (const f of FILES) {
  const src = join(here, f);
  if (!existsSync(src)) continue;
  const body = readFileSync(src, "utf8");
  const out = join(dest, f);
  const same = existsSync(out) && readFileSync(out, "utf8") === body;
  if (same) continue;
  if (check) stale.push(f);
  else writeFileSync(out, body);
}
if (check && stale.length) {
  console.error(`extension/registry is out of date: ${stale.join(", ")}. Run: node registry/sync.mjs`);
  process.exit(1);
}
console.log(check ? "extension/registry is in sync" : `synced ${FILES.length} files to extension/registry`);
