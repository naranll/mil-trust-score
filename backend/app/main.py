import json
import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import model_adapter, posts
from .config import EXTENSION_DIR, feedback_dir
from .schemas import FeedbackRequest, ScoreRequest, ScoreResponse
from .scorecard import score_page

app = FastAPI(title="Итгэлцлийн оноо API", version="0.1.0")

# CORS: only the Chrome extension and local development pages may call the API from a browser.
# A wildcard would let ANY web page open in the user's browser post fake feedback to a local server
# and poison the retraining data. For a deployed website, list its origin(s) in HM_CORS_ORIGINS
# (comma separated), e.g. HM_CORS_ORIGINS=https://itgeltsel.example.mn
_extra = [o.strip() for o in os.getenv("HM_CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra,
    allow_origin_regex=r"chrome-extension://.*|http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(posts.router)


@app.get("/health")
def health():
    m = model_adapter.status()
    return {"ok": True, "model": "scorecard v4" if m["loaded"] else "unavailable", "model_error": m["error"]}


@app.get("/demo", include_in_schema=False)
def demo():
    """Facebook-free demo page for the extension (extension/demo/demo.html)."""
    return FileResponse(EXTENSION_DIR / "demo" / "demo.html")


@app.get("/demo/fb", include_in_schema=False)
def demo_fb():
    """Test page that mimics Facebook's real DOM structure (extension/demo/fb_like.html)."""
    return FileResponse(EXTENSION_DIR / "demo" / "fb_like.html")


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    return score_page(req)


@app.get("/score/mock", response_model=ScoreResponse)
def score_mock(zone: str = "red") -> ScoreResponse:
    """Hardcoded responses so the extension can be built before the model exists."""
    samples = {
        "red": {
            "score": 22, "zone": "red",
            "reasons": [
                {"code": "domain_lookalike", "label": "Алдартай мэдээллийн сайтыг дуурайсан нэртэй", "points": -25},
                {"code": "clickbait", "label": "Clickbait гарчигтай", "points": -12},
                {"code": "no_sources", "label": "Эх сурвалж, ишлэл байхгүй", "points": -10},
            ],
        },
        "yellow": {
            "score": 55, "zone": "yellow",
            "reasons": [
                {"code": "anonymous_source", "label": "Нэргүй эх сурвалж ашигласан", "points": -8},
                {"code": "emotional_words", "label": "Сэтгэл хөдлөл өдөөх үг олонтой", "points": -8},
                {"code": "has_author_date", "label": "Зохиогч, огноо тодорхой", "points": 6},
            ],
        },
        "green": {
            "score": 88, "zone": "green",
            "reasons": [
                {"code": "registered_outlet", "label": "Бүртгэлтэй хэвлэл мэдээллийн байгууллага", "points": 25},
                {"code": "has_author_date", "label": "Зохиогч, огноо тодорхой", "points": 6},
            ],
        },
    }
    return ScoreResponse(**samples.get(zone, samples["red"]))


@app.post("/feedback")
def feedback(fb: FeedbackRequest):
    """'This score is wrong' button. Becomes labelled data later. No user identifiers stored."""
    row = fb.model_dump()
    row["ts"] = int(time.time())
    with (feedback_dir() / "page_feedback.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return {"saved": True}
