# API contract

Base URL in development: `http://127.0.0.1:8000`. Interactive docs when the server is running: `/docs`.

**Signals, not verdicts.** No endpoint returns a score, a zone, a true/false label or any composite number.
`tests/test_check.py::test_no_score_or_verdict_anywhere` fails if one comes back.

CORS allows the Chrome extension (`chrome-extension://<32-letter id>`, narrowed with `HM_EXTENSION_IDS`) and local
dev pages (`http://localhost:*`, `http://127.0.0.1:*`). A deployed website goes in `HM_CORS_ORIGINS`.
Every client sends `X-Install-Id` (random UUID made once by the extension, no account). Rate limits count by it.

## POST `/api/check`: "send for deeper check" (Facebook posts)

Called **only** after the user presses the button in the side panel. Up to 20 items per call.

```json
{ "items": [ { "id": "hm1", "text": "post text", "image_text": "", "url": null,
               "author": "Page name", "author_url": "https://www.facebook.com/slug", "verified": false,
               "sponsored": false, "has_cta": false, "link_title": null, "image_url": null } ] }
```
`author`/`author_url` only match the registered-pages list; they are never stored or logged. `image_url` is used only
by the Claude reader (when enabled).

Response: one result per item.
```json
{ "id": "hm1",
  "state": "signals | factcheck | not_assessed",
  "checked": true,
  "why_not": "no_signals_found | too_short | not_mongolian | personal_post | no_text | could_not_check",
  "post_type": "claim | ad | commerce | personal",
  "scorer": "rules+model | llm",
  "signals": [ { "id": "urgency", "text": "Яаруулж, тараахыг шахаж байна", "found": "ЯАРАЛТАЙ",
                 "why": "…", "model_guess": false } ],
  "context": [ { "id": "page_registered" } ],
  "factcheck": { "publisher": "MFCC", "headline": "publisher's own headline, verbatim", "claim": "…",
                 "url": "https://mfcc.mn/…", "date": "2021-01-20", "match": "close" },
  "notes": ["llm_unvalidated", "translit", "from_image"],
  "reflect": { "ask": "…" }, "check_links": [ { "title": "…", "url": "…" } ], "laws": [ "verified rows only" ] }
```

- `signals`: at most 3, each with the exact words found (`found`) when the signal is about wording.
  `model_guess: true` marks the text classifier's guess; it is listed last and never sets the state on its own.
- `factcheck`: set when the post closely matches a claim checked by MFCC or factcheck.mn (local index). `headline`
  is the publisher's own words; we do not show our own label for it. `match` describes text similarity only.
- `not_assessed` with `checked: true` means we looked at the wording and found nothing to point at.
  It is **not** a clean result.

## POST `/api/check/page`: rule signals for a news article / web page

```json
{ "url": "https://example.mn/a", "title": "…", "text": "…", "links": ["https://…"], "author": null, "published_date": "2026-10-20" }
```
→ `{ "state": "signals | not_assessed", "signals": [{"code", "label"}], "context": [{"code", "label"}], "disclaimer": "…" }`

## Proxy (context cards)

All return HTTP 200 with `ok`. On failure: `{ "ok": false, "reason": "…", "fallback_url": "…" }` so the client can
show a plain link instead of an error. Header `X-Cache: HIT | MISS`. Upstream timeout 5 s.

| Endpoint | Upstream | Cache | Notes |
|---|---|---|---|
| `GET /api/wayback?url=` | archive.org availability API (2 calls: latest, earliest) | 1 h | http/https only, private IPs refused. After a 429 it backs off 1→16 min. |
| `GET /api/rdap?domain=` | rdap.org | 24 h | `.mn` has no RDAP record there: `reason: no_rdap_for_tld` + WHOIS link. |
| `GET /api/registry` | `registry/*.json` | none | Data only. |

## Feedback (off by default)

`POST /feedback/posts` `{text, image_text?, url?, user_label: true|false|not_claim|unsure|wrong_type, state?, post_type?}`
is disabled unless `HM_FEEDBACK=1` (e.g. a team labelling session). Author names are never stored.

## Other

- `GET /health` → `{ ok, model, model_error, llm, feedback }`
- `GET /demo`, `GET /demo/fb` → demo feed pages for the extension

Removed in 0.3: `POST /score`, `POST /score/posts`, `GET /score/mock`, `POST /feedback` (all returned scores).
Not used (team decision 2026-10-26): the Google Fact Check Tools API. Fact-check matches come from the local
MFCC / factcheck.mn index in `/api/check`; the sidebar links to Fact Check Explorer for anything else.
