// Validates registry/tools.json against the ToolEntry contract (schema.json says the same in JSON Schema).
// Dependency-free so it runs in `node --test` and in the link checker without npm install.
"use strict";

const ENUMS = {
  categories: ["images", "video", "claims", "sources", "archives", "ai-signals", "geolocation", "documents", "habits"],
  audiences: ["journalist", "editor", "researcher", "office"],
  input: ["url", "image_url", "text", "claim", "domain", "none"],
  cost: ["free", "free-with-signup", "paid", "unknown"],
  status: ["ok", "unverified", "broken"],
  adapter: ["wayback", "factcheck", "checker", "c2pa", "rdap"],
  mode: ["deeplink", "api", "internal"],
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const https = (s) => typeof s === "string" && /^https?:\/\/\S+$/.test(s);
const str = (s) => typeof s === "string" && s.trim().length > 0;

function validateTool(t) {
  const e = [];
  const need = (cond, msg) => { if (!cond) e.push(`${t && t.id ? t.id : "?"}: ${msg}`); };
  need(t && typeof t === "object", "not an object");
  if (!t || typeof t !== "object") return e;
  need(/^[a-z0-9-]+$/.test(t.id || ""), "id must be kebab-case");
  for (const k of ["name", "description", "limits"]) need(str(t[k]), `${k} is required`);
  need(t.limits && t.limits.length >= 20, "limits must say, in words, what the tool cannot tell you");
  need(Array.isArray(t.categories) && t.categories.length && t.categories.every((c) => ENUMS.categories.includes(c)), "bad categories");
  need(Array.isArray(t.audiences) && t.audiences.length && t.audiences.every((c) => ENUMS.audiences.includes(c)), "bad audiences");
  need(ENUMS.input.includes(t.input), "bad input");
  need(ENUMS.cost.includes(t.cost), "bad cost");
  need(typeof t.needsLogin === "boolean", "needsLogin must be boolean");
  need(ENUMS.status.includes(t.status), "bad status");
  need(t.lastVerified === "" || ISO_DATE.test(t.lastVerified), "lastVerified must be YYYY-MM-DD or empty");
  need(t.status !== "ok" || ISO_DATE.test(t.lastVerified), "status ok needs a lastVerified date");
  need(https(t.sourceUrl), "sourceUrl must be http(s)");
  const o = t.open || {};
  need(ENUMS.mode.includes(o.mode), "open.mode");
  if (o.mode === "deeplink") {
    need(https(o.template.replace("{U}", "x")), "template must be http(s)");
    need(https(o.fallbackUrl), "fallbackUrl must be http(s)");
    need(!o.template.includes("{U}") || t.input !== "none", "a {U} template needs an input");
  }
  if (o.mode === "api") need(ENUMS.adapter.includes(o.adapter), "bad adapter");
  if (o.mode === "internal") need(str(o.route), "internal route");
  if (t.mn) for (const k of ["name", "description", "limits"]) need(str(t.mn[k]), `mn.${k} is required when mn is given`);
  // Hard rule: no verdict words in user-facing tool copy
  const copy = [t.name, t.description, t.limits].join(" ").toLowerCase();
  need(!/\b(trust score|credibility score|fake news detector|verified true)\b/.test(copy), "verdict wording in copy");
  return e;
}

function validateRegistry(tools) {
  const errors = [];
  if (!Array.isArray(tools)) return ["tools.json must be an array"];
  const ids = new Set();
  for (const t of tools) {
    errors.push(...validateTool(t));
    if (ids.has(t.id)) errors.push(`${t.id}: duplicate id`);
    ids.add(t.id);
  }
  return errors;
}

module.exports = { validateTool, validateRegistry, ENUMS };
