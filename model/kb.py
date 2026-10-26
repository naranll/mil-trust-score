"""
Мэдлэгийн сан (knowledge.json)-гаас үр дүнг баяжуулах:
  • шалтгаан бүрт «яагаад» + судалгаа/эх сурвалжийн линк
  • «Итгэвэл / Шалгавал / Өөрөөсөө асуу» (сэдвээр)
  • Мэдэх нь зүйтэй хууль (зөвхөн луйвар, зар, хуваалцах — Q6)
  • Цааш хэрхэн шалгах: Google, MFCC хайлт + сэдэвт тохирох албан эх сурвалж
json-оо засахад сервер дахин асаахгүйгээр шинэчлэгдэнэ.
"""
import json
import os
import re
from pathlib import Path
from urllib.parse import quote_plus

REFERENCE_DIR = Path(os.getenv("HM_REFERENCE_DIR", Path(__file__).resolve().parent.parent / "data" / "reference"))
KB_FILE = REFERENCE_DIR / "knowledge.json"
_cache = {"mtime": None, "kb": {}}


def kb():
    m = KB_FILE.stat().st_mtime
    if _cache["mtime"] != m:
        _cache["kb"] = json.loads(KB_FILE.read_text(encoding="utf-8"))
        _cache["mtime"] = m
    return _cache["kb"]


TOPICS = [  # дарааллаар: эхний таарсан нь сэдэв болно
    ("health",   r"\bэм\b|эмч|вакцин|хавдар|өвчин|эмчил|эдгэр|вирус|халдвар|хорт|жин хас|турах|витамин|чихрийн шижин|даралт"),
    ("money",    r"мөнгө|тэтгэмж|тэтгэвэр|татвар|зээл|банк|данс|₮|төгрөг|сугалаа|хонжвор|хувьцаа|ногдол ашиг|бэлэг"),
    ("gov",      r"засгийн газ|\bуих\b|их хурал|сайд|ерөнхийлөгч|хууль|тогтоол|сонгууль|\bнам\b|шийдвэр"),
    ("disaster", r"газар хөдл|үер|түймэр|дэлбэр|осол|цацраг|уран|онцгой байдал"),
]
SCAM_IDS = {"scam", "ad_card_data", "ad_prepay", "ad_giveaway", "ad_brand_bait"}


def topic_of(text):
    for name, rx in TOPICS:
        if re.search(rx, text or "", re.I):
            return name
    return "generic"


def _attach_why(items):
    sig = kb().get("signals", {})
    out = []
    for x in items or []:
        x = dict(x)
        k = sig.get(x.get("id"), {})
        if k.get("why"):
            x["why"] = k["why"]
        if k.get("src_url"):
            x["src_name"], x["src_url"] = k.get("src_name") or "Эх сурвалж", k["src_url"]
        out.append(x)
    return out


def _search_query(text):
    t = re.sub(r"\[[^\]]+\]|https?://\S+|[^\w\s%-]", " ", text or "")
    return " ".join(t.split()[:10])


def enrich(r, text, ptype):
    if r.get("status") != "ok":
        return r
    K = kb()
    is_ad = ptype in ("ad", "commerce")
    ids = {x.get("id") for x in (r.get("evidence") or []) + (r.get("scam") or [])}

    # 1) Шалтгаан бүрт «яагаад» ба эх сурвалж
    if r.get("evidence"):
        r["evidence"] = _attach_why(r["evidence"])
    if is_ad:
        r["scam"], r["legit"] = _attach_why(r.get("scam")), _attach_why(r.get("legit"))

    # 2) Сэдэв → «Итгэвэл / Шалгавал / Өөрөөсөө асуу»
    topic = topic_of(text)
    if is_ad:
        rkey = "scam" if ids & SCAM_IDS else "ad"
    elif ids & SCAM_IDS:
        rkey = "scam"
    elif "conspiracy" in ids:
        rkey = "conspiracy"
    else:
        rkey = topic
    r["reflect"] = K.get("reflect", {}).get(rkey) or K.get("reflect", {}).get("generic")
    r["topic"] = topic

    # 3) Хууль: зөвхөн луйвар, зар, хуваалцах (уншигчийн эрх/хариуцлагын өнцгөөс)
    laws = []
    if is_ad:
        laws += K["laws"].get("ad", [])
    if ids & SCAM_IDS or r.get("zone") == "ad_scam":
        laws = K["laws"].get("scam", []) + laws
    # Хуваалцах тухай хууль (нэр төр гутаах) нь тодорхой хүн, байгууллагыг дурдсан үед л хамааралтай
    if not is_ad and (r.get("zone") == "red" or "factcheck" in ids) and \
            (ids & {"named_person", "named_source"} or topic == "gov"):
        laws += K["laws"].get("share", [])
    r["laws"] = laws

    # 4) Цааш хэрхэн шалгах
    q = _search_query(text)
    links = []
    if q:
        links.append({"title": "Google-ээс хайх", "url": "https://www.google.com/search?q=" + quote_plus(q)})
        links.append({"title": "MFCC-ээс хайх", "url": "https://mfcc.mn/?s=" + quote_plus(" ".join(q.split()[:5]))})
    off_key = "ad" if is_ad else ("scam" if rkey == "scam" else topic)
    for title, url in K.get("official", {}).get(off_key, []):
        links.append({"title": title, "url": url})
    r["check_links"] = links

    # 5) Цааш унших судалгаа
    R = K.get("research", {})
    research = []
    if "factcheck" in ids:
        research += R.get("factcheck", [])
    if ids & {"emotion", "caps", "exclaim", "emoji"}:
        research += R.get("emotion", [])
    if ids & {"urgency", "call_to_action"}:
        research += R.get("spread", [])
    if "conspiracy" in ids:
        research += R.get("conspiracy", [])
    if is_ad or ids & SCAM_IDS:
        research += R.get("scam", [])
    research += R.get("all", [])
    seen, uniq = set(), []
    for x in research:
        if x["url"] not in seen:
            seen.add(x["url"]); uniq.append(x)
    r["research"] = uniq[:4]
    return r
