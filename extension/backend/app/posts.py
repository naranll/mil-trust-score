"""Facebook-post scoring used by the Chrome extension (batch of posts -> trained model).

This is the contract the extension already speaks (extension/content.js, background.js).
Page-level scoring for news sites lives in scorecard.py and POST /score.

Two passes, so the feed stays fast:
1. POST /score/posts — the trained pipeline: classify the post type (claim / ad / commerce /
   personal), then run the matching scorer. Claims go through the trained scorecard; ads get a
   scam-signal check; personal posts are skipped. About a second per batch.
2. POST /score/posts/llm — when an LLM key is configured, the LLM reads text + image
   (llm_score.py) and the extension replaces the badges it gets back. Seconds per batch.
"""
import csv
from datetime import datetime
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter
from pydantic import BaseModel

from . import llm_score, model_adapter
from .config import feedback_dir

router = APIRouter(tags=["posts"])

MAX_BATCH = 50
MAX_LLM_BATCH = 8      # small LLM batches: the first upgraded badges arrive sooner


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
    image_url: Optional[str] = None    # first image (or video poster) of the post, sent to the LLM scorer only


class Batch(BaseModel):
    items: List[Item]


def _llm_input(m, it: Item) -> dict:
    """What Claude sees for one post. The trained model adds the two facts an LLM cannot know:
    the source kind (registered-outlets list) and a match against already-refuted claims."""
    full_text = " ".join(x for x in (it.text, it.image_text) if x)
    kind, fc = "unknown", None
    if m is not None:
        core = m.hm_core
        try:
            kind, _ = core.source_adjust(it.author, it.author_url, it.verified)
            if len(full_text.split()) >= 6:
                fc = core.factcheck_match(core.clean(full_text))
                if fc and core.is_debunk(full_text):
                    fc = None
        except Exception:  # the LLM can still score without these two facts
            kind, fc = "unknown", None
    domain = None
    if it.url:
        domain = urlparse(it.url).hostname
    return {"id": it.id, "text": it.text, "image_text": it.image_text, "image_url": it.image_url,
            "link_domain": domain, "link_title": it.link_title, "sponsored": it.sponsored,
            "has_cta": it.has_cta, "source_kind": kind, "factcheck": fc}


def _full_text(it: Item) -> str:
    return " ".join(x for x in (it.text, it.image_text) if x)


@router.post("/score/posts")
def score_posts(batch: Batch):
    """Fast path (about a second): the trained scorecard, so badges appear while the user scrolls.
    The extension then sends the same posts to /score/posts/llm and upgrades the badges."""
    m = model_adapter.get_model()
    out = []
    for it in batch.items[:MAX_BATCH]:
        if m is None:
            r = {"status": "error", "why": "model unavailable"}
        else:
            try:
                r = score_one(m, it)
                r = m.kb.enrich(r, _full_text(it), r.get("post_type"))
            except Exception as e:  # one bad post must not break the batch
                r = {"status": "error", "why": str(e)}
        out.append({"id": it.id, **r})
    return {"results": out}


@router.post("/score/posts/llm")
def score_posts_llm(batch: Batch):
    """Slow path (seconds to tens of seconds): the LLM reads text and image (llm_score.py). Returns only the
    posts it scored; any other post keeps its scorecard badge. "llm": false means no key is configured."""
    if not llm_score.enabled():
        return {"results": [], "llm": False}
    m = model_adapter.get_model()
    items = batch.items[:MAX_LLM_BATCH]
    llm_in = {it.id: _llm_input(m, it) for it in items}
    llm_out = llm_score.score_batch(list(llm_in.values()))
    out = []
    for it in items:
        if it.id in llm_out:
            r = llm_score.to_result(llm_out[it.id], llm_in[it.id])
            if m is not None:
                r = m.kb.enrich(r, _full_text(it), r.get("post_type"))
            out.append({"id": it.id, **r})
    return {"results": out, "llm": True}


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
