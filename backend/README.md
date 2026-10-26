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

From the **repo root**:

```bash
python -m venv .venv && source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
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

## Notes

- Unknown signals (`None`) contribute nothing, e.g. WHOIS unreachable is never punished.
- No user identifiers, comments, browsing history or images are stored.
- Not in the MVP: reverse image search, NLI, 1212.mn cross-check, LLM evidence retrieval.
- The page scorecard (`/score`) and the trained model (`/score/posts`) are separate scorers for now. Merging them
  (model features + domain signals in one response with stable reason codes) is the next integration step.
