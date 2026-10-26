"""Domain-group features. Each function returns a strength in [0, 1], or None if unknown.

None means 'no evidence', so it contributes nothing to the score. That keeps
unknowns (e.g. WHOIS unreachable) from being punished.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse

WHITELIST_PATH = Path(__file__).parent.parent / "data" / "whitelist.json"
WHITELIST: List[str] = json.loads(WHITELIST_PATH.read_text(encoding="utf-8"))["registered_outlets"]

CONTACT_HINTS = ("about", "contact", "бидний тухай", "холбоо барих", "холбоо", "tuhai", "holboo")


def host_of(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def is_registered_outlet(url: str) -> bool:
    host = host_of(url)
    return any(host == d or host.endswith("." + d) for d in WHITELIST)


def registered_outlet(url: str) -> Optional[float]:
    return 1.0 if is_registered_outlet(url) else None


def no_https(url: str) -> Optional[float]:
    scheme = urlparse(url).scheme
    if not scheme:
        return None
    return 1.0 if scheme == "http" else None


def domain_lookalike(url: str) -> Optional[float]:
    """Close to a known outlet's name but not the same domain (e.g. ikon-news.mn, ik0n.mn)."""
    host = host_of(url)
    if not host or is_registered_outlet(url):
        return None
    label = host.split(".")[0]
    best = min(levenshtein(label, d.split(".")[0]) for d in WHITELIST)
    # also catch 'ikon-news.mn' style: known name embedded in a longer label
    embedded = any(d.split(".")[0] in label and label != d.split(".")[0] for d in WHITELIST if len(d.split(".")[0]) >= 4)
    if best <= 2 and best > 0:
        return 1.0
    return 0.8 if embedded else None


def no_contact_page(links: List[str]) -> Optional[float]:
    """Uses links the extension already sent, so no extra crawling in the MVP."""
    if not links:
        return None
    joined = " ".join(links).lower()
    return None if any(h in joined for h in CONTACT_HINTS) else 1.0


def domain_young(url: str) -> Optional[float]:
    """WHOIS age < 6 months. Network call, so failures return None."""
    host = host_of(url)
    if not host or is_registered_outlet(url) or os.getenv("WHOIS_ENABLED", "1") == "0":
        return None
    try:
        import socket

        import whois  # python-whois

        socket.setdefaulttimeout(4)  # never let a slow WHOIS server stall the demo

        created = whois.whois(host).creation_date
        if isinstance(created, list):
            created = created[0]
        if not created:
            return None
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - created).days
        return 1.0 if age_days < 183 else None
    except Exception:
        return None
