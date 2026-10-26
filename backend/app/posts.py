"""Facebook-post scoring used by the Chrome extension (batch of posts -> trained model).

This is the contract the extension already speaks (extension/content.js, background.js).
Page-level scoring for news sites lives in scorecard.py and POST /score.
"""
import csv
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from . import model_adapter
from .config import feedback_dir

router = APIRouter(tags=["posts"])

MAX_BATCH = 50


class Item(BaseModel):
    id: str                            # extension-side id of the post
    text: str                          # post text
    url: Optional[str] = None          # external link inside the post, if any
    author: Optional[str] = None       # page name, used only to match the trusted-pages list
    author_url: Optional[str] = None
    verified: bool = False             # blue check on the page
    image_text: Optional[str] = None   # text quoted in Facebook's auto-generated image alt text


class Batch(BaseModel):
    items: List[Item]


@router.post("/score/posts")
def score_posts(batch: Batch):
    core = model_adapter.get_core()
    out = []
    for it in batch.items[:MAX_BATCH]:
        if core is None:
            r = {"status": "error", "why": "model unavailable"}
        else:
            try:
                r = score_one(core, it)
            except Exception as e:  # one bad post must not break the batch
                r = {"status": "error", "why": str(e)}
        out.append({"id": it.id, **r})
    return {"results": out}


def score_one(core, it: Item) -> dict:
    """Score the post text and the image text SEPARATELY and keep the riskier one.

    hm_core.clean() keeps only the first 2 sentences, so concatenating a long caption with
    image text would cut the image part off. Separate scoring also catches
    'scam in the image, harmless caption'.
    """
    args = (it.url, it.author, it.author_url, it.verified)
    r_txt = core.trust_score(it.text, *args) if it.text else {"status": "skip"}
    if not it.image_text:
        return r_txt
    r_img = core.trust_score(it.image_text, *args)
    if r_img.get("status") != "ok":
        return r_txt
    if r_txt.get("status") != "ok" or r_img["trust"] < r_txt["trust"]:
        r_img["from_image"] = it.image_text
        r_img["risks"] = ["🖼 Зураг дээрх бичвэрт: " + x for x in r_img["risks"][:2]] + r_img["risks"][2:]
        return r_img
    return r_txt


# --- feedback -> data/feedback/feedback.csv (git-ignored) -> model/tools/retrain_with_feedback.py ---
# Privacy: author names and page URLs are deliberately NOT stored.
FB_COLS = ["time", "user_label", "text", "image_text", "url", "trust", "zone"]


class PostFeedback(BaseModel):
    text: str = ""
    image_text: Optional[str] = None
    url: Optional[str] = None
    user_label: str                    # true / false / not_claim
    trust: Optional[int] = None        # score the model gave (for comparison)
    zone: Optional[str] = None


@router.post("/feedback/posts")
def feedback_posts(fb: PostFeedback):
    if fb.user_label not in ("true", "false", "not_claim"):
        return {"ok": False, "error": "user_label буруу"}
    path = feedback_dir() / "feedback.csv"
    new = not path.exists()
    columns = FB_COLS
    if not new:
        # Older local files also have author columns. Follow the file's own header so rows stay
        # aligned; the columns we no longer collect are simply left empty.
        with path.open(encoding="utf-8-sig", newline="") as f:
            columns = next(csv.reader(f), None) or FB_COLS
    # utf-8-sig so Excel shows Mongolian letters correctly
    with path.open("a", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore", restval="")
        if new:
            w.writeheader()
        w.writerow({"time": datetime.now().isoformat(timespec="seconds"), **fb.model_dump()})
    with path.open(encoding="utf-8-sig") as f:
        count = sum(1 for _ in csv.reader(f)) - 1
    return {"ok": True, "count": count}
