"""
Итгэлцлийн оноо — загварын цөм (notebook-ийн 1, 8, 9-р алхмыг сервер дээр ажиллуулах хувилбар)

Энэ файл юу хийдэг вэ:
  1. clean()        — сургалтын өгөгдөлтэй ЯГ ижил цэвэрлэгээ (линк, утас, он маскална, эхний 2 өгүүлбэр)
  2. signals()      — тайлбарлагдахуйц шинж тэмдгүүд (clickbait, яаруулах, луйвар …)
  3. trust_score()  — 0–100 оноо + бүс + шалтгаан
  4. guardrail      — манипуляцийн дохио илрээгүй бол 🔴 болгохгүй (хамгийн ихдээ 🟡)
  5. claim шүүлтүүр — хэт богино / латин үсэгтэй / мэдэгдэлгүй постыг оноолохгүй
"""
import html
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Файлын байршил (repo-ийн бүтэц: model/artifacts, data/reference). Орчны хувьсагчаар солих боломжтой.
# ---------------------------------------------------------------------------
import os

MODEL_DIR = Path(__file__).resolve().parent
REPO_ROOT = MODEL_DIR.parent
ARTIFACTS_DIR = Path(os.getenv("HM_ARTIFACTS_DIR", MODEL_DIR / "artifacts"))
REFERENCE_DIR = Path(os.getenv("HM_REFERENCE_DIR", REPO_ROOT / "data" / "reference"))

# ---------------------------------------------------------------------------
# 1. Цэвэрлэгээ — build_dataset.py-ийн clean()-тэй ижил (өөр байвал загвар төөрнө)
# ---------------------------------------------------------------------------
MAX_WORDS = 60
URL_RE = re.compile(r"(https?://\S+|www\.\S+|\b[a-z0-9-]+\.(mn|com|net|org|io|me|ly)(/\S*)?)", re.I)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
PHONE_RE = re.compile(r"(?<![\d\-])(?:\+?976[\s-]?)?[6-9]\d{3}[\s-]?\d{4}(?![\d\-])")
QUOTES = "“”\"«»„'‘’ "


def clip_words(t, n=MAX_WORDS):
    words = t.split()
    if len(words) <= n:
        return t
    cut = " ".join(words[:n])
    m = list(re.finditer(r"[.!?…](?=\s|$)", cut))
    return cut[:m[-1].end()] if m and m[-1].end() > len(cut) * 0.5 else cut


def clean(t):
    t = html.unescape(str(t or ""))
    t = re.sub(r"\s+", " ", t).strip().strip(QUOTES).strip()
    t = EMAIL_RE.sub("[ИМЭЙЛ]", t)
    t = URL_RE.sub("[ЛИНК]", t)
    t = PHONE_RE.sub("[УТАС]", t)
    t = re.sub(r"\b(19|20)\d{2}\b", "[ОН]", t)
    sents = re.split(r"(?<=[.!?…])\s+(?=[\"«“„А-ЯЁӨҮA-Z0-9\[])", t)
    t = clip_words(" ".join(sents[:2]))
    return re.sub(r"[\s.,;:–—-]+$", "", t).strip()


def cyrillic_ratio(t):
    letters = re.findall(r"[A-Za-zА-Яа-яЁёӨөҮү]", re.sub(r"\[[^\]]+\]", "", t))
    if not letters:
        return 0.0
    return sum(1 for c in letters if re.match(r"[А-Яа-яЁёӨөҮү]", c)) / len(letters)


# ---------------------------------------------------------------------------
# 2. Загвар ачаалах
# ---------------------------------------------------------------------------
# Path ашигласнаар Windows (\) ба Mac/Linux (/) аль алинд нь зөв зам гарна
B = joblib.load(ARTIFACTS_DIR / "hackmil_scorecard.joblib")
MODEL, EXPLAINER, TM, COLS = B["model"], B["explainer"], B["text_model"], B["cols"]
SIGNALS, EXTRA, WHITELIST = B["signals"], B["extra"], B["whitelist"]
MONO = {**{k: v[1] for k, v in SIGNALS.items()}, **{k: v[0] for k, v in EXTRA.items()}, "text_model": +1}

EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
INITIALS = re.compile(r"\b[А-ЯЁӨҮ]\.[А-ЯЁӨҮ][а-яёөү]+")

# Guardrail-д тооцох "жинхэнэ манипуляцийн" дохио.
# emotion / anon_source / call_to_action-ийг оруулаагүй: "харамсалтай", "гэнэ", "болгоомжтой байгаарай"
# гэх мэт үгийг энгийн үнэн пост ч ихэвчлэн хэрэглэдэг.
MANIP = ["clickbait", "urgency", "absolute", "conspiracy", "scam"]


def signals(texts):
    rows = []
    for t in texts:
        t = str(t); low = t.lower(); n = max(len(t), 1)
        r = {k: len(re.findall(v[0], low)) for k, v in SIGNALS.items()}
        r.update(caps=sum(c.isupper() for c in t) / n, exclaim=t.count("!"), question=t.count("?"),
                 emoji=len(EMOJI.findall(t)), named_person=len(INITIALS.findall(t)),
                 numbers=len(re.findall(r"\d", t)) / n, n_words=len(t.split()))
        rows.append(r)
    return pd.DataFrame(rows)


def manipulation_fired(S_row, raw_text):
    """Ямар нэг манипуляцийн дохио илэрсэн үү (guardrail-д)"""
    r = S_row.iloc[0]
    if any(r[k] > 0 for k in MANIP):
        return True
    # Том үсэг, анхаарлын тэмдгийг цэвэрлэгээний ӨМНӨХ бүтэн текстээс харна
    letters = [c for c in raw_text if c.isalpha()]
    caps = sum(c.isupper() for c in letters) / max(len(letters), 1)
    return caps >= 0.30 or raw_text.count("!") >= 3


# ---------------------------------------------------------------------------
# 3. Шалтгаан (SHAP) ба домэйн
# ---------------------------------------------------------------------------
# Хэрэглэгчид ойлгомжтой тайлбар: {m} = текстээс олдсон яг тэр үг. Юу олдсон + яагаад анхаарах ёстой
EXPLAIN = {
    "clickbait":      "Сонирхол татах гэсэн хэллэг: «{m}» — гарчиг нь агуулгаасаа илүү цочирдуулж байж магадгүй",
    "emotion":        "Айдас, сэтгэл хөдлөл төрүүлэх үг: «{m}» — сандарсан үедээ шалгалгүй итгэх нь амархан",
    "urgency":        "Яаруулж, тараахыг шахаж байна: «{m}» — хуваалцахаасаа өмнө шалгаарай",
    "absolute":       "Хэт итгэлтэй амлалт: «{m}» — эм, эмчилгээ, мөнгө ингэж 100% баталгаа өгдөггүй",
    "conspiracy":     "«Нууж байна» маягийн хэллэг: «{m}» — нотолгоо байхгүй үед ихэвчлэн хэрэглэдэг",
    "anon_source":    "Хэн хэлснийг тодорхой заагаагүй: «{m}» — аль эмч, аль судалгаа, хэн гэж?",
    "scam":           "Луйврын шинж: «{m}» — банк, байгууллага линкээр картын мэдээлэл асуудаггүй",
    "call_to_action": "Танаас ямар нэг үйлдэл хийхийг шаардаж байна: «{m}»",
    "named_source":   "Байгууллагыг нэрээр нь дурдсан: «{m}» — тэр байгууллагын албан хуудаснаас шалгаж болно",
    "named_person":   "Хүнийг нэрээр нь дурдсан: «{m}»",
    "caps":           "ТОМ ҮСГЭЭР «хашгирсан» бичиг их байна — анхаарал булаах арга",
    "exclaim":        "Анхаарлын тэмдэг (!) олон — сэтгэл хөдлөл өдөөх арга",
    "question":       "Хариугүй, айлгасан асуултууд олон",
    "emoji":          "Emoji олон — сэтгэл хөдлөл өдөөх арга",
}
STYLE_BAD = "Бичих хэлбэр нь өмнө нь худал болох нь тогтоогдсон постуудтай төстэй (загварын дүгнэлт)"
STYLE_GOOD = "Бичих хэлбэр нь мэдээллийн сайтын мэдээтэй төстэй (загварын дүгнэлт)"


def explain(f, text):
    """Шинж бүрийг энгийн үгээр, текстээс олдсон жишээтэй нь тайлбарлана"""
    tpl = EXPLAIN.get(f)
    if not tpl:
        return None
    if "{m}" not in tpl:
        return tpl
    if f == "named_person":
        m = INITIALS.search(text)
    else:
        m = re.search(SIGNALS[f][0], text.lower())
    if not m:
        return tpl.split(":")[0]
    a, b = m.span()
    # Олдсон хэсгийг бүтэн үг болтол өргөтгөнө ("шэйр" → "ШЭЙРЛЭЭРЭЙ")
    while a > 0 and text[a - 1].isalnum():
        a -= 1
    while b < len(text) and (text[b].isalnum() or text[b] == "%"):
        b += 1
    return tpl.format(m=text[a:b][:30])


def reasons(S_row, text):
    contrib = EXPLAINER.booster_.predict(S_row[COLS], pred_contrib=True)[0][:-1]
    minus, plus, keys = [], [], []
    for i in np.argsort(-np.abs(contrib)):
        f, c, v = COLS[i], contrib[i], S_row[COLS[i]].iloc[0]
        if f in SIGNALS:
            fired = v > 0
        elif f in EXTRA and EXTRA[f][1]:
            fired = v >= EXTRA[f][2]
        elif f == "text_model":
            fired = True
        else:
            continue
        if not fired:
            continue
        why = (STYLE_BAD if c > 0 else STYLE_GOOD) if f == "text_model" else explain(f, text)
        if (c > 0 and MONO[f] >= 0) or (f == "text_model" and c > 0):
            minus.append(why); keys.append(f)
        elif (c < 0 and MONO[f] <= 0) or (f == "text_model" and c < 0):
            plus.append(why)
    return minus[:3], plus[:2], keys


SUMMARY = {
    "green":  "Анхаарах шинж бараг илэрсэнгүй.",
    "yellow": "Итгэх эсэхээ шийдэхээсээ өмнө эх сурвалжийг нь шалгаарай.",
    "red":    "Худал мэдээлэлд түгээмэл ажиглагддаг хэд хэдэн шинж илэрлээ.",
}


def mil_card(keys):
    """Хамгийн гол эрсдэлийн шалтгаанд тохирох MIL сургалтын карт"""
    for k in keys:
        if k in SIGNALS:
            return SIGNALS[k][3]
    return "Мэдээллийг хэрхэн шалгах вэ: эх сурвалж, огноо, өөр сайт"


def levenshtein(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def domain_adjust(url):
    if not url:
        return 0, []
    host = re.sub(r"^https?://(www\.)?", "", url.lower()).split("/")[0]
    if host in WHITELIST:
        return +10, ["+ Бүртгэлтэй хэвлэл мэдээллийн байгууллагын линк"]
    adj, why = 0, []
    if any(0 < levenshtein(host, w) <= 2 for w in WHITELIST):
        adj -= 30; why.append("− Алдартай мэдээллийн сайтыг дуурайсан домэйн нэр")
    if url.lower().startswith("http://"):
        adj -= 10; why.append("− HTTPS байхгүй линк")
    return adj, why


def zone(trust):
    return "green" if trust >= 70 else ("yellow" if trust >= 40 else "red")


# ---------------------------------------------------------------------------
# 4. Эх сурвалж (Facebook пэйж / зохиогч) — шинжээчийн дүрэм, өгөгдлөөр сургаагүй
# ---------------------------------------------------------------------------
import json

PAGES_FILE = REFERENCE_DIR / "trusted_pages.json"


def norm_name(s):
    """«Medee.mn - Мэдээ» → «medeemnмэдээ»: том/жижиг үсэг, хоосон зай, цэг, зураасыг үл тооно"""
    return re.sub(r"[\s.\-_|·•,:]+", "", str(s or "").lower())


def page_slug(url):
    """facebook.com/medee.mn/posts/.. → medee.mn ; profile.php?id=123 → id:123"""
    if not url:
        return ""
    m = re.search(r"[?&]id=(\d+)", url)
    if m:
        return "id:" + m.group(1)
    m = re.search(r"facebook\.com/(?:pg/|people/[^/]+/)?([A-Za-z0-9.\-_]+)", url)
    return m.group(1).lower() if m and m.group(1) not in ("groups", "watch", "story.php", "photo", "reel") else ""


def load_pages():
    # Сервер ажиллаж байх үед json-оо засахад шууд уншина (restart хэрэггүй)
    try:
        data = json.loads(PAGES_FILE.read_text(encoding="utf-8"))
    except Exception:
        data = []
    # Пэйж бүрийн бүх нэр (үндсэн + aliases) болон slug
    return [{"names": {norm_name(n) for n in [p.get("name"), *p.get("aliases", [])] if n},
             "slug": str(p.get("slug", "")).lower(), "title": p.get("name")} for p in data]


def source_adjust(author, author_url, verified):
    """Буцаах: (төрөл, тайлбар) — төрөл нь trusted / lookalike / verified / unknown
    Slug (facebook.com/<slug>) давтагдашгүй тул нэрнээс илүү найдвартай: хуурамч пэйж нэрийг яг
    хуулж болох ч slug-ийг хуулж чадахгүй."""
    pages = load_pages()
    n, s = norm_name(author), page_slug(author_url)
    for p in pages:
        if s and p["slug"] and s == p["slug"]:
            return "trusted", f"✔ Бүртгэлтэй мэдээллийн пэйж: {author or p['title']}"
    for p in pages:
        if n and n in p["names"]:
            # id:123 хэлбэрийн хаягаар (vanity нэргүй линк) дуурайсан гэж дүгнэхгүй
            if s and not s.startswith("id:") and p["slug"] and s != p["slug"]:
                # Нэр нь яг ижил боловч хаяг нь өөр → дуурайсан пэйж байх магадлал өндөр
                return "lookalike", f"− «{author}» нэртэй боловч албан ёсны {p['title']} пэйжийн хаяг биш"
            return "trusted", f"✔ Бүртгэлтэй мэдээллийн пэйж: {author}"
    all_names = [x for p in pages for x in p["names"] if len(x) >= 5]
    # Нэр нь бүртгэлтэй пэйжтэй маш төстэй боловч яг биш → дуурайсан байж магадгүй
    if n and len(n) >= 5 and any(0 < levenshtein(n, x) <= 2 for x in all_names):
        return "lookalike", f"− «{author}» нэр нь алдартай пэйжийг дуурайсан байж магадгүй"
    if verified:
        return "verified", "+ Баталгаажсан (цэнхэр тэмдэгтэй) хаяг — гэхдээ энэ нь үнэн гэсэн баталгаа биш"
    return "unknown", ""


# ---------------------------------------------------------------------------
# 6. Баримт шалгалтын индекс — «энэ мэдэгдлийг өмнө нь няцаасан уу?»
# ---------------------------------------------------------------------------
from sklearn.metrics.pairwise import cosine_similarity

FC_FILE = ARTIFACTS_DIR / "factcheck_index.joblib"
FC = joblib.load(FC_FILE) if FC_FILE.exists() else None
# Босго: үнэн мэдээний 0.1%-ийг л буруу таардаг, өөрөөр бичсэн (paraphrase) худлын ~2/3-ийг олдог
FC_STRONG, FC_WEAK = 0.45, 0.38
# Пост нь худлыг ИШЛЭЭД няцааж байгаа бол (жишээ нь MFCC-ийн пост) шийтгэхгүй
DEBUNK_RE = re.compile(r"худал|няцаа|баримт шалга|хуурамч|ташаа|үнэн биш|төөрөгдүүлсэн|fact.?check", re.I)
FC_LABEL = {"false": "худал", "misleading": "төөрөгдүүлсэн", "inaccurate": "ташаа"}


def factcheck_match(text):
    if FC is None:
        return None
    sims = cosine_similarity(FC["vec"].transform([text]), FC["X"])[0]
    i = int(sims.argmax())
    if sims[i] < FC_WEAK:
        return None
    src = "MFCC" if FC["platform"][i] == "mfcc" else "factcheck.mn"
    return {"sim": round(float(sims[i]), 2), "strong": bool(sims[i] >= FC_STRONG), "claim": FC["text"][i],
            "url": FC["url"][i], "verdict": FC_LABEL.get(FC["label"][i], "худал"), "date": FC["date"][i][:10], "by": src}


# ---------------------------------------------------------------------------
# 5. Эцсийн функц
# ---------------------------------------------------------------------------
STRONG = ["scam", "urgency", "absolute", "conspiracy"]   # бүртгэлтэй пэйж ч гэсэн нуухгүй дохио


def trust_score(raw_text, url=None, author=None, author_url=None, verified=False):
    text = clean(raw_text)
    # Claim шүүлтүүр: оноох утгагүй постыг алгасна (зураг дээрх тайлбар, мэндчилгээ, англи пост …)
    if len([w for w in text.split() if re.search(r"[^\W\d_]", w)]) < 6:   # emoji, тоог үг гэж тооцохгүй
        return {"status": "skip", "why": "Хэт богино — шалгах мэдэгдэл алга"}
    if cyrillic_ratio(text) < 0.6:
        return {"status": "skip", "why": "Монгол (кирилл) бичвэр биш"}

    S = signals([text])
    S["text_model"] = TM.predict_proba([text])[:, 1]
    trust = 100 * (1 - MODEL.predict_proba(S[COLS])[0, 1])
    text_trust = trust                                   # зөвхөн текстийн оноо (тайлбарт)

    d_adj, d_why = domain_adjust(url)
    trust = float(np.clip(trust + d_adj, 0, 100))

    # Эх сурвалжийн модуль
    kind, s_why = source_adjust(author, author_url, verified)
    strong = any(S[k].iloc[0] > 0 for k in STRONG)
    if kind == "trusted":
        # Бүртгэлтэй пэйж: хүчтэй манипуляцийн дохио байхгүй бол хамгийн багадаа 🟢
        trust = max(trust, 75.0) if not strong else min(100.0, trust + 20)
    elif kind == "lookalike":
        trust = max(0.0, trust - 25)
    elif kind == "verified":
        trust = min(100.0, trust + 10)

    # Guardrail: манипуляцийн дохио ОГТ байхгүй бол 🔴 болгохгүй — хэв маягаар л буруутгахаас сэргийлнэ
    guard = False
    if trust < 40 and not manipulation_fired(S, raw_text) and d_adj >= 0 and kind != "lookalike":
        trust, guard = 40.0, True

    # Баримт шалгалттай тулгах: өмнө нь няцаагдсан мэдэгдэлтэй маш төстэй бол хамгийн хүчтэй дохио
    fc = factcheck_match(text)
    debunk = bool(DEBUNK_RE.search(raw_text))
    if fc and fc["strong"] and kind != "trusted" and not debunk:
        trust, guard = min(trust, 15.0), False

    minus, plus, keys = reasons(S, text)
    # Илэрсэн манипуляцийн дохиог SHAP-ийн дарааллаас үл хамааран заавал харуулна
    fired = [k for k in MANIP if S[k].iloc[0] > 0]
    fired_txt = [explain(k, text) for k in fired]
    minus = fired_txt + [m for m in minus if m not in fired_txt]
    keys = fired + [k for k in keys if k not in fired]
    if kind == "trusted":                    # бүртгэлтэй пэйж дээр «хэв маяг» гэсэн шалтгааныг харуулахгүй
        minus = [m for m in minus if m != STYLE_BAD]
    minus = ([s_why] if kind == "lookalike" else []) + minus
    if fc and not debunk:
        what = "маш төстэй" if fc["strong"] else "төстэй"
        minus = [f"Үүнтэй {what} мэдэгдлийг {fc['by']} өмнө нь «{fc['verdict']}» гэж тогтоосон"
                 + (f" ({fc['date']})" if fc["date"] else "")] + minus
    plus = ([s_why] if kind in ("trusted", "verified") else []) + plus
    return {
        "status": "ok",
        "trust": round(trust),
        "zone": zone(trust),
        "summary": SUMMARY[zone(trust)],
        "risks": (minus + [w for w in d_why if w.startswith("−")])[:4],
        "trust_signals": (plus + [w for w in d_why if w.startswith("+")])[:3],
        "card": mil_card(keys),
        "guardrail": guard,
        "source": kind,
        "text_only_trust": round(text_trust),
        "factcheck": fc if (fc and not debunk) else None,
    }
