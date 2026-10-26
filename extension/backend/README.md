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
| `ANTHROPIC_API_KEY` | empty | enables the LLM reader with Claude for `/api/check` |
| `GEMINI_API_KEY` | empty | enables the LLM reader with Gemini (free key: aistudio.google.com → Get API key) |
| `HM_LLM_PROVIDER` | auto | `claude` or `gemini` when both keys are set; otherwise the provider whose key is set |
| `HM_LLM` | `1` | `0` turns the LLM reader off even when a key is set |
| `HM_LLM_MODEL` | `claude-opus-5-5` / `gemini-3.5-flash-lite` | model used by the reader |
| `HM_LLM_EFFORT` | `low` | Claude only: `low` / `medium` / `high`, more effort = slower, more careful |
| `WHOIS_ENABLED` | `1` | `0` disables WHOIS in page checks |
| `HM_ARTIFACTS_DIR`, `HM_REFERENCE_DIR`, `HM_FEEDBACK_DIR` | repo paths | overrides |

## The LLM reader

With a key set, `/api/check` sends the posts the user asked about to the LLM in one request
([`app/llm_score.py`](app/llm_score.py)): text, image text, the first image, link domain and title, plus two facts
from the trained model (registered-page list match; match against MFCC / factcheck.mn checks). The LLM returns the
post kind and up to 3 signals with exact quotes; quotes not found in the post are dropped. It gives **no score** and
may return no signals. Output carries `notes: ["llm_unvalidated"]`: it has not been measured on Mongolian posts.
If the key is missing or a request fails (network, rate limit, refusal, bad JSON), the trained rules answer;
`/health` → `llm.error` shows the last failure. Results are cached in memory by content.
Gemini's free tier is often busy (503 / 504 / 429); the reader then retries once on `gemini-3.8-flash`.
A 4-post batch took about 30 s on flash-lite during testing, so "Send for deeper check" can take a while.

Privacy: author names are not sent, only the source kind; post text and image do go to the LLM provider. On the
Gemini free tier Google may use submitted content to improve its products: say so wherever the extension is shown.

Put the key in `extension/backend/.env` (git-ignored; copy [`.env.example`](.env.example)) so it works from any
shell, then start the server as usual:

```powershell
cd extensionackend
uvicorn app.main:app --port 8000
```

## Measurement

`python model/tools/measure_signals.py` runs `/api/check`'s code path (Claude off) on the held-out test split and
writes `registry/measurement.json`. 2026-10-26: badges on 3 of 88 true news items (3%, 95% CI 1–10%). Caveats are in
the file: all true items are news articles, not Facebook posts; the fact-check index contains the test items.
