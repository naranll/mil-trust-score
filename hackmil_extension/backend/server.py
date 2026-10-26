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

app = FastAPI(title="Итгэлцлийн оноо API")
# Extension-ий background script-ээс дуудна. Хакатонд бүгдийг зөвшөөрнө (production-д хязгаарлана)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Item(BaseModel):
    id: str                      # extension-ий постыг таних дугаар
    text: str                    # постын текст
    url: Optional[str] = None    # пост доторх гадаад линк (байвал)
    author: Optional[str] = None       # пост оруулсан пэйж / хүний нэр
    author_url: Optional[str] = None   # түүний Facebook хаяг (slug гаргахад)
    verified: bool = False             # цэнхэр баталгаажсан тэмдэгтэй эсэх
    image_text: Optional[str] = None   # зураг дээрх бичвэр (Facebook-ийн alt текстээс)


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
        except Exception as e:          # нэг пост алдаа гаргавал бусдыг нь зогсоохгүй
            r = {"status": "error", "why": str(e)}
        out.append({"id": it.id, **r})
    return {"results": out}


def score_one(it):
    """Постын текст ба зураг дээрх бичвэрийг ТУСАД НЬ оноож, илүү эрсдэлтэйг нь сонгоно.
    Яагаад нийлүүлэхгүй вэ? clean() эхний 2 өгүүлбэрийг л авдаг тул урт текст + зурагны бичвэрийг
    нийлүүлбэл зурагны хэсэг тасарна. Мөн «зураг дээр луйвар, тайлбар нь энгийн» тохиолдлыг алдахгүй."""
    args = (it.url, it.author, it.author_url, it.verified)
    r_txt = hm_core.trust_score(it.text, *args) if it.text else {"status": "skip"}
    if not it.image_text:
        return r_txt
    r_img = hm_core.trust_score(it.image_text, *args)
    if r_img.get("status") != "ok":
        return r_txt
    if r_txt.get("status") != "ok" or r_img["trust"] < r_txt["trust"]:
        r_img["from_image"] = it.image_text
        r_img["risks"] = ["🖼 Зураг дээрх бичвэрт: " + x for x in r_img["risks"][:2]] + r_img["risks"][2:]
        return r_img
    return r_txt


# ---------------------------------------------------------------------------
# Санал хүсэлт (хэрэглэгчийн шошго) → feedback.csv → tools/retrain_with_feedback.py
# ---------------------------------------------------------------------------
import csv
from datetime import datetime

FEEDBACK = Path(__file__).parent / "feedback.csv"
FB_COLS = ["time", "user_label", "text", "image_text", "author", "author_url", "url", "trust", "zone"]


class Feedback(BaseModel):
    text: str = ""
    image_text: Optional[str] = None
    url: Optional[str] = None
    author: Optional[str] = None
    author_url: Optional[str] = None
    user_label: str                     # true / false / not_claim
    trust: Optional[int] = None         # загварын өгсөн оноо (харьцуулахад)
    zone: Optional[str] = None


@app.post("/feedback")
def feedback(fb: Feedback):
    if fb.user_label not in ("true", "false", "not_claim"):
        return {"ok": False, "error": "user_label буруу"}
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


@app.get("/demo")
def demo():
    # Facebook-д нэвтрэхгүйгээр танилцуулга хийх демо хуудас
    return FileResponse(Path(__file__).parent.parent / "demo" / "demo.html")
