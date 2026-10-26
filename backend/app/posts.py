"""Facebook-post scoring used by the Chrome extension (batch of posts -> trained model).

This is the contract the extension already speaks (extension/content.js, background.js).
Page-level scoring for news sites lives in scorecard.py and POST /score.

Flow per post: classify the post type (claim / ad / commerce / personal), then run the
matching scorer. Claims go through the trained scorecard; ads get a scam-signal check;
personal posts are skipped.
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
    sponsored: bool = False            # Facebook "Sponsored" label
    has_cta: bool = False              # ad buttons such as "Send message" / "Shop now"
    link_title: Optional[str] = None   # title of the link preview card


class Batch(BaseModel):
    items: List[Item]


@router.post("/score/posts")
def score_posts(batch: Batch):
    m = model_adapter.get_model()
    out = []
    for it in batch.items[:MAX_BATCH]:
        if m is None:
            r = {"status": "error", "why": "model unavailable"}
        else:
            try:
                r = score_one(m, it)
                r = m.kb.enrich(r, " ".join(x for x in (it.text, it.image_text) if x), r.get("post_type"))
            except Exception as e:  # one bad post must not break the batch
                r = {"status": "error", "why": str(e)}
        out.append({"id": it.id, **r})
    return {"results": out}


AD_SUMMARY = {
    "ad_scam":  "Энэ зар/худалдааны постод луйварт түгээмэл ажиглагддаг шинж илэрлээ. Мөнгө шилжүүлэх, карт оруулахаас өмнө заавал шалгаарай.",
    "ad_check": "Зар үнэн эсэхийг батлах боломжгүй. Худалдан авахаасаа өмнө доорх зүйлсийг шалгаарай.",
    "ad_ok":    "Луйврын шинж илрээгүй, итгэл нэмэх шинж байна. Гэхдээ зар бол таныг худалдан авахад ятгах зорилготой.",
}


def score_one(m, it: Item) -> dict:
    """1) classify the post type  2) run the scorer that fits the type."""
    core, post_types = m.hm_core, m.post_types
    full_text = " ".join(x for x in (it.text, it.image_text) if x)
    ptype, why_type = post_types.classify(full_text, it.sponsored, it.has_cta)

    if ptype in ("ad", "commerce"):
        kind, _ = core.source_adjust(it.author, it.author_url, it.verified)
        r = post_types.ad_score(full_text, ptype, kind, it.url, it.link_title)
        if kind == "lookalike":
            r["scam"].insert(0, {"id": "ad_lookalike_page", "found": it.author or ""})
            r["state"] = "ad_scam"
        # An ad repeating an already-refuted claim (e.g. "this tea cures cancer") is a strong signal.
        fc = core.factcheck_match(core.clean(full_text)) if len(full_text.split()) >= 6 else None
        if fc and fc["strong"] and not core.is_debunk(full_text):
            r["scam"].insert(0, {"id": "factcheck", "found": fc["claim"][:60]})
            r["state"] = "ad_scam"
        else:
            fc = None
        for x in r["scam"] + r["legit"]:
            x["text"] = post_types.AD_TEXT.get(x["id"], x["id"])
        return {"status": "ok", "post_type": ptype, "type_why": why_type, "zone": r["state"],
                "summary": AD_SUMMARY[r["state"]], "scam": r["scam"], "legit": r["legit"],
                "factcheck": fc, "source": kind}

    if ptype == "personal":
        return {"status": "skip", "post_type": "personal", "why": "Энгийн пост — шалгах мэдэгдэл алга"}

    # ptype == "claim": score post text and image text SEPARATELY, keep the riskier one.
    # hm_core.clean() keeps only the first 2 sentences, so concatenating a long caption with
    # image text would cut the image part off, and 'scam in the image, harmless caption' would be missed.
    args = (it.url, it.author, it.author_url, it.verified, it.link_title)
    r_txt = core.trust_score(it.text, *args) if it.text else {"status": "skip"}
    if it.image_text:
        r_img = core.trust_score(it.image_text, *args)
        if r_img.get("status") == "ok" and (r_txt.get("status") != "ok" or r_img["trust"] < r_txt["trust"]):
            r_img["from_image"] = it.image_text
            r_img["risks"] = ["🖼 Зураг дээрх бичвэрт: " + x for x in r_img["risks"][:2]] + r_img["risks"][2:]
            r_txt = r_img
    r_txt["post_type"] = "claim"
    return r_txt


# --- feedback -> data/feedback/feedback.csv (git-ignored) -> model/tools/retrain_with_feedback.py ---
# Privacy: author names and page URLs are deliberately NOT stored.
FB_COLS = ["time", "user_label", "text", "image_text", "url", "trust", "zone", "post_type"]
FB_LABELS = ("true", "false", "not_claim", "unsure", "wrong_type")


class PostFeedback(BaseModel):
    text: str = ""
    image_text: Optional[str] = None
    url: Optional[str] = None
    user_label: str                    # true / false / not_claim / unsure / wrong_type
    trust: Optional[int] = None        # score the model gave (for comparison)
    zone: Optional[str] = None
    post_type: Optional[str] = None    # type the classifier chose (data for improving it)


@router.post("/feedback/posts")
def feedback_posts(fb: PostFeedback):
    if fb.user_label not in FB_LABELS:
        return {"ok": False, "error": "user_label буруу"}
    path = feedback_dir() / "feedback.csv"
    new = not path.exists()
    columns = FB_COLS
    if not new:
        # Older local files may have a different column set (e.g. author columns). Follow the
        # file's own header so rows stay aligned; columns it lacks are dropped, others left empty.
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
