"""Text/context features. Rule-based placeholders: swap in classifiers (clickbait, NLI, ...) later
without changing the signatures. Lexicons are starters; the MIL/data teammates should extend them.
"""
import re
from datetime import date, datetime
from typing import List, Optional

CLICKBAIT = [
    "шок", "та итгэхгүй", "итгэхгүй", "аймшигт", "гайхалтай", "нууц нь", "нууцыг",
    "үзэхээс өмнө", "энэ нь юу вэ", "гарчихлаа", "дэлбэрлээ", "цочирдуулсан", "хэн ч мэдэхгүй",
]
EMOTIONAL = [
    "аймаар", "ичгүүртэй", "харамсалтай", "уур хүрэм", "золгүй", "сүйрэл", "уур хилэн",
    "дайсан", "урвагч", "хулгайч", "мөрдөгдөж", "нүглийн", "зэрлэг",
]
ANON_PATTERNS = [
    r"эх сурвалжийн мэдээлснээр",
    r"найдвартай эх сурвалжаас",
    r"нэрээ нууцалсан",
    r"нэр худлаа",
    r"мэдэх хүмүүсийн хэлж",
    r"дотоод эх сурвалж",
]
ATTRIBUTION = [r"мэдээлж", r"мэдэгдсэн", r"хэлсэн", r"тайлбарласан", r"албан ёсны"]


def _count_hits(text: str, words: List[str]) -> int:
    t = text.lower()
    return sum(1 for w in words if w in t)


def clickbait(title: str) -> Optional[float]:
    hits = _count_hits(title, CLICKBAIT)
    if title.strip().endswith("?!") or title.count("!") >= 2:
        hits += 1
    return min(1.0, hits / 2) if hits else None


def emotional_words(text: str) -> Optional[float]:
    hits = _count_hits(text, EMOTIONAL)
    return min(1.0, hits / 4) if hits else None


def caps_exclaim(title: str, text: str) -> Optional[float]:
    s = f"{title} {text}"
    letters = [c for c in s if c.isalpha()]
    if not letters:
        return None
    caps_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
    excl = s.count("!")
    strength = max(min(1.0, max(0.0, caps_ratio - 0.15) / 0.25), min(1.0, max(0, excl - 1) / 4))
    return strength if strength > 0.2 else None


def no_sources(text: str, links: List[str]) -> Optional[float]:
    """Few quotes, no outbound links, no named attribution."""
    if len(text) < 200:
        return None
    quotes = len(re.findall(r"[«\"“][^»\"”]{8,}[»\"”]", text))
    attrib = sum(len(re.findall(p, text.lower())) for p in ATTRIBUTION)
    signals = quotes + attrib + min(len(links), 3)
    if signals == 0:
        return 1.0
    return 0.5 if signals <= 2 else None


def anonymous_source(text: str) -> Optional[float]:
    t = text.lower()
    hits = sum(1 for p in ANON_PATTERNS if re.search(p, t))
    return min(1.0, hits / 2) if hits else None


def has_author_date(author: Optional[str], published_date: Optional[str]) -> Optional[float]:
    return 1.0 if (author and author.strip() and published_date) else None


def old_news(published_date: Optional[str], today: Optional[date] = None) -> Optional[float]:
    if not published_date:
        return None
    try:
        d = datetime.fromisoformat(published_date[:10]).date()
    except ValueError:
        return None
    age = ((today or date.today()) - d).days
    return 1.0 if age > 365 else None
