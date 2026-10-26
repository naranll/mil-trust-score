import json
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import FeedbackRequest, ScoreRequest, ScoreResponse
from .scorecard import score_page

app = FastAPI(title="Итгэлцлийн оноо API", version="0.1.0")

# Chrome extensions call from chrome-extension:// and from page origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FEEDBACK_FILE = Path(__file__).parent / "data" / "feedback.jsonl"


@app.get("/health")
def health():
    return {"ok": True}


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
    with FEEDBACK_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return {"saved": True}
