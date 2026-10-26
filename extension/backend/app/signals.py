"""Turn a scorer's raw result into what the user sees: signals to check, never a verdict.

The trained scorecard (model/hm_core.py) and the Claude reader (llm_score.py) both compute internal numbers.
None of them leave this module. The public shape is one of three states:

    signals       the rules or the model found wording worth checking (with the exact quote)
    factcheck     a publisher's fact-check of a very similar claim exists (MFCC / factcheck.mn)
    not_assessed  we did not check, could not check, or found nothing; this says nothing about truth

There is deliberately no "ok" / "safe" state. See CLAUDE.md section 2 and 4.
"""
import csv
import functools
from typing import Optional

from .config import REPO_ROOT

# Reasons that may set the "signals" state. "style_model" (the text classifier's guess that the wording
# resembles refuted posts) is shown but never sets the state alone: on the held-out set it mostly separates
# news-article style from fact-check-quote style, so it is not evidence about a Facebook post.
MODEL_GUESS = {"style_model"}
# Rule hits that describe the source, not the wording. They are context, not signals.
CONTEXT_IDS = {"named_source", "named_person"}

DATASET = REPO_ROOT / "data" / "datasets" / "HACKMIL_dataset_v31.csv"


@functools.lru_cache(maxsize=1)
def _publisher_titles() -> dict:
    """source_url -> the fact-checker's own headline, copied verbatim from the dataset.
    The fact-check index stores only the claim text, so the publisher's wording comes from here."""
    out = {}
    try:
        with DATASET.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("source_type") == "factcheck" and row.get("source_url") and row.get("title"):
                    out.setdefault(row["source_url"], row["title"])
    except OSError:
        pass
    return out


def factcheck_card(fc: Optional[dict]) -> Optional[dict]:
    """Publisher, their headline verbatim, link. Our own label for the item is NOT shown: ratings stay the
    publisher's words. 'match' says how close the post is to the checked claim; it is a text similarity."""
    if not fc:
        return None
    return {
        "publisher": fc.get("by"),
        "headline": _publisher_titles().get(fc.get("url") or ""),
        "claim": fc.get("claim"),
        "url": fc.get("url") or None,
        "date": fc.get("date") or None,
        "match": "close" if fc.get("strong") else "loose",
    }


def _item(x) -> dict:
    if isinstance(x, str):
        x = {"id": "other", "text": x}
    out = {k: x[k] for k in ("id", "text", "found", "why", "src_name", "src_url") if x.get(k)}
    if out.get("text"):
        out["text"] = out["text"].replace(" (загварын дүгнэлт)", "")
    out["model_guess"] = x.get("id") in MODEL_GUESS
    return out


SOURCE_CONTEXT = {
    "trusted": "page_registered",    # on data/reference/trusted_pages.json (team-maintained list)
    "verified": "page_blue_check",   # identity check by Facebook, not accuracy
}


def to_signals(r: dict) -> dict:
    """r: a raw result from posts.score_one() or llm_score.to_result(). Returns the public shape."""
    post_type = r.get("post_type")
    base = {"post_type": post_type, "scorer": r.get("scorer", "rules+model"), "signals": [], "context": [],
            "factcheck": None, "notes": []}
    if r.get("status") != "ok":
        return {**base, "state": "not_assessed", "checked": False,
                "why_not": r.get("why") or "could not check"}

    is_ad = post_type in ("ad", "commerce")
    raw_items = (r.get("scam") if is_ad else r.get("evidence")) or []
    signals = [_item(x) for x in raw_items if (x.get("id") if isinstance(x, dict) else None) not in ("factcheck",)]
    context = [s for s in signals if s["id"] in CONTEXT_IDS]
    signals = [s for s in signals if s["id"] not in CONTEXT_IDS]
    if r.get("source") in SOURCE_CONTEXT:
        context.insert(0, {"id": SOURCE_CONTEXT[r["source"]]})

    fc = r.get("factcheck")
    card = factcheck_card(fc) if fc and fc.get("strong") else None

    notes = []
    if r.get("translit"):
        notes.append("translit")
    if r.get("from_image"):
        notes.append("from_image")
    if r.get("scorer") == "llm":
        notes.append("llm_unvalidated")

    # Model guesses go last and never stand alone (a lone guess would look like a finding)
    real = [s for s in signals if not s["model_guess"]]
    signals = real + [s for s in signals if s["model_guess"]] if real else []
    state = "factcheck" if card else ("signals" if real else "not_assessed")

    out = {**base, "state": state, "checked": True, "signals": signals[:3], "context": context[:3],
           "factcheck": card, "notes": notes}
    if state == "not_assessed":
        out["why_not"] = "no_signals_found"
    # Knowledge-base extras (kb.enrich): questions to ask, where to look further, verified laws only
    if r.get("reflect"):
        out["reflect"] = r["reflect"]
    if r.get("check_links"):
        out["check_links"] = r["check_links"]
    laws = [x for x in (r.get("laws") or []) if x.get("verified")]
    if laws:
        out["laws"] = laws
    return out
