// Opens every deep-link template with a sample input and writes status + lastVerified into tools.json.
//   node registry/linkcheck.mjs            (then: node registry/sync.mjs)
// status "ok" means the page answered 2xx/3xx with the sample input. It does NOT prove the input was prefilled:
// open the printed URLs by hand once and look. Internal tools are skipped; API tools are checked by the proxy tests.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { buildLink, valueFor } = require("./buildLink.js");

const SAMPLE = {
  image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Fronalpstock_big.jpg/800px-Fronalpstock_big.jpg",
  url: "https://ikon.mn/",
  domain: "ikon.mn",
  text: "вакцин чип",
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const today = new Date().toISOString().slice(0, 10);

const path = join(here, "tools.json");
const tools = JSON.parse(readFileSync(path, "utf8"));
for (const t of tools) {
  if (t.open.mode !== "deeplink") continue;
  const link = buildLink(t, valueFor(t, SAMPLE));
  let code = 0, note = "";
  try {
    const r = await fetch(link.url, { redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    code = r.status;
  } catch (e) {
    note = e.cause?.code || e.name;
  }
  // 403/429 from bot protection still means the page exists, and TLS/timeout errors can come from the local
  // network (antivirus, proxy): both stay "unverified". Only a real HTTP error or an unknown host is "broken".
  const dead = (code >= 400 && code !== 403 && code !== 429) || note === "ENOTFOUND";
  t.status = code >= 200 && code < 400 ? "ok" : dead ? "broken" : "unverified";
  t.lastVerified = today;
  console.log(`${t.status.padEnd(10)} ${String(code || note).padEnd(12)} ${t.id.padEnd(20)} ${link.url.slice(0, 110)}`);
}
writeFileSync(path, JSON.stringify(tools, null, 2) + "\n");
console.log("\nwrote", path, "- now run: node registry/sync.mjs");
