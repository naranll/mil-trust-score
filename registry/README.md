# registry/: one tool list for the extension and the website

Single source of truth for the side panel and the website hub. Data only: no code runs from here remotely.

| File | What |
|---|---|
| `tools.json` | tool entries (`ToolEntry`, CLAUDE.md 3.1) with English + `mn` text. Every entry has `limits`. |
| `schema.json` | JSON Schema for `tools.json` |
| `validate.js` | dependency-free validator (same rules), used by tests and `sync.mjs` |
| `buildLink.js` | `buildLink(tool, input)`: http/https only, max 2,048 chars, `encodeURIComponent`, homepage fallback. Also `detectInput`, `valueFor`. Works as a browser `<script>` (`HMRegistry`) and in Node. |
| `mongolia.json` | Mongolia sources card (CLAUDE.md 5.2); `verified: false` items still need a human check |
| `lessons.json` | SIFT (Mike Caulfield, CC BY 4.0), IFCN five commitments, 30-second tactic cards |

```bash
node registry/linkcheck.mjs              # opens every deep-link template with a sample; writes status + lastVerified
node registry/sync.mjs                   # validates, then copies into extension/registry (Chrome can't load ../)
node --test "registry/test/*.test.js"    # buildLink, validator, sync check
```

`status: "ok"` means the page loaded with the sample input. It does **not** prove the input was prefilled: open the
URLs printed by `linkcheck.mjs` once by hand. TLS errors and bot walls (403/429) stay `unverified`, since they can
come from the local network. Templates without `{U}` open the homepage and the UI offers the input with a copy button.
Do not guess URL parameter formats.

The website should import `tools.json` + `buildLink.js` at build time (same files) rather than copy entries.
