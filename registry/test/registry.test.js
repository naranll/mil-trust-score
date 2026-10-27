// node --test registry/test/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { buildLink, valueFor, detectInput, MAX_URL } = require("../buildLink.js");
const { validateRegistry, validateTool } = require("../validate.js");

const root = path.join(__dirname, "..");
const tools = JSON.parse(fs.readFileSync(path.join(root, "tools.json"), "utf8"));
const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
const IMG = "https://upload.wikimedia.org/wikipedia/commons/a/b/c d.jpg?x=1&y=2";

test("tools.json is valid and every tool states its limits", () => {
  assert.deepEqual(validateRegistry(tools), []);
  assert.ok(tools.length >= 15 && tools.length <= 30);
});

test("validator rejects a tool without limits or with a javascript: template", () => {
  const bad = { ...byId["google-lens"], limits: "", open: { mode: "deeplink", template: "javascript:alert({U})", fallbackUrl: "https://x.org/" } };
  const errs = validateTool(bad).join(" ");
  assert.match(errs, /limits/);
  assert.match(errs, /template/);
});

test("Google Lens template encodes the image URL", () => {
  const r = buildLink(byId["google-lens"], IMG);
  assert.equal(r.prefilled, true);
  assert.equal(r.url, "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(IMG));
  assert.ok(!r.url.includes(" ") && !r.url.includes("&y=2"));
});

test("Yandex and TinEye templates", () => {
  assert.equal(buildLink(byId["yandex-images"], IMG).url, "https://yandex.com/images/search?rpt=imageview&url=" + encodeURIComponent(IMG));
  assert.equal(buildLink(byId["tineye"], IMG).url, "https://tineye.com/search?url=" + encodeURIComponent(IMG));
});

test("claim templates encode Cyrillic and reserved characters", () => {
  const r = buildLink(byId["mfcc-search"], "вакцин & чип #1");
  assert.equal(r.url, "https://mfcc.mn/?s=%D0%B2%D0%B0%D0%BA%D1%86%D0%B8%D0%BD%20%26%20%D1%87%D0%B8%D0%BF%20%231");
});

test("non-http input for a URL tool falls back to the homepage", () => {
  for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "file:///c:/x.jpg", "not a url"]) {
    const r = buildLink(byId["google-lens"], bad);
    assert.equal(r.url, "https://lens.google.com/");
    assert.equal(r.prefilled, false);
  }
});

test("over-long links fall back instead of being cut", () => {
  const r = buildLink(byId["google-search"], "я".repeat(MAX_URL));
  assert.equal(r.prefilled, false);
  assert.equal(r.error, "too_long");
  assert.equal(r.url, "https://www.google.com/");
});

test("homepage-only templates never pretend to be prefilled", () => {
  const r = buildLink(byId["saucenao"], IMG);
  assert.deepEqual(r, { url: "https://saucenao.com/", prefilled: false });
  assert.equal(buildLink(byId["wayback"], "https://x.mn"), null);   // api tools are not deep links
});

test("valueFor and detectInput", () => {
  assert.equal(valueFor(byId["whois"], { url: "https://www.ikon.mn/n/1" }), "ikon.mn");
  assert.equal(valueFor(byId["google-search"], { text: "abc" }), "abc");
  assert.equal(detectInput("https://scontent.xx.fbcdn.net/v/t39/abc?stp=dst").kind, "image_url");
  assert.equal(detectInput("https://ikon.mn/n/3abc").kind, "url");
  assert.equal(detectInput("ikon.mn").kind, "domain");
  assert.equal(detectInput("Вакцин дотор чип суулгасан").kind, "claim");
  assert.equal(detectInput("javascript:alert(1)").kind, "claim");
});

test("extension/registry is in sync with registry/", () => {
  execFileSync(process.execPath, [path.join(root, "sync.mjs"), "--check"], { stdio: "pipe" });
});
