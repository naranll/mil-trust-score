# backend/ — scoring API (FastAPI)

**Owner: API / mobile-scanner member.** The one server the extension and the website talk to. It does not hold
model code or data itself: it imports [`model/hm_core.py`](../model/README.md) and reads
[`data/reference/`](../data/README.md).

```
backend/
├── app/
│   ├── main.py            app, CORS, /health, /demo, page scoring (POST /score), page feedback
│   ├── posts.py           extension endpoints: POST /score/posts (classify post type, then score), /feedback/posts
│   ├── model_adapter.py   lazy bridge to model/ (hm_core, post_types, kb); API still starts if the model fails to load
│   ├── scorecard.py       hand-weighted page scorecard: WEIGHTS = {code: (weight, Mongolian label)}
│   ├── features/          domain.py (WHOIS, lookalike, HTTPS, outlet list), text.py (clickbait, sources, ...)
│   ├── schemas.py         request/response models for POST /score
│   └── config.py          all filesystem paths (repo-relative, overridable by env)
├── tests/
└── requirements.txt       includes ../model/requirements.txt
```

## Run

From `extension/backend/`:

```bash
python -m venv .venv && source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest -q
```

API docs (auto-generated): http://localhost:8000/docs · full contract: [`docs/API.md`](../docs/API.md)

## Endpoints

| Method | Path | Used by | Purpose |
|---|---|---|---|
| POST | `/score` | website, future news-page extension | score a **page**: url, title, text, links → score, zone, 3 reasons |
| POST | `/score/posts` | extension (Facebook) | classify (claim/ad/commerce/personal) and score a **batch of posts**; Mongolian posts only (`hm_core.is_mongolian`: Russian, Kazakh, English and other foreign-language posts and ads are skipped) |
| GET | `/score/mock?zone=` | frontend development | hard-coded responses |
| POST | `/feedback` | page UI | "this score is wrong" → `data/feedback/page_feedback.jsonl` |
| POST | `/feedback/posts` | extension | ✅/❌ label → `data/feedback/feedback.csv` (no author names stored) |
| GET | `/health` | popup, monitoring | `{"ok":true,"model":"scorecard v4"}` or `"unavailable"` + error |
| GET | `/demo`, `/demo/fb` | demos | fake feed / Facebook-like DOM test page from `extension/demo/` |

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `WHOIS_ENABLED` | `1` | `0` disables WHOIS lookups (tests, offline demos) |
| `HM_CORS_ORIGINS` | empty | comma-separated website origins allowed to call the API (extension and localhost are always allowed) |
| `HM_ARTIFACTS_DIR` | `model/artifacts` | where `.joblib` files are loaded from |
| `HM_REFERENCE_DIR` | `data/reference` | outlet lists |
| `HM_FEEDBACK_DIR` | `data/feedback` | where feedback is appended (git-ignored) |
| `ANTHROPIC_API_KEY` | empty | turns on LLM scoring with Claude for `/score/posts` (see below) |
| `GEMINI_API_KEY` | empty | turns on LLM scoring with Gemini (free key: aistudio.google.com → Get API key) |
| `HM_LLM_PROVIDER` | auto | `claude` or `gemini` when both keys are set; otherwise the provider whose key is set |
| `HM_LLM` | `0` | LLM scoring is **off**; `1` turns it back on (the extension no longer calls `/score/posts/llm`) |
| `HM_LLM_MODEL` | `claude-opus-5-5` / `gemini-3.5-flash-lite` | model used for scoring |
| `HM_LLM_EFFORT` | `low` | Claude only: `low` / `medium` / `high`, more effort = slower, more careful |

## LLM scoring (off)

Off since 27 Oct 2026: the extension scores posts with the trained model only and no longer calls
`/score/posts/llm`. The code stays for reference; `HM_LLM=1` turns the endpoint back on.


With a key set, `/score/posts` sends each batch to the LLM in one request ([`app/llm_score.py`](app/llm_score.py)):
post text, image text, the post's first image, link domain and title. The trained model adds two facts the LLM
cannot know: the source kind (registered-outlets list) and a match against already-refuted claims. The LLM
returns kind (claim / ad / personal), a 0–100 trust score, a one-sentence summary and up to 3 reasons with exact
quotes; quotes not found in the post are dropped. Product rules still apply after Claude: green needs a registered
source (else capped at 69), a strongly matched refuted claim stays below 40. Results have `"scorer": "llm"`.

If the key is missing or a request fails (network, rate limit, refusal, bad JSON), those posts are scored by the
trained scorecard as before; `/health` → `llm.error` shows the last failure. Results are cached in memory by content.
Gemini's free tier is often busy (503 / 504 / 429); the scorer then retries once on `gemini-3.8-flash`.
A 4-post batch took about 30 s on flash-lite during testing, so badges appear later than with the scorecard alone.

Privacy: author names are not sent, only the source kind; post text and image do go to the LLM provider. On the
Gemini free tier Google may use submitted content to improve its products: say so wherever the extension is shown.

Put the key in `extension/backend/.env` (git-ignored; copy [`.env.example`](.env.example)) so it works from any
shell, then start the server as usual:

```powershell
cd extension\backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

## Notes

- Unknown signals (`None`) contribute nothing, e.g. WHOIS unreachable is never punished.
- No user identifiers, comments, browsing history or images are stored.
- Not in the MVP: reverse image search, NLI, 1212.mn cross-check, LLM evidence retrieval (the LLM scorer reads
  only the post itself; it does not search the web).
- The page scorecard (`/score`) and the trained model (`/score/posts`) are separate scorers for now. Merging them
  (model features + domain signals in one response with stable reason codes) is the next integration step.
