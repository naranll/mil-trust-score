"""Thin proxy for the context cards: archive history, domain registration, registry data.

Why a proxy: results are cached, input is validated, and every failure degrades to a plain link instead of an
error wall. Every response is JSON with "ok"; on failure it carries
"reason" and "fallback_url", and the extension then tries its bundled demo cache, then the link.

Cache: Wayback 1 h, RDAP 24 h, in memory. Responses carry X-Cache: HIT | MISS.
Rate limit: by anonymous install id (guard.py).
Timeouts: 5 s per upstream call.
"""
import json
import os
import threading
import time
from typing import Callable, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Query, Request, Response

from . import guard
from .config import REPO_ROOT

router = APIRouter(prefix="/api", tags=["proxy"])

TIMEOUT = float(os.getenv("HM_PROXY_TIMEOUT", "5"))
UA = "HACKMIL-MIL-extension/0.3 (+https://github.com/naranll/mil-trust-score)"
REGISTRY_DIR = REPO_ROOT / "registry"

WAYBACK_TTL, RDAP_TTL = 3600, 24 * 3600


# --- tiny TTL cache --------------------------------------------------------------------------------------
class TTLCache:
    def __init__(self, max_items: int = 2000):
        self._d, self._max, self._lock = {}, max_items, threading.Lock()

    def get(self, key):
        with self._lock:
            v = self._d.get(key)
            if v and v[0] > time.time():
                return v[1]
            self._d.pop(key, None)
            return None

    def set(self, key, value, ttl: int):
        with self._lock:
            if len(self._d) >= self._max:
                self._d.pop(next(iter(self._d)))
            self._d[key] = (time.time() + ttl, value)

    def clear(self):
        with self._lock:
            self._d.clear()


cache = TTLCache()


def _get(url: str, params: Optional[dict] = None) -> httpx.Response:
    """The only place that talks to the network (tests replace it)."""
    return httpx.get(url, params=params, timeout=TIMEOUT, headers={"User-Agent": UA}, follow_redirects=True)


def _cached(response: Response, key: str, ttl: int, fetch: Callable[[], dict]) -> dict:
    hit = cache.get(key)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    response.headers["X-Cache"] = "MISS"
    body = fetch()
    if body.get("ok"):          # failures are not cached, so the next press retries
        cache.set(key, body, ttl)
    return body


def _fail(reason: str, fallback_url: str, **extra) -> dict:
    return {"ok": False, "reason": reason, "fallback_url": fallback_url, **extra}


# --- Wayback Machine -------------------------------------------------------------------------------------
# archive.org has answered bursts with 429 since 2026-09; after a 429 we stop calling for a while.
_wayback_backoff = {"until": 0.0, "step": 0}


def _wayback_snapshot(url: str, timestamp: Optional[str]) -> Optional[dict]:
    params = {"url": url}
    if timestamp:
        params["timestamp"] = timestamp
    r = _get("https://archive.org/wayback/available", params)
    if r.status_code == 429:
        step = min(_wayback_backoff["step"] + 1, 5)
        _wayback_backoff.update(step=step, until=time.time() + 60 * 2 ** (step - 1))   # 1, 2, 4 ... 16 min
        raise RuntimeError("rate_limited")
    r.raise_for_status()
    _wayback_backoff["step"] = 0
    snap = (r.json().get("archived_snapshots") or {}).get("closest")
    if not snap or not snap.get("available"):
        return None
    ts = snap.get("timestamp", "")
    return {"timestamp": ts, "date": f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}" if len(ts) >= 8 else None, "url": snap.get("url")}


@router.get("/wayback")
def wayback(request: Request, response: Response, url: str = Query(..., max_length=2048)):
    guard.rate_limit(request, "wayback", limit=120)
    u = guard.valid_public_url(url)
    history = f"https://web.archive.org/web/*/{url}"
    if not u:
        return _fail("invalid_url", "https://web.archive.org/")

    def fetch():
        if time.time() < _wayback_backoff["until"]:
            return _fail("rate_limited", history)
        try:
            latest = _wayback_snapshot(u, None)
            first = _wayback_snapshot(u, "19960101") if latest else None
        except RuntimeError:
            return _fail("rate_limited", history)
        except (httpx.HTTPError, ValueError):
            return _fail("upstream_error", history)
        return {"ok": True, "url": u, "archived": bool(latest), "first": first, "latest": latest,
                "history_url": history}

    return _cached(response, f"wb:{u}", WAYBACK_TTL, fetch)


# --- RDAP (domain registration) --------------------------------------------------------------------------
def _vcard_name(entity: dict) -> Optional[str]:
    for row in (entity.get("vcardArray") or [None, []])[1]:
        if row and row[0] == "fn":
            return row[3]
    return None


@router.get("/rdap")
def rdap(request: Request, response: Response, domain: str = Query(..., max_length=260)):
    guard.rate_limit(request, "rdap", limit=120)
    d = guard.valid_domain(domain)
    if not d:
        return _fail("invalid_domain", "https://lookup.icann.org/")
    whois_link = f"https://www.whois.com/whois/{quote(d)}"

    def fetch():
        try:
            r = _get(f"https://rdap.org/domain/{quote(d)}")
            if r.status_code == 404:
                # rdap.org has no RDAP server for some ccTLDs (including .mn at the time of writing)
                return _fail("no_rdap_for_tld", whois_link, domain=d)
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError):
            return _fail("upstream_error", whois_link, domain=d)
        events = {e.get("eventAction"): (e.get("eventDate") or "")[:10] for e in data.get("events") or []}
        registrar = next((_vcard_name(e) for e in data.get("entities") or [] if "registrar" in (e.get("roles") or [])), None)
        return {"ok": True, "domain": d, "registrar": registrar, "registered": events.get("registration"),
                "expires": events.get("expiration"), "last_changed": events.get("last changed"),
                "status": data.get("status") or [], "whois_url": whois_link}

    return _cached(response, f"rdap:{d}", RDAP_TTL, fetch)


# --- registry (data only) --------------------------------------------------------------------------------
@router.get("/registry")
def registry():
    """The shared tool registry, as data. Remote updates of the extension may only ever be data like this."""
    out = {}
    for name in ("tools", "mongolia", "measurement"):
        p = REGISTRY_DIR / f"{name}.json"
        out[name] = json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
    return out


def reset() -> None:
    """Tests only."""
    cache.clear()
    _wayback_backoff.update(until=0.0, step=0)
