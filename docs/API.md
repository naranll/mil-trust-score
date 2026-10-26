# API contract

Base URL in development: `http://127.0.0.1:8000`. Interactive docs when the server is running: `/docs`.
CORS is open (`*`) for the hackathon; restrict before a real deployment.

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
               "author_url": "https://www.facebook.com/slug", "verified": false, "image_text": "" } ] }
```
`author`/`author_url` are used only to match the trusted-pages list and are never stored.

Response
```json
{ "results": [ { "id": "hm1", "status": "ok", "trust": 98, "zone": "green", "summary": "…",
                 "risks": ["…"], "trust_signals": ["…"], "card": "MIL card title",
                 "guardrail": false, "source": "trusted|lookalike|verified|unknown",
                 "text_only_trust": 98, "factcheck": null } ] }
```
`status` is `ok`, `skip` (too short / not Cyrillic / no claim: show nothing) or `error` (show nothing, never block
the user). When `factcheck` is set it holds `{claim, url, verdict, date, by, strong}`: the post resembles a claim
already refuted by `by` (MFCC or factcheck.mn); link to `url`.

## Feedback

- `POST /feedback` `{url, score_shown, user_says: too_low|too_high|wrong_reason, comment?}` → `{"saved": true}`
- `POST /feedback/posts` `{text, image_text?, url?, user_label: true|false|not_claim, trust?, zone?}` →
  `{"ok": true, "count": n}`. Extra fields (e.g. author) are ignored and not stored.

## Other

- `GET /health` → `{"ok": true, "model": "scorecard v3.1" | "unavailable", "model_error": null | "…"}`
- `GET /score/mock?zone=red|yellow|green` → a fixed `/score` response, for frontend work without the model
- `GET /demo` → demo Facebook feed page

## Planned (not implemented yet)

`POST /score/image` (screenshot scanner, OCR + text analysis), `GET /sources` (curated outlet directory),
`GET /stats` (anonymous aggregates for Data Viz, only after the logging design is approved),
an `explanation` field on reasons (psychological meaning), and `zone_label_mn` / `zone_icon` helpers so every
client renders label + icon + color from one place.
