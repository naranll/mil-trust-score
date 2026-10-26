"""POST /api/check: the "send for deeper check" button for one or a few Facebook posts.

The extension calls this ONLY after the user presses the button in the side panel. Nothing is scanned or sent
in the background. The response is signals, never a score (see signals.py for the three states).

Flow: when an LLM key is configured (Claude or Gemini), it reads the posts in one request (llm_score.py: text + image ->
quoted signals). Posts it could not read fall back to the trained pipeline: classify the post type (claim / ad /
commerce / personal), then run the matching rules. Both raw results are mapped by signals.to_signals().
Privacy: page names are used only to match the registered-pages list and are never stored or logged.
"""
import csv
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from . import guard, llm_score, model_adapter
from .config import feedback_dir
from .signals import to_signals

router = APIRouter(tags=["check"])

MAX_BATCH = 20


class Item(BaseModel):
    id: str = Field(max_length=64)       # extension-side id of the post
    text: str = Field("", max_length=8000)
    url: Optional[str] = None            # external link inside the post, if any
    author: Optional[str] = None         # page name, used only to match the registered-pages list
    author_url: Optional[str] = None
    verified: bool = False               # blue check on the page
    image_text: Optional[str] = None     # text quoted in Facebook's auto-generated image alt text
    sponsored: bool = False              # Facebook "Sponsored" label
    has_cta: bool = False                # ad buttons such as "Send message" / "Shop now"
    link_title: Optional[str] = None     # title of the link preview card
    image_url: Optional[str] = None      # first image (or video poster), sent to the Claude reader only


class Batch(BaseModel):
    items: List[Item]


def _full(it: Item) -> str:
    return " ".join(x for x in (it.text, it.image_text) if x)


def _llm_input(m, it: Item) -> dict:
    """What Claude sees for one post. The trained model adds the two facts an LLM cannot know:
    the source kind (registered-outlets list) and a match against already-refuted claims."""
    full_text = _full(it)
    kind, fc = "unknown", None
    if m is not None:
        core = m.hm_core
        try:
            kind, _ = core.source_adjust(it.author, it.author_url, it.verified)
            if len(full_text.split()) >= 6:
                fc = core.factcheck_match(core.clean(full_text))
                if fc and core.is_debunk(full_text):
                    fc = None
        except Exception:  # the LLM can still read the post without these two facts
            kind, fc = "unknown", None
    domain = None
    if it.url:
        from urllib.parse import urlparse
        domain = urlparse(it.url).hostname
    image_url = it.image_url if guard.valid_public_url(it.image_url or "") else None
    return {"id": it.id, "text": it.text, "image_text": it.image_text, "image_url": image_url,
            "link_domain": domain, "link_title": it.link_title, "sponsored": it.sponsored,
            "has_cta": it.has_cta, "source_kind": kind, "factcheck": fc}


def check_items(items: List[Item]) -> list:
    """Raw scorers -> public signals. Used by the endpoint and by model/tools/measure_signals.py."""
    m = model_adapter.get_model()
    llm_in = {it.id: _llm_input(m, it) for it in items} if llm_score.enabled() else {}
    llm_out = llm_score.score_batch(list(llm_in.values()))
    out = []
    for it in items:
        if it.id in llm_out:
            r = llm_score.to_result(llm_out[it.id], llm_in[it.id])
        elif m is None:
            r = {"status": "error", "why": "model unavailable"}
        else:
            try:
                r = score_one(m, it)
            except Exception as e:  # one bad post must not break the batch
                r = {"status": "error", "why": f"{type(e).__name__}"}
        if m is not None and r.get("status") == "ok":
            r = m.kb.enrich(r, _full(it), r.get("post_type"))
        out.append({"id": it.id, **to_signals(r)})
    return out


@router.post("/api/check")
def api_check(batch: Batch, request: Request):
    guard.rate_limit(request, "check", limit=int(os.getenv("HM_CHECK_LIMIT", "60")))
    return {"results": check_items(batch.items[:MAX_BATCH])}


def score_one(m, it: Item) -> dict:
    """Internal raw result. 1) classify the post type  2) run the rules that fit the type.
    The numbers in here (trust, zone) are internal and are dropped by signals.to_signals()."""
    core, post_types = m.hm_core, m.post_types
    full_text = _full(it)
    ptype, why_type = post_types.classify(full_text, it.sponsored, it.has_cta)

    if ptype in ("ad", "commerce"):
        kind, _ = core.source_adjust(it.author, it.author_url, it.verified)
        r = post_types.ad_score(full_text, ptype, kind, it.url, it.link_title)
        if kind == "lookalike":
            r["scam"].insert(0, {"id": "ad_lookalike_page", "found": it.author or ""})
        # An ad repeating an already-refuted claim (e.g. "this tea cures cancer") is a strong signal.
        fc = core.factcheck_match(core.clean(full_text)) if len(full_text.split()) >= 6 else None
        if not (fc and fc["strong"] and not core.is_debunk(full_text)):
            fc = None
        for x in r["scam"] + r["legit"]:
            x["text"] = post_types.AD_TEXT.get(x["id"], x["id"])
        return {"status": "ok", "post_type": ptype, "type_why": why_type,
                "scam": r["scam"], "legit": r["legit"], "factcheck": fc, "source": kind}

    if ptype == "personal":
        return {"status": "skip", "post_type": "personal", "why": "personal_post"}

    # ptype == "claim": check post text and image text SEPARATELY, keep the one with more signals.
    # hm_core.clean() keeps only the first 2 sentences, so concatenating a long caption with
    # image text would cut the image part off, and 'scam in the image, harmless caption' would be missed.
    args = (it.url, it.author, it.author_url, it.verified, it.link_title)
    r_txt = core.trust_score(it.text, *args) if it.text else {"status": "skip", "why": "no_text"}
    if it.image_text:
        r_img = core.trust_score(it.image_text, *args)
        if r_img.get("status") == "ok" and (r_txt.get("status") != "ok" or r_img["trust"] < r_txt["trust"]):
            r_img["from_image"] = True
            r_txt = r_img
    if r_txt.get("status") != "ok":
        r_txt["why"] = _skip_code(r_txt.get("why"))
    r_txt["post_type"] = "claim"
    return r_txt


def _skip_code(why: Optional[str]) -> str:
    """hm_core returns Mongolian sentences for skips; the extension translates stable codes instead."""
    w = why or ""
    if "богино" in w:
        return "too_short"
    if "Монгол бичвэр биш" in w:
        return "not_mongolian"
    return w or "could_not_check"


# --- feedback -> data/feedback/feedback.csv (git-ignored) -> model/tools/retrain_with_feedback.py ---
# OFF by default (HM_FEEDBACK=1 turns it on, e.g. for a labelling session by the team). Journalists' material
# should not pile up on a server. Author names and page URLs are never stored.
FB_COLS = ["time", "user_label", "text", "image_text", "url", "state", "post_type"]
FB_LABELS = ("true", "false", "not_claim", "unsure", "wrong_type")


class PostFeedback(BaseModel):
    text: str = ""
    image_text: Optional[str] = None
    url: Optional[str] = None
    user_label: str                    # true / false / not_claim / unsure / wrong_type
    state: Optional[str] = None        # state the extension showed (for comparison)
    post_type: Optional[str] = None    # type the classifier chose (data for improving it)


def feedback_enabled() -> bool:
    return os.getenv("HM_FEEDBACK", "0") == "1"


@router.post("/feedback/posts")
def feedback_posts(fb: PostFeedback, request: Request):
    if not feedback_enabled():
        return {"ok": False, "error": "disabled"}
    guard.rate_limit(request, "feedback", limit=60)
    if fb.user_label not in FB_LABELS:
        return {"ok": False, "error": "bad user_label"}
    path = feedback_dir() / "feedback.csv"
    new = not path.exists()
    columns = FB_COLS
    if not new:
        # Older local files may have a different column set (e.g. author or trust columns). Follow the
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
