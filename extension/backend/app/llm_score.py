"""LLM reader for Facebook posts: an LLM (Claude or Gemini) reads the post text (and its image) and lists signals
worth checking, each with the exact words it found. It does NOT score the post and does not judge truth.

Runs only when the user pressed "send for deeper check" (POST /api/check) and a key is configured:
ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Gemini). HM_LLM_PROVIDER picks one when both are set;
HM_LLM=0 turns it off. Same prompt, schema and fallbacks for both. Unvalidated: the extension labels its output so.
The trained model still supplies what an LLM cannot know on its own: whether the page is on the
registered-outlets list (source kind) and whether the claim matches one already refuted by MFCC or
factcheck.mn. Those facts go into the prompt.

score_batch() never raises: on any failure (no key, API error, refusal, bad JSON) it returns the posts
it could not read as missing, and posts.py falls back to the trained rules for them.
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

# Gemini: flash-lite answers a 20-post batch in seconds; 3.8-flash often hit the 90 s deadline (504) on the free tier
DEFAULT_MODEL = {"claude": "claude-opus-5-5", "gemini": "gemini-3.5-flash-lite"}
GEMINI_FALLBACKS = ["gemini-3.8-flash"]
EFFORT = os.getenv("HM_LLM_EFFORT", "low")          # Claude only; a short classification task: low is enough
CACHE_SIZE = 2000
IMAGE_MAX_BYTES = 5 * 1024 * 1024


def _gemini_key() -> Optional[str]:
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def provider() -> str:
    p = os.getenv("HM_LLM_PROVIDER", "").lower()
    if p in DEFAULT_MODEL:
        return p
    if os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"):
        return "claude"
    return "gemini" if _gemini_key() else "claude"


def model() -> str:
    return os.getenv("HM_LLM_MODEL") or DEFAULT_MODEL[provider()]

# Reason categories. Same ids as data/reference/knowledge.json "signals", so kb.enrich() can attach
# the vetted "why" text, laws and further reading to each reason.
SIGNALS = [
    "clickbait", "emotion", "urgency", "absolute", "conspiracy", "anon_source", "scam", "call_to_action",
    "caps", "named_source", "named_person", "factcheck", "lookalike", "domain",
    "ad_prepay", "ad_inbox_only", "ad_giveaway", "ad_scarcity", "ad_too_cheap", "ad_miracle", "ad_card_data",
    "ad_short_link", "ad_brand_bait", "ad_hidden_promo", "image_mismatch", "other",
]

SYSTEM = """You help readers of a Mongolian media and information literacy (MIL) browser extension notice what in a
Facebook post is worth checking before they believe or share it. The reader asked for this check.
You do NOT decide whether a claim is true, you do NOT score or rate the post, and you never call it fake,
false, reliable or safe. You point at specific wording or features, and the reader does the checking.

For each post decide its kind:
- "claim": states news, facts, health/money/government information or advice that someone could share as true.
- "ad": sells something, promotes a giveaway, asks for money, card details or messages (sponsored or not).
- "personal": everyday personal content with nothing to check (greetings, photos of a walk, opinions about one's own day).

Signals worth checking (for "claim" and "ad" posts), for example: miracle or 100% promises, "they are hiding it",
urgency to share, fear or outrage wording, hearsay or an unnamed source ("...юм билээ", "гэнэ", "эх сурвалжийн
мэдээлснээр"), requests for card numbers or prepayment, lookalike pages or domains, a caption that does not fit the
link or image, a claim matching one already checked by a fact-checker.
- Give up to 3 signals, most important first. If there are none, return an empty list: that is a normal,
  common answer. Never invent a signal to fill the list. Calm, specific, sourced wording is not a signal.
- "found" is an exact excerpt copied character for character from the post text, image text or link title
  (2-8 words), or "" when the signal is not about specific wording. Never paraphrase inside "found".
- "text" names the signal in at most 8 words; "why" says in one sentence what the reader could check and why.
- If an image is attached, look at it: text in the image, and whether the image fits the caption.
  Do not guess whether an image is AI-generated; mention only clear visible signs.
- Posts may be written in Mongolian Cyrillic or in Mongolian with Latin letters; read both.
For "personal" posts give no signals.

Facts provided by the system (you cannot check them yourself):
- source_kind: "trusted" = page on the team's registered Mongolian news outlet list; "lookalike" = name imitates
  a known outlet; "verified" = blue check only (identity, not accuracy); "unknown" = not on the list.
- factcheck: a similar claim was already checked by MFCC or factcheck.mn. If the post repeats that claim, say so
  as a "factcheck" signal and quote the repeated words.

Write "text" and "why" in Mongolian Cyrillic, plain and short, for a teenager. Return one result for every post id."""


class Reason(BaseModel):
    signal: Literal[tuple(SIGNALS)]  # type: ignore[valid-type]
    found: str
    text: str
    why: str


class PostScore(BaseModel):
    id: str
    kind: Literal["claim", "ad", "personal"]
    reasons: List[Reason]


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
                },
                "required": ["id", "kind", "reasons"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["results"],
    "additionalProperties": False,
}

_clients: dict = {}
_import_error: Optional[str] = None
_last_error: Optional[str] = None
_used_model: Optional[str] = None      # the model that answered the last request (after any fallback)
_cache: "OrderedDict[str, dict]" = OrderedDict()


def enabled() -> bool:
    if os.getenv("HM_LLM", "1") == "0":
        return False
    if provider() == "gemini":
        return bool(_gemini_key())
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


def status() -> dict:
    return {"enabled": enabled() and _get_client() is not None, "provider": provider(), "model": model(),
            "error": _import_error or _last_error}


def _get_client():
    global _import_error
    p = provider()
    if p not in _clients and _import_error is None:
        try:
            if p == "gemini":
                from google import genai  # noqa: WPS433 (optional dependency)
                from google.genai import types

                _clients[p] = genai.Client(api_key=_gemini_key(), http_options=types.HttpOptions(timeout=90_000))
            else:
                import anthropic  # noqa: WPS433 (optional dependency)

                _clients[p] = anthropic.Anthropic(timeout=90.0)
        except Exception as e:
            _import_error = f"{type(e).__name__}: {e}"
    return _clients.get(p)


def _key(p: dict) -> str:
    raw = json.dumps([p.get(k) for k in ("text", "image_text", "image_url", "link_domain", "link_title",
                                         "sponsored", "has_cta", "source_kind", "factcheck")],
                     ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _post_text(p: dict) -> str:
    fields = {k: p[k] for k in ("id", "text", "image_text", "link_domain", "link_title", "sponsored",
                                "has_cta", "source_kind", "factcheck") if p.get(k) not in (None, "", False)}
    return "<post>\n" + json.dumps(fields, ensure_ascii=False) + "\n</post>"


def _content(posts: List[dict], with_images: bool) -> list:
    blocks = [{"type": "text", "text": f"List the signals worth checking in these {len(posts)} posts."}]
    for p in posts:
        blocks.append({"type": "text", "text": _post_text(p)})
        if with_images and p.get("image_url"):
            blocks.append({"type": "text", "text": f"Image attached to post {p['id']}:"})
            blocks.append({"type": "image", "source": {"type": "url", "url": p["image_url"]}})
    return blocks


def _parse(text: str) -> Optional[BatchScore]:
    global _last_error
    try:
        out = BatchScore.model_validate_json(text)
    except ValidationError as e:
        _last_error = f"bad JSON from model: {e.error_count()} errors"
        return None
    _last_error = None
    return out


def _call(posts: List[dict], with_images: bool) -> Optional[BatchScore]:
    return _call_gemini(posts, with_images) if provider() == "gemini" else _call_claude(posts, with_images)


def _fetch_image(url: str):
    """Gemini takes image bytes, not URLs: download it here (Facebook CDN links are public but expire)."""
    import httpx  # noqa: WPS433

    try:
        r = httpx.get(url, timeout=5.0, follow_redirects=True)
        ctype = r.headers.get("content-type", "").split(";")[0]
        if r.status_code == 200 and ctype.startswith("image/") and len(r.content) <= IMAGE_MAX_BYTES:
            return r.content, ctype
    except httpx.HTTPError:
        pass
    return None


def _call_gemini(posts: List[dict], with_images: bool) -> Optional[BatchScore]:
    global _last_error, _used_model
    from google.genai import errors, types  # noqa: WPS433

    parts = [f"List the signals worth checking in these {len(posts)} posts."]
    for p in posts:
        parts.append(_post_text(p))
        img = with_images and p.get("image_url") and _fetch_image(p["image_url"])
        if img:
            parts.append(f"Image attached to post {p['id']}:")
            parts.append(types.Part.from_bytes(data=img[0], mime_type=img[1]))
    # A short classification: LOW thinking keeps a 20-post batch well under the request deadline
    config = types.GenerateContentConfig(system_instruction=SYSTEM, response_mime_type="application/json",
                                         response_json_schema=SCHEMA,
                                         thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW))
    # Free-tier Gemini often answers 503 "high demand", 504 "deadline" or 429 "quota": try the lighter model
    models = [model()] + [m for m in GEMINI_FALLBACKS if m != model()]
    try:
        for i, m in enumerate(models):
            try:
                resp = _get_client().models.generate_content(model=m, contents=parts, config=config)
                _used_model = m
                break
            except errors.APIError as e:
                if e.code in (429, 503, 504) and i < len(models) - 1:
                    log.warning("Gemini %s busy (%s), trying %s", m, e.code, models[i + 1])
                    continue
                raise
    except errors.ClientError as e:   # 4xx: bad key, quota, bad request
        if e.code == 429:
            _last_error = "RateLimitError: Gemini free-tier quota reached"
        elif e.code in (401, 403):
            _last_error = f"AuthenticationError: GEMINI_API_KEY rejected ({e.code})"
        elif with_images and e.code == 400:
            log.warning("Gemini request rejected, retrying without images: %s", e.message)
            return _call_gemini(posts, with_images=False)
        else:
            _last_error = f"ClientError {e.code}: {e.message}"
        return None
    except errors.APIError as e:      # 5xx
        _last_error = f"APIError {e.code}: {e.message}"
        return None
    except Exception as e:            # network errors from the HTTP layer
        _last_error = f"{type(e).__name__}: {e}"
        return None
    if not resp.text:
        reason = resp.candidates[0].finish_reason if resp.candidates else "no candidates"
        _last_error = f"empty response ({reason})"
        return None
    return _parse(resp.text)


def _call_claude(posts: List[dict], with_images: bool) -> Optional[BatchScore]:
    global _last_error, _used_model
    import anthropic  # noqa: WPS433

    client = _get_client()
    try:
        resp = client.beta.messages.create(
            model=model(),
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
            return _call_claude(posts, with_images=False)
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
    _used_model = resp.model              # differs from model() when a server-side fallback answered
    return _parse(next((b.text for b in resp.content if b.type == "text"), ""))


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
                d = {**r.model_dump(), "model": _used_model or model()}
                out[r.id] = d
                _cache[_key(by_id[r.id])] = d
                while len(_cache) > CACHE_SIZE:
                    _cache.popitem(last=False)
    return out


# --- Map Claude's answer onto the raw shape signals.to_signals() expects ---------------------------------

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def to_result(raw: dict, p: dict) -> dict:
    """raw: one PostScore dict; p: the prepared post (same dict that was sent). Returns a raw result in the
    same shape as posts.score_one(), so signals.to_signals() maps both. No number is produced."""
    if raw["kind"] == "personal":
        return {"status": "skip", "post_type": "personal", "why": "personal_post", "scorer": "llm"}
    haystack = _norm(" ".join(x for x in (p.get("text"), p.get("image_text"), p.get("link_title")) if x))
    reasons = []
    for x in raw["reasons"][:3]:
        if x["signal"] == "factcheck":      # the fact-check card comes from the index, not from the LLM
            continue
        item = {"id": x["signal"], "text": x["text"], "why": x["why"]}
        if x["found"] and _norm(x["found"]) in haystack:   # drop quotes the model did not copy verbatim
            item["found"] = x["found"]
        reasons.append(item)
    kind, fc = p.get("source_kind") or "unknown", p.get("factcheck")
    if kind == "lookalike" and not any(r["id"] == "lookalike" for r in reasons):
        reasons.insert(0, {"id": "lookalike", "text": "Пэйжийн нэр нь алдартай байгууллагыг дуурайсан"})
    base = {"status": "ok", "source": kind, "factcheck": fc, "scorer": "llm", "model": raw.get("model") or model()}
    if raw["kind"] == "ad":
        return {**base, "post_type": "ad", "scam": reasons, "legit": []}
    return {**base, "post_type": "claim", "evidence": reasons}
