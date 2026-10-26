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
| POST | `/score/posts` | extension (Facebook) | classify (claim/ad/commerce/personal) and score a **batch of posts** |
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
| `ANTHROPIC_API_KEY` | empty | turns on LLM scoring for `/score/posts` (Claude reads the text and image, see below) |
| `HM_LLM` | `1` | `0` turns LLM scoring off even when a key is set |
| `HM_LLM_MODEL` | `claude-opus-5-5` | Claude model used for scoring |
| `HM_LLM_EFFORT` | `low` | `low` / `medium` / `high`: more effort = slower, more careful |

## LLM scoring

With `ANTHROPIC_API_KEY` set, `/score/posts` sends each batch to Claude in one request ([`app/llm_score.py`](app/llm_score.py)):
post text, image text, the post's first image (by URL), link domain and title. The trained model adds two facts
Claude cannot know: the source kind (registered-outlets list) and a match against already-refuted claims. Claude
returns kind (claim / ad / personal), a 0–100 trust score, a one-sentence summary and up to 3 reasons with exact
quotes; quotes not found in the post are dropped. Product rules still apply after Claude: green needs a registered
source (else capped at 69), a strongly matched refuted claim stays below 40. Results have `"scorer": "llm"`.

If the key is missing or a request fails (network, rate limit, refusal, bad JSON), those posts are scored by the
trained scorecard as before; `/health` → `llm.error` shows the last failure. Results are cached in memory by content.
Privacy: author names are not sent, only the source kind; post text and image do go to the Anthropic API.

## Notes

- Unknown signals (`None`) contribute nothing, e.g. WHOIS unreachable is never punished.
- No user identifiers, comments, browsing history or images are stored.
- Not in the MVP: reverse image search, NLI, 1212.mn cross-check, LLM evidence retrieval (the LLM scorer reads
  only the post itself; it does not search the web).
- The page scorecard (`/score`) and the trained model (`/score/posts`) are separate scorers for now. Merging them
  (model features + domain signals in one response with stable reason codes) is the next integration step.
