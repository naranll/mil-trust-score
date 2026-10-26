"""Tests for the extension-facing endpoints. Need the trained model's dependencies (see model/requirements.txt)."""
import csv
import os

import pytest

os.environ["WHOIS_ENABLED"] = "0"

pytest.importorskip("sklearn")
pytest.importorskip("lightgbm")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)

NEUTRAL = (
    "Сангийн яам өнөөдөр төсвийн тухай мэдэгдэл хийж, төсвийн орлого төлөвлөснөөс 4 хувиар "
    "өссөнийг Сангийн сайд танилцууллаа."
)


def test_model_is_loaded():
    body = client.get("/health").json()
    assert body["model"] != "unavailable", body["model_error"]


def test_score_posts_batch_shape():
    r = client.post("/score/posts", json={"items": [
        {"id": "a", "text": NEUTRAL},
        {"id": "b", "text": "богино"},
    ]}).json()
    by_id = {x["id"]: x for x in r["results"]}
    assert by_id["a"]["status"] == "ok"
    assert by_id["b"]["status"] == "skip"  # too short to be a claim
    assert {"trust", "risks", "trust_signals", "card"} <= set(by_id["a"])


def test_green_needs_a_verified_source():
    """Clean text from an unknown source is capped at yellow; the same text from a registered page is green."""
    r = client.post("/score/posts", json={"items": [
        {"id": "anon", "text": NEUTRAL},
        {"id": "reg", "text": NEUTRAL, "author": "Montsame", "author_url": "https://www.facebook.com/montsame.agency"},
    ]}).json()
    by_id = {x["id"]: x for x in r["results"]}
    assert by_id["anon"]["zone"] == "yellow" and by_id["anon"]["trust"] <= 69
    assert by_id["reg"]["zone"] == "green" and by_id["reg"]["source"] == "trusted"


def test_manipulative_post_is_red():
    r = client.post("/score/posts", json={"items": [{
        "id": "x", "url": "http://ikon-news.mn/shok",
        "text": "ЯАРАЛТАЙ!!! Энэ нууцыг засгийн газар НУУЖ БАЙНА! 100% эдгэрдэг эмийг бүгдэд нь шэйрлээрэй, "
                "цөөхөн хүн л мэднэ, дарахаас өмнө хуваалц!!!",
    }]}).json()["results"][0]
    assert r["status"] == "ok" and r["zone"] == "red" and r["risks"]


PERSONAL = "Өнөөдөр гэрийнхэнтэйгээ хамт Тэрэлж явлаа, агаар нь үнэхээр цэвэр байна 😍"
PLAIN_SALE = "Шинэ ирэлт! Ноосон цамц хар, саарал өнгөтэй. Размер S-XL. Үнэ 89,000₮"
SCAM_AD = ("Шэйрлээд бэлэг ав! Хонжвор 5 сая төгрөг, урьдчилгаа 20,000₮-ийг данс руу шилжүүлээд inbox-д бичээрэй, "
           "сүүлийн цөөн ширхэг, өнөөдөр л!")


def test_personal_post_is_skipped_with_type():
    r = client.post("/score/posts", json={"items": [{"id": "p", "text": PERSONAL}]}).json()["results"][0]
    assert r["status"] == "skip" and r["post_type"] == "personal"


def test_ads_get_ad_scoring_not_a_news_score():
    r = client.post("/score/posts", json={"items": [
        {"id": "sale", "text": PLAIN_SALE, "sponsored": True},
        {"id": "scam", "text": SCAM_AD, "sponsored": True, "has_cta": True},
    ]}).json()["results"]
    by_id = {x["id"]: x for x in r}
    for x in by_id.values():
        assert x["status"] == "ok" and x["post_type"] in ("ad", "commerce")
        assert x["zone"] in ("ad_ok", "ad_check", "ad_scam") and "trust" not in x
    assert by_id["scam"]["zone"] == "ad_scam" and by_id["scam"]["scam"]
    assert by_id["sale"]["zone"] != "ad_scam"  # an ordinary shop post must not be flagged as a scam


def test_cors_blocks_foreign_web_pages():
    ext = client.options("/feedback/posts", headers={"Origin": "chrome-extension://abc", "Access-Control-Request-Method": "POST"})
    evil = client.options("/feedback/posts", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert ext.headers.get("access-control-allow-origin") == "chrome-extension://abc"
    assert "access-control-allow-origin" not in evil.headers


def test_demo_pages_are_served():
    assert client.get("/demo").status_code == 200
    assert client.get("/demo/fb").status_code == 200


def test_feedback_posts_does_not_store_author(tmp_path, monkeypatch):
    monkeypatch.setenv("HM_FEEDBACK_DIR", str(tmp_path))
    r = client.post("/feedback/posts", json={
        "text": NEUTRAL, "user_label": "true", "trust": 98, "zone": "green",
        "author": "Some Person", "author_url": "https://facebook.com/some.person",
    })
    assert r.json()["ok"] is True
    rows = list(csv.DictReader((tmp_path / "feedback.csv").open(encoding="utf-8-sig")))
    assert rows[0]["user_label"] == "true"
    assert "author" not in rows[0] and "author_url" not in rows[0]
    assert "Some Person" not in (tmp_path / "feedback.csv").read_text(encoding="utf-8-sig")


def test_feedback_follows_legacy_header(tmp_path, monkeypatch):
    """A feedback.csv written by the old server (with author columns) must stay aligned."""
    monkeypatch.setenv("HM_FEEDBACK_DIR", str(tmp_path))
    legacy = "time,user_label,text,image_text,author,author_url,url,trust,zone\n"
    (tmp_path / "feedback.csv").write_text(legacy, encoding="utf-8-sig")
    client.post("/feedback/posts", json={"text": NEUTRAL, "user_label": "false", "trust": 20, "zone": "red"})
    rows = list(csv.DictReader((tmp_path / "feedback.csv").open(encoding="utf-8-sig")))
    assert rows[0]["user_label"] == "false" and rows[0]["trust"] == "20" and rows[0]["author"] == ""
