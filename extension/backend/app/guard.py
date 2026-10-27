"""Request guards shared by /api/check and the proxy: anonymous install id, rate limit, URL validation.

No accounts. The extension creates a random install id once (crypto.randomUUID) and sends it as X-Install-Id.
Rate limits count by that id, not by IP. Nothing here is written to disk.
"""
import ipaddress
import re
import threading
import time
from collections import defaultdict, deque
from typing import Optional
from urllib.parse import urlparse

from fastapi import HTTPException, Request

_ID_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")
_hits: "dict[tuple, deque]" = defaultdict(deque)
_lock = threading.Lock()


def install_id(request: Request) -> str:
    v = request.headers.get("x-install-id", "")
    return v if _ID_RE.match(v) else "anon"


def rate_limit(request: Request, bucket: str, limit: int, window_s: int = 600) -> None:
    """Raise 429 when this install id made more than `limit` calls to `bucket` in the last `window_s` seconds."""
    key, now = (bucket, install_id(request)), time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(status_code=429, detail="rate_limited")
        q.append(now)


def reset() -> None:
    """Tests only."""
    with _lock:
        _hits.clear()


_BLOCKED_HOSTS = {"localhost", "localhost.localdomain", "ip6-localhost", "metadata.google.internal"}


def valid_public_url(u: str, max_len: int = 2048) -> Optional[str]:
    """http/https only, at most max_len chars, and not a private, loopback or link-local address."""
    if not u or len(u) > max_len:
        return None
    try:
        p = urlparse(u.strip())
    except ValueError:
        return None
    if p.scheme not in ("http", "https") or not p.hostname:
        return None
    if not is_public_host(p.hostname):
        return None
    return u.strip()


def is_public_host(host: str) -> bool:
    host = host.strip("[]").lower().rstrip(".")
    if host in _BLOCKED_HOSTS or host.endswith((".local", ".internal", ".localhost")):
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return bool(re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", host))   # a name with a TLD
    return ip.is_global


def valid_domain(d: str) -> Optional[str]:
    d = (d or "").strip().lower().rstrip(".")
    if d.startswith(("http://", "https://")):
        d = urlparse(d).hostname or ""
    if d.startswith("www."):
        d = d[4:]
    if len(d) > 253 or not re.match(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$", d):
        return None
    return d if is_public_host(d) else None
