"""
Итгэлцлийн оноо — API сервер
Ажиллуулах:  uvicorn server:app --port 8000
Шалгах:      http://127.0.0.1:8000/health   ,   демо: http://127.0.0.1:8000/demo
"""
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import hm_core
import post_types
import kb

app = FastAPI(title="Итгэлцлийн оноо API")
# Зөвхөн Chrome extension-оос дуудахыг зөвшөөрнө. "*" байвал таны хөтөч дээр нээгдсэн ДУРЫН вэб хуудас
# 127.0.0.1:8000/feedback руу хуурамч санал илгээж, дахин сургах өгөгдлийг бохирдуулж чадна.
app.add_middleware(CORSMiddleware, allow_origin_regex=r"chrome-extension://.*",
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


class Item(BaseModel):
    id: str                      # extension-ий постыг таних дугаар
    text: str                    # постын текст
    url: Optional[str] = None    # пост доторх гадаад линк (байвал)
    author: Optional[str] = None       # пост оруулсан пэйж / хүний нэр
    author_url: Optional[str] = None   # түүний Facebook хаяг (slug гаргахад)
    verified: bool = False             # цэнхэр баталгаажсан тэмдэгтэй эсэх
    image_text: Optional[str] = None   # зураг дээрх бичвэр (Facebook-ийн alt текстээс)
    sponsored: bool = False            # Facebook «Sponsored» шошго
    has_cta: bool = False              # «Send message», «Shop now» гэх мэт зарын товч
    link_title: Optional[str] = None   # линкийн урьдчилсан харагдацын гарчиг


class Batch(BaseModel):
    items: List[Item]


@app.get("/health")
def health():
    return {"ok": True, "model": "scorecard v3.1"}


@app.post("/score")
def score(batch: Batch):
    # Нэг дуудлагаар олон пост — Facebook лэнд гүйлгэхэд сервер рүү цөөн хүсэлт явна
    out = []
    for it in batch.items[:50]:
        try:
            r = score_one(it)
            r = kb.enrich(r, " ".join(x for x in (it.text, it.image_text) if x), r.get("post_type"))
        except Exception as e:          # нэг пост алдаа гаргавал бусдыг нь зогсоохгүй
            r = {"status": "error", "why": str(e)}
        out.append({"id": it.id, **r})
    return {"results": out}


AD_SUMMARY = {
    "ad_scam":  "Энэ зар/худалдааны постод луйварт түгээмэл ажиглагддаг шинж илэрлээ. Мөнгө шилжүүлэх, карт оруулахаас өмнө заавал шалгаарай.",
    "ad_check": "Зар үнэн эсэхийг батлах боломжгүй. Худалдан авахаасаа өмнө доорх зүйлсийг шалгаарай.",
    "ad_ok":    "Луйврын шинж илрээгүй, итгэл нэмэх шинж байна. Гэхдээ зар бол таныг худалдан авахад ятгах зорилготой.",
}


def score_one(it):
    """1) Постын төрлийг ангилна  2) төрөлд тохирох үнэлгээг ажиллуулна"""
    full_text = " ".join(x for x in (it.text, it.image_text) if x)
    ptype, why_type = post_types.classify(full_text, it.sponsored, it.has_cta)

    if ptype in ("ad", "commerce"):
        kind, s_why = hm_core.source_adjust(it.author, it.author_url, it.verified)
        r = post_types.ad_score(full_text, ptype, kind, it.url, it.link_title)
        if kind == "lookalike":
            r["scam"].insert(0, {"id": "ad_lookalike_page", "found": it.author or ""})
            r["state"] = "ad_scam"
        # Зар дотор өмнө нь няцаагдсан мэдэгдэл (жишээ нь «энэ цай хорт хавдар эдгээнэ») байвал
        fc = hm_core.factcheck_match(hm_core.clean(full_text)) if len(full_text.split()) >= 6 else None
        if fc and fc["strong"] and not hm_core.is_debunk(full_text):
            r["scam"].insert(0, {"id": "factcheck", "found": fc["claim"][:60]}); r["state"] = "ad_scam"
        else:
            fc = None
        for x in r["scam"] + r["legit"]:
            x["text"] = post_types.AD_TEXT.get(x["id"], x["id"])
        return {"status": "ok", "post_type": ptype, "type_why": why_type, "zone": r["state"],
                "summary": AD_SUMMARY[r["state"]], "scam": r["scam"], "legit": r["legit"],
                "factcheck": fc, "source": kind}

    if ptype == "personal":
        return {"status": "skip", "post_type": "personal", "why": "Энгийн пост — шалгах мэдэгдэл алга"}

    # ptype == "claim" → өмнөх үнэлгээ (текст ба зурган бичвэрийг тусад нь, эрсдэлтэйг нь)
    args = (it.url, it.author, it.author_url, it.verified, it.link_title)
    r_txt = hm_core.trust_score(it.text, *args) if it.text else {"status": "skip"}
    if it.image_text:
        r_img = hm_core.trust_score(it.image_text, *args)
        if r_img.get("status") == "ok" and (r_txt.get("status") != "ok" or r_img["trust"] < r_txt["trust"]):
            r_img["from_image"] = it.image_text
            r_img["risks"] = ["🖼 Зураг дээрх бичвэрт: " + x for x in r_img["risks"][:2]] + r_img["risks"][2:]
            r_txt = r_img
    r_txt["post_type"] = "claim"
    return r_txt


# ---------------------------------------------------------------------------
# Санал хүсэлт (хэрэглэгчийн шошго) → feedback.csv → tools/retrain_with_feedback.py
# ---------------------------------------------------------------------------
import csv
from datetime import datetime

FEEDBACK = Path(__file__).parent / "feedback.csv"
FB_COLS = ["time", "user_label", "text", "image_text", "author", "author_url", "url", "trust", "zone", "post_type"]


class Feedback(BaseModel):
    text: str = ""
    image_text: Optional[str] = None
    url: Optional[str] = None
    author: Optional[str] = None
    author_url: Optional[str] = None
    user_label: str                     # true / false / not_claim / unsure
    trust: Optional[int] = None         # загварын өгсөн оноо (харьцуулахад)
    zone: Optional[str] = None
    post_type: Optional[str] = None     # ангилагчийн гаргасан төрөл (ангиллын өгөгдөл цуглуулахад)


@app.post("/feedback")
def feedback(fb: Feedback):
    if fb.user_label not in ("true", "false", "not_claim", "unsure", "wrong_type"):
        return {"ok": False, "error": "user_label буруу"}
    if FEEDBACK.exists():
        # Хуучин хувилбарын (өөр баганатай) файл байвал хадгалж үлдээгээд шинээр эхэлнэ
        with FEEDBACK.open(encoding="utf-8-sig") as f:
            header = f.readline().strip().split(",")
        if header != FB_COLS:
            FEEDBACK.rename(FEEDBACK.with_name(f"feedback_old_{datetime.now():%H%M%S}.csv"))
    new = not FEEDBACK.exists()
    # utf-8-sig → Excel дээр нээхэд монгол үсэг эвдрэхгүй
    with FEEDBACK.open("a", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FB_COLS)
        if new:
            w.writeheader()
        w.writerow({"time": datetime.now().isoformat(timespec="seconds"), **fb.model_dump()})
    with FEEDBACK.open(encoding="utf-8-sig") as f:
        count = sum(1 for _ in csv.reader(f)) - 1
    return {"ok": True, "count": count}


@app.get("/demo/fb")
def demo_fb():
    # Facebook-ийн бодит DOM бүтцийг (fb_structure.json) дуурайсан туршилтын хуудас
    return FileResponse(Path(__file__).parent.parent / "demo" / "fb_like.html")


@app.get("/demo")
def demo():
    # Facebook-д нэвтрэхгүйгээр танилцуулга хийх демо хуудас
    return FileResponse(Path(__file__).parent.parent / "demo" / "demo.html")
