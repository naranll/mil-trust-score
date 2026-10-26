# API contract

Base URL in development: `http://127.0.0.1:8000`. Interactive docs when the server is running: `/docs`.
CORS allows only the Chrome extension (`chrome-extension://…`) and local dev pages (`http://localhost:*`,
`http://127.0.0.1:*`), so no random web page can post fake feedback. A deployed website must be listed in the
`HM_CORS_ORIGINS` environment variable (comma separated origins).

All user-facing strings (`label`, `risks`, `summary`, …) are Mongolian (Cyrillic).

## POST `/score` — one page (websites, news articles)

Request
```json
{ "url": "https://example.mn/a", "title": "…", "text": "…", "links": ["https://…"],
  "images": [], "author": "optional", "published_date": "2026-10-20" }
```
Response
```json
{ "score": 22, "zone": "red",
  "reasons": [ { "code": "domain_lookalike", "label": "Алдартай мэдээллийн сайтыг дуурайсан нэртэй", "points": -25 } ],
  "disclaimer": "Энэ оноо бүрэн найдвартай биш. Эх сурвалжийг өөрөө шалгаарай." }
```
`reasons` has at most 3 items. `code` is stable and is also the MIL card id. `points` is the contribution to
the score (negative lowers it). Score = clamp(60 + Σ weight·strength, 0, 100).

## POST `/score/posts` — a batch of Facebook posts (trained model)

Request (up to 50 items per call)
```json
{ "items": [ { "id": "hm1", "text": "post text", "url": null, "author": "Page name",
               "author_url": "https://www.facebook.com/slug", "verified": false, "image_text": "",
               "sponsored": false, "has_cta": false, "link_title": null, "image_url": null } ] }
```
`author`/`author_url` are used only to match the trusted-pages list and are never stored. `sponsored`, `has_cta`
(ad buttons) and `link_title` (link preview title) help the post-type classifier and the caption-vs-link check.

Each post is first classified (`post_type`): **claim**, **ad**, **commerce** or **personal**. The response shape
depends on it. Every result has `id`, `status` and (when classified) `post_type`.

**claim** → trust score from the trained scorecard
```json
{ "id": "hm1", "status": "ok", "post_type": "claim", "trust": 98, "zone": "green", "summary": "…",
  "risks": ["…"], "trust_signals": ["…"], "card": "MIL card title", "guardrail": false,
  "source": "trusted|lookalike|verified|unknown", "source_unverified": false,
  "text_only_trust": 98, "factcheck": null }
```
When `ANTHROPIC_API_KEY` is set the batch is scored by Claude first (text + `image_url`), and results carry
`"scorer": "llm"`, `"model"`, and `trust` on ad results too; evidence items keep a post-specific `why`.
Posts Claude could not score fall back to the trained scorecard. Details: `extension/backend/README.md` → LLM scoring.

Green needs a verified source (registered page, or a registered site's link that matches the caption). Clean text
from an unknown source is capped at yellow 69 (`source_unverified: true`).

**ad / commerce** → no 0–100 score; a scam-signal check instead
```json
{ "id": "x", "status": "ok", "post_type": "ad", "type_why": "…", "zone": "ad_scam|ad_check|ad_ok",
  "summary": "…", "scam": [{"id": "ad_prepay", "found": "…", "text": "…"}], "legit": [{"id": "…", "text": "…"}],
  "factcheck": null, "source": "unknown" }
```
**personal** → `{"status": "skip", "post_type": "personal", "why": "…"}`: show nothing.

`status` is `ok`, `skip` (too short / not Cyrillic / not a claim: show nothing) or `error` (show nothing, never
block the user). When `factcheck` is set it holds `{claim, url, verdict, date, by, strong}`: the post resembles a
claim already refuted by `by` (MFCC or factcheck.mn); link to `url`. Results may also carry knowledge-base fields
added by `kb.enrich` (explanations, "how to check" links) from `data/reference/knowledge.json`.

## Feedback

- `POST /feedback` `{url, score_shown, user_says: too_low|too_high|wrong_reason, comment?}` → `{"saved": true}`
- `POST /feedback/posts` `{text, image_text?, url?, user_label: true|false|not_claim|unsure|wrong_type, trust?,
  zone?, post_type?}` → `{"ok": true, "count": n}`. Extra fields (e.g. author) are ignored and not stored.

## Other

- `GET /health` → `{"ok": true, "model": "scorecard v4" | "unavailable", "model_error": null | "…"}`
- `GET /score/mock?zone=red|yellow|green` → a fixed `/score` response, for frontend work without the model
- `GET /demo` → demo Facebook feed page; `GET /demo/fb` → test page mimicking Facebook's real DOM structure

## Planned (not implemented yet)

`POST /score/image` (screenshot scanner, OCR + text analysis), `GET /sources` (curated outlet directory),
`GET /stats` (anonymous aggregates for Data Viz, only after the logging design is approved),
an `explanation` field on reasons (psychological meaning), and `zone_label_mn` / `zone_icon` helpers so every
client renders label + icon + color from one place.
