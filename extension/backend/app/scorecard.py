"""Scorecard: score = clamp(BASE + sum(weight * strength), 0, 100).

WEIGHTS is the single place the model teammate replaces with trained values
(WoE / LightGBM + SHAP -> same codes, new numbers). Keep the codes stable: they are also the MIL card ids.
"""
from typing import Dict, List, Optional, Tuple

from .features import domain as D
from .features import text as T
from .schemas import Reason, ScoreRequest, ScoreResponse

BASE = 60

# code: (weight, Mongolian label shown to the user)
WEIGHTS: Dict[str, Tuple[float, str]] = {
    # domain
    "domain_young":      (-15, "Домэйн саяхан бүртгэгдсэн"),
    "domain_lookalike":  (-25, "Алдартай мэдээллийн сайтыг дуурайсан нэртэй"),
    "no_contact_page":   (-8,  "Холбоо барих хаяг, «бидний тухай» хуудас олдсонгүй"),
    "no_https":          (-10, "HTTPS ашиглаагүй"),
    "registered_outlet": (25,  "Бүртгэлтэй хэвлэл мэдээллийн байгууллага"),
    # text
    "clickbait":         (-12, "Clickbait гарчигтай"),
    "emotional_words":   (-8,  "Сэтгэл хөдлөл өдөөх үг олонтой"),
    "caps_exclaim":      (-6,  "Их үсэг, анхаарлын тэмдэг хэт олон"),
    "no_sources":        (-10, "Эх сурвалж, ишлэл байхгүй"),
    "anonymous_source":  (-8,  "Нэргүй эх сурвалж ашигласан"),
    "has_author_date":   (6,   "Зохиогч, огноо тодорхой"),
    # context
    "old_news":          (-10, "Нийтлэгдсэнээс нэг жилээс илүү өнгөрсөн"),
}


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


def zone_of(score: int) -> str:
    if score >= 70:
        return "green"
    if score >= 40:
        return "yellow"
    return "red"


def score_page(req: ScoreRequest) -> ScoreResponse:
    feats = compute_features(req)
    contribs: List[Reason] = []
    for code, strength in feats.items():
        if strength is None:
            continue
        weight, label = WEIGHTS[code]
        contribs.append(Reason(code=code, label=label, points=round(weight * strength, 1)))

    raw = BASE + sum(r.points for r in contribs)
    score = int(max(0, min(100, round(raw))))
    zone = zone_of(score)

    # Reasons: in red/yellow lead with what hurt the score; in green lead with what helped.
    contribs.sort(key=lambda r: abs(r.points), reverse=True)
    if zone == "green":
        preferred = [r for r in contribs if r.points > 0] + [r for r in contribs if r.points <= 0]
    else:
        preferred = [r for r in contribs if r.points < 0] + [r for r in contribs if r.points >= 0]
    return ScoreResponse(score=score, zone=zone, reasons=preferred[:3])
