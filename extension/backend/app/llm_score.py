"""LLM scoring for Facebook posts: Claude reads the post text (and its image) and returns a 0-100 trust
score with reasons quoted from the post.

Enabled when an Anthropic credential is configured (ANTHROPIC_API_KEY) and HM_LLM is not "0".
The trained model still supplies what an LLM cannot know on its own: whether the page is on the
registered-outlets list (source kind) and whether the claim matches one already refuted by MFCC or
factcheck.mn. Those facts go into the prompt; Claude writes the score and the reasons.

score_batch() never raises: on any failure (no key, API error, refusal, bad JSON) it returns the posts
it could not score as missing, and posts.py falls back to the trained scorecard for them.
Privacy: author names are not sent, only the source kind. Nothing is stored except an in-memory cache.
"""
import hashlib
import json
import logging
import os
import re
from collections import OrderedDict
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ValidationError

log = logging.getLogger(__name__)

MODEL = os.getenv("HM_LLM_MODEL", "claude-opus-5-5")
EFFORT = os.getenv("HM_LLM_EFFORT", "low")          # a short classification task: low is enough
CACHE_SIZE = 2000

# Reason categories. Same ids as data/reference/knowledge.json "signals", so kb.enrich() can attach
# the vetted "why" text, laws and further reading to each reason.
SIGNALS = [
    "clickbait", "emotion", "urgency", "absolute", "conspiracy", "anon_source", "scam", "call_to_action",
    "caps", "named_source", "named_person", "factcheck", "lookalike", "domain",
    "ad_prepay", "ad_inbox_only", "ad_giveaway", "ad_scarcity", "ad_too_cheap", "ad_miracle", "ad_card_data",
    "ad_short_link", "ad_brand_bait", "ad_hidden_promo", "image_mismatch", "other",
]

SYSTEM = """You score Facebook posts for a Mongolian media and information literacy (MIL) browser extension.
The extension shows each post a 0-100 trust score and the reasons for it, so that young readers learn to
notice manipulation themselves. You do not decide whether a claim is true. You judge how much the post
shows the signals of misinformation, manipulation or scams, and how well it is sourced.

For each post decide its kind:
- "claim": states news, facts, health/money/government information or advice that someone could share as true.
- "ad": sells something, promotes a giveaway, asks for money, card details or messages (sponsored or not).
- "personal": everyday personal content with nothing to check (greetings, photos of a walk, opinions about one's own day).

Score (trust, integer 0-100) for "claim" and "ad" posts:
- 70-100: no warning signs and the source is identifiable; specific, checkable, calm wording.
- 40-69: not enough to decide; unclear or missing source, hearsay ("...юм билээ", "гэнэ"), vague details.
- 0-39: clear warning signs: miracle or 100% promises, "they are hiding it", urgency to share, fear or outrage,
  requests for card numbers or prepayment, lookalike pages or domains, a claim already refuted by fact-checkers.
For "personal" posts set trust to 0 and give no reasons.

Facts provided by the system (trust them; you cannot check them yourself):
- source_kind: "trusted" = registered Mongolian news outlet page; "lookalike" = name imitates a known outlet;
  "verified" = blue check only (not proof of reliability); "unknown" = not on the list.
- factcheck: a similar claim was already rated by MFCC or factcheck.mn (with their verdict). If it is "strong"
  and the post repeats the claim rather than debunking it, the score must be below 40.

Reasons:
- Give up to 3 reasons that lower trust, most important first, and up to 2 short trust_signals that raise it.
- "found" is an exact excerpt copied character for character from the post text, image text or link title
  (2-8 words), or "" when the reason is not about specific wording. Never paraphrase inside "found".
- "text" names the signal in at most 8 words; "why" explains in one sentence why it should make a reader careful.
- If an image is attached, look at it: text in the image, and whether the image fits the caption.
  Do not guess whether an image is AI-generated; mention only clear visible signs.
- Posts may be written in Mongolian Cyrillic or in Mongolian with Latin letters; read both.

Write "summary", "text", "why" and "trust_signals" in Mongolian Cyrillic, plain and short, for a teenager.
The summary is one sentence that tells the reader what to watch for. Return one result for every post id."""


class Reason(BaseModel):
    signal: Literal[tuple(SIGNALS)]  # type: ignore[valid-type]
    found: str
    text: str
    why: str


class PostScore(BaseModel):
    id: str
    kind: Literal["claim", "ad", "personal"]
    trust: int
    summary: str
    reasons: List[Reason]
    trust_signals: List[str]


class BatchScore(BaseModel):
    results: List[PostScore]


SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "kind": {"type": "string", "enum": ["claim", "ad", "personal"]},
                    "trust": {"type": "integer"},
                    "summary": {"type": "string"},
                    "reasons": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "signal": {"type": "string", "enum": SIGNALS},
                                "found": {"type": "string"},
                                "text": {"type": "string"},
                                "why": {"type": "string"},
                            },
                            "required": ["signal", "found", "text", "why"],
                            "additionalProperties": False,
                        },
                    },
                    "trust_signals": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["id", "kind", "trust", "summary", "reasons", "trust_signals"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["results"],
    "additionalProperties": False,
}

_client = None
_import_error: Optional[str] = None
_last_error: Optional[str] = None
_cache: "OrderedDict[str, dict]" = OrderedDict()


def enabled() -> bool:
    if os.getenv("HM_LLM", "1") == "0":
        return False
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


def status() -> dict:
    return {"enabled": enabled() and _get_client() is not None, "model": MODEL,
            "error": _import_error or _last_error}


def _get_client():
    global _client, _import_error
    if _client is None and _import_error is None:
        try:
            import anthropic  # noqa: WPS433 (optional dependency)

            _client = anthropic.Anthropic(timeout=90.0)
        except Exception as e:
            _import_error = f"{type(e).__name__}: {e}"
    return _client


def _key(p: dict) -> str:
    raw = json.dumps([p.get(k) for k in ("text", "image_text", "image_url", "link_domain", "link_title",
                                         "sponsored", "has_cta", "source_kind", "factcheck")],
                     ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _content(posts: List[dict], with_images: bool) -> list:
    blocks = [{"type": "text", "text": f"Score these {len(posts)} posts."}]
    for p in posts:
        fields = {k: p[k] for k in ("id", "text", "image_text", "link_domain", "link_title", "sponsored",
                                    "has_cta", "source_kind", "factcheck") if p.get(k) not in (None, "", False)}
        blocks.append({"type": "text", "text": "<post>\n" + json.dumps(fields, ensure_ascii=False) + "\n</post>"})
        if with_images and p.get("image_url"):
            blocks.append({"type": "text", "text": f"Image attached to post {p['id']}:"})
            blocks.append({"type": "image", "source": {"type": "url", "url": p["image_url"]}})
    return blocks


def _call(posts: List[dict], with_images: bool) -> Optional[BatchScore]:
    global _last_error
    import anthropic  # noqa: WPS433

    client = _get_client()
    try:
        resp = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",               # a policy decline is retried on Anthropic's recommended model
            system=SYSTEM,
            output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[{"role": "user", "content": _content(posts, with_images)}],
        )
    except anthropic.BadRequestError as e:
        # Facebook image links expire; an image the API cannot fetch fails the whole request
        if with_images:
            log.warning("LLM request rejected, retrying without images: %s", e.message)
            return _call(posts, with_images=False)
        _last_error = f"BadRequestError: {e.message}"
        return None
    except anthropic.AuthenticationError:
        _last_error = "AuthenticationError: invalid ANTHROPIC_API_KEY"
        return None
    except anthropic.RateLimitError:
        _last_error = "RateLimitError"
        return None
    except anthropic.APIStatusError as e:
        _last_error = f"APIStatusError {e.status_code}: {e.message}"
        return None
    except anthropic.APIConnectionError:
        _last_error = "APIConnectionError: no connection to the Anthropic API"
        return None
    if resp.stop_reason == "refusal":
        _last_error = "refusal"
        return None
    if resp.stop_reason == "max_tokens":
        _last_error = "max_tokens: batch too large"
        return None
    text = next((b.text for b in resp.content if b.type == "text"), "")
    try:
        out = BatchScore.model_validate_json(text)
    except ValidationError as e:
        _last_error = f"bad JSON from model: {e.error_count()} errors"
        return None
    _last_error = None
    return out


def score_batch(posts: List[dict]) -> Dict[str, dict]:
    """posts: dicts with id, text, image_text, image_url, link_domain, link_title, sponsored, has_cta,
    source_kind, factcheck. Returns {id: raw PostScore dict} for the posts that were scored."""
    if not posts or not enabled() or _get_client() is None:
        return {}
    out, todo = {}, []
    for p in posts:
        k = _key(p)
        if k in _cache:
            _cache.move_to_end(k)
            out[p["id"]] = _cache[k]
        else:
            todo.append(p)
    if todo:
        batch = _call(todo, with_images=True)
        by_id = {p["id"]: p for p in todo}
        for r in (batch.results if batch else []):
            if r.id in by_id:
                d = r.model_dump()
                out[r.id] = d
                _cache[_key(by_id[r.id])] = d
                while len(_cache) > CACHE_SIZE:
                    _cache.popitem(last=False)
    return out


# --- Map Claude's answer onto the response shape the extension already speaks (docs/API.md) ---------

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def to_result(raw: dict, p: dict) -> dict:
    """raw: one PostScore dict; p: the prepared post (same dict that was sent)."""
    if raw["kind"] == "personal":
        return {"status": "skip", "post_type": "personal", "why": "Энгийн пост — шалгах мэдэгдэл алга", "scorer": "llm"}
    haystack = _norm(" ".join(x for x in (p.get("text"), p.get("image_text"), p.get("link_title")) if x))
    reasons = []
    for x in raw["reasons"][:3]:
        item = {"id": x["signal"], "text": x["text"], "why": x["why"]}
        if x["found"] and _norm(x["found"]) in haystack:   # drop quotes the model did not copy verbatim
            item["found"] = x["found"]
        reasons.append(item)
    trust = max(0, min(100, int(raw["trust"])))
    kind, fc = p.get("source_kind") or "unknown", p.get("factcheck")
    base = {"status": "ok", "trust": trust, "summary": raw["summary"], "source": kind,
            "factcheck": fc, "scorer": "llm", "model": MODEL}

    if raw["kind"] == "ad":
        if kind == "lookalike" or (fc and fc.get("strong")):
            trust = min(trust, 39)
        zone = "ad_scam" if trust < 40 else ("ad_check" if trust < 70 else "ad_ok")
        return {**base, "trust": trust, "post_type": "ad", "zone": zone,
                "type_why": "Худалдаа, зар эсвэл бэлэгтэй холбоотой пост",
                "scam": reasons, "legit": [{"id": "llm", "text": t} for t in raw["trust_signals"][:2]]}

    # Product rule (docs/API.md): green needs a registered source; a refuted claim stays red
    unverified = trust >= 70 and kind != "trusted"
    if unverified:
        trust = 69
    if fc and fc.get("strong"):
        trust = min(trust, 39)
    zone = "green" if trust >= 70 else ("yellow" if trust >= 40 else "red")
    return {**base, "trust": trust, "post_type": "claim", "zone": zone, "source_unverified": unverified,
            "evidence": reasons, "risks": [r["text"] for r in reasons],
            "trust_signals": raw["trust_signals"][:2], "translit": False}
