"""Page signals for news articles / websites (POST /api/check/page). Rules only, no number.

Each rule returns a strength (0..1), or None when it did not fire or could not be measured. Rules that point at something
worth checking become "signals"; rules that describe the page (registered outlet, named author and date)
become "context". Neither says whether the article is true. Codes are stable: they are also MIL card ids.
"""
from typing import Dict, List, Optional

from .features import domain as D
from .features import text as T
from .schemas import PageCheckResponse, PageItem, ScoreRequest

# code: (kind, priority, Mongolian label shown to the user). Priority only orders the list: it is never shown,
# summed or turned into a number for the user.
RULES: Dict[str, tuple] = {
    # domain
    "domain_young":      ("signal",  15, "Домэйн саяхан бүртгэгдсэн"),
    "domain_lookalike":  ("signal",  25, "Алдартай мэдээллийн сайтыг дуурайсан нэртэй"),
    "no_contact_page":   ("signal",  8,  "Холбоо барих хаяг, «бидний тухай» хуудас олдсонгүй"),
    "no_https":          ("signal",  10, "HTTPS ашиглаагүй"),
    "registered_outlet": ("context", 0,  "Багийн жагсаалтад буй бүртгэлтэй хэвлэл мэдээллийн байгууллага"),
    # text
    "clickbait":         ("signal",  12, "Clickbait гарчигтай"),
    "emotional_words":   ("signal",  8,  "Сэтгэл хөдлөл өдөөх үг олонтой"),
    "caps_exclaim":      ("signal",  6,  "Их үсэг, анхаарлын тэмдэг хэт олон"),
    "no_sources":        ("signal",  10, "Эх сурвалж, ишлэл байхгүй"),
    "anonymous_source":  ("signal",  8,  "Нэргүй эх сурвалж ашигласан"),
    "has_author_date":   ("context", 0,  "Зохиогч, огноо тодорхой"),
    # context
    "old_news":          ("signal",  10, "Нийтлэгдсэнээс нэг жилээс илүү өнгөрсөн"),
}
THRESHOLD = 0.5   # a rule counts as fired at half strength or more


def compute_features(req: ScoreRequest) -> Dict[str, Optional[float]]:
    return {
        "domain_young": D.domain_young(req.url),
        "domain_lookalike": D.domain_lookalike(req.url),
        "no_contact_page": D.no_contact_page(req.links),
        "no_https": D.no_https(req.url),
        "registered_outlet": D.registered_outlet(req.url),
        "clickbait": T.clickbait(req.title),
        "emotional_words": T.emotional_words(req.text),
        "caps_exclaim": T.caps_exclaim(req.title, req.text),
        "no_sources": T.no_sources(req.text, req.links),
        "anonymous_source": T.anonymous_source(req.text),
        "has_author_date": T.has_author_date(req.author, req.published_date),
        "old_news": T.old_news(req.published_date),
    }


def check_page(req: ScoreRequest) -> PageCheckResponse:
    feats = compute_features(req)
    signals: List[PageItem] = []
    context: List[PageItem] = []
    # most important first
    for code, strength in sorted(feats.items(), key=lambda kv: -(kv[1] or 0) * RULES[kv[0]][1]):
        if strength is None or strength < THRESHOLD:   # None = did not fire, or could not be measured
            continue
        kind, _, label = RULES[code]
        (signals if kind == "signal" else context).append(PageItem(code=code, label=label))
    return PageCheckResponse(state="signals" if signals else "not_assessed", signals=signals[:3], context=context)
