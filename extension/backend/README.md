# extension/backend/: checker + thin proxy (FastAPI)

**Owner: API member.** The one server the extension (and later the website) talks to. Signals, never a score:
see [`CLAUDE.md`](../../CLAUDE.md) section 2. It imports [`model/`](../../model/README.md) and reads
[`data/reference/`](../../data/README.md) and [`registry/`](../../registry/README.md).

```
app/
├── main.py            app, CORS, /health, /demo, POST /api/check/page
├── posts.py           POST /api/check (user pressed "send for deeper check"), /feedback/posts (off by default)
├── signals.py         raw scorer output -> public shape: signals | factcheck | not_assessed. Drops every number.
├── llm_score.py       optional Claude reader: quoted signals, no score (ANTHROPIC_API_KEY)
├── proxy.py           /api/wayback, /api/rdap, /api/registry: cache, timeouts, link fallbacks
├── guard.py           install-id rate limit, URL / domain validation (http/https, no private IPs)
├── scorecard.py       page rules -> signals + context (no weights shown)
├── model_adapter.py   lazy bridge to model/ (hm_core, post_types, kb)
├── features/          domain.py, text.py
└── config.py          paths
tools/build_demo_cache.py   writes extension/demo-cache.json for the offline demo
tests/                      pytest; test_check.py fails if any score/zone/verdict key appears in a response
```

## Run

From the repo root:

```bash
pip install -r extension/backend/requirements.txt
python -m uvicorn extension.backend.app.main:app --port 8000
python -m pytest extension/backend/tests -q
```

API contract: [`docs/API.md`](../../docs/API.md) · auto docs: http://localhost:8000/docs

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `HM_CHECK_LIMIT` | `60` | `/api/check` calls per install id per 10 min |
| `HM_PROXY_TIMEOUT` | `5` | upstream timeout, seconds |
| `HM_EXTENSION_IDS` | empty | comma-separated extension ids allowed by CORS (default: any `chrome-extension://` id) |
| `HM_CORS_ORIGINS` | empty | website origins allowed by CORS |
| `HM_FEEDBACK` | `0` | `1` enables `/feedback/posts` (team labelling sessions only) |
| `ANTHROPIC_API_KEY` | empty | enables the Claude reader for `/api/check` |
| `HM_LLM` | `1` | `0` turns the Claude reader off even with a key |
| `HM_LLM_MODEL` / `HM_LLM_EFFORT` | `claude-opus-5-5` / `low` | Claude model and effort |
| `WHOIS_ENABLED` | `1` | `0` disables WHOIS in page checks |
| `HM_ARTIFACTS_DIR`, `HM_REFERENCE_DIR`, `HM_FEEDBACK_DIR` | repo paths | overrides |

## The Claude reader

With `ANTHROPIC_API_KEY` set, `/api/check` sends the posts the user asked about to Claude in one request: text,
image text, the first image (by URL), link domain and title, plus two facts from the trained model (registered-page
list match; match against MFCC / factcheck.mn checks). Claude returns the post kind and up to 3 signals with exact
quotes; quotes not found in the post are dropped. It gives **no score** and may return no signals. Output carries
`notes: ["llm_unvalidated"]`: it has not been measured on Mongolian posts. On any failure the trained rules answer.
Author names are not sent to Anthropic; post text and image are.

## Measurement

`python model/tools/measure_signals.py` runs `/api/check`'s code path (Claude off) on the held-out test split and
writes `registry/measurement.json`. 2026-10-26: badges on 3 of 88 true news items (3%, 95% CI 1–10%). Caveats are in
the file: all true items are news articles, not Facebook posts; the fact-check index contains the test items.
