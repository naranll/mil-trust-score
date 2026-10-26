"""Tests for POST /api/check. Need the trained model's dependencies (see model/requirements.txt)."""
import csv
import os

import pytest

os.environ["WHOIS_ENABLED"] = "0"
os.environ["HM_LLM"] = "0"  # these tests cover the trained rules; the Claude reader is in test_llm_score.py

pytest.importorskip("sklearn")
pytest.importorskip("lightgbm")

from fastapi.testclient import TestClient  # noqa: E402

from extension.backend.app import guard  # noqa: E402
from extension.backend.app.main import app  # noqa: E402

client = TestClient(app)
EXT = "chrome-extension://" + "a" * 32
FORBIDDEN_KEYS = {"trust", "score", "zone", "points", "text_only_trust", "verdict", "credibility"}

NEUTRAL = (
    "Сангийн яам өнөөдөр төсвийн тухай мэдэгдэл хийж, төсвийн орлого төлөвлөснөөс 4 хувиар "
    "өссөнийг Сангийн сайд танилцууллаа."
)
MANIPULATIVE = ("ЯАРАЛТАЙ!!! Энэ нууцыг засгийн газар НУУЖ БАЙНА! 100% эдгэрдэг эмийг бүгдэд нь шэйрлээрэй, "
                "цөөхөн хүн л мэднэ, дарахаас өмнө хуваалц!!!")
REFUTED = "Норвегид вакцин хийлгэсэн 23 хүн нас барсан гэнэ шүү, болгоомжтой байцгаая"
PERSONAL = "Өнөөдөр гэрийнхэнтэйгээ хамт Тэрэлж явлаа, агаар нь үнэхээр цэвэр байна 😍"
PLAIN_SALE = "Шинэ ирэлт! Ноосон цамц хар, саарал өнгөтэй. Размер S-XL. Үнэ 89,000₮"
SCAM_AD = ("Шэйрлээд бэлэг ав! Хонжвор 5 сая төгрөг, урьдчилгаа 20,000₮-ийг данс руу шилжүүлээд inbox-д бичээрэй, "
           "сүүлийн цөөн ширхэг, өнөөдөр л!")


@pytest.fixture(autouse=True)
def _reset_limits():
    guard.reset()


def check(*items):
    r = client.post("/api/check", json={"items": list(items)})
    assert r.status_code == 200, r.text
    return {x["id"]: x for x in r.json()["results"]}


def keys_deep(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from keys_deep(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from keys_deep(v)


def test_model_is_loaded():
    body = client.get("/health").json()
    assert body["model"] != "unavailable", body["model_error"]


def test_no_score_or_verdict_anywhere():
    out = check({"id": "a", "text": NEUTRAL}, {"id": "b", "text": MANIPULATIVE}, {"id": "c", "text": REFUTED},
                {"id": "d", "text": SCAM_AD, "sponsored": True}, {"id": "e", "text": PERSONAL})
    assert not FORBIDDEN_KEYS & set(keys_deep(out))
    assert {x["state"] for x in out.values()} <= {"signals", "factcheck", "not_assessed"}


def test_clean_text_is_not_assessed_never_ok():
    """No green state exists: finding nothing is 'not assessed', not 'safe'."""
    out = check({"id": "anon", "text": NEUTRAL},
                {"id": "reg", "text": NEUTRAL, "author": "Montsame", "author_url": "https://www.facebook.com/montsame.agency"})
    assert out["anon"]["state"] == "not_assessed" and out["anon"]["checked"] is True
    assert out["anon"]["why_not"] == "no_signals_found" and out["anon"]["signals"] == []
    assert out["reg"]["state"] == "not_assessed"
    assert {"id": "page_registered"} in out["reg"]["context"]   # a fact about the page, not a rating


def test_manipulative_post_has_quoted_signals():
    r = check({"id": "x", "url": "http://ikon-news.mn/shok", "text": MANIPULATIVE})["x"]
    assert r["state"] == "signals" and 1 <= len(r["signals"]) <= 3
    assert any(s.get("found") for s in r["signals"])
    assert not r["signals"][0]["model_guess"]


def test_refuted_claim_shows_the_publisher():
    r = check({"id": "x", "text": REFUTED})["x"]
    assert r["state"] == "factcheck"
    fc = r["factcheck"]
    assert fc["publisher"] in ("MFCC", "factcheck.mn") and fc["url"].startswith("https://")
    assert fc["match"] == "close"


def test_short_and_personal_posts_are_not_assessed_with_a_reason():
    out = check({"id": "s", "text": "богино"}, {"id": "p", "text": PERSONAL})
    assert (out["s"]["state"], out["s"]["checked"], out["s"]["why_not"]) == ("not_assessed", False, "too_short")
    assert (out["p"]["state"], out["p"]["post_type"], out["p"]["why_not"]) == ("not_assessed", "personal", "personal_post")


def test_ads():
    out = check({"id": "sale", "text": PLAIN_SALE, "sponsored": True},
                {"id": "scam", "text": SCAM_AD, "sponsored": True, "has_cta": True})
    assert out["scam"]["state"] == "signals" and out["scam"]["post_type"] in ("ad", "commerce")
    assert out["sale"]["state"] == "not_assessed"   # an ordinary shop post must not be flagged


def test_model_guess_never_stands_alone():
    for r in check(*({"id": str(i), "text": t} for i, t in enumerate([NEUTRAL, REFUTED, PLAIN_SALE]))).values():
        if r["signals"]:
            assert any(not s["model_guess"] for s in r["signals"])


def test_rate_limit_by_install_id(monkeypatch):
    monkeypatch.setenv("HM_CHECK_LIMIT", "2")
    h = {"X-Install-Id": "test-install-0001"}
    body = {"items": [{"id": "a", "text": "богино"}]}
    assert [client.post("/api/check", json=body, headers=h).status_code for _ in range(3)] == [200, 200, 429]
    other = {"X-Install-Id": "test-install-0002"}
    assert client.post("/api/check", json=body, headers=other).status_code == 200


def test_old_score_endpoints_are_gone():
    assert client.post("/score/posts", json={"items": []}).status_code == 404
    assert client.get("/score/mock").status_code == 404


def test_cors_blocks_foreign_web_pages():
    ext = client.options("/api/check", headers={"Origin": EXT, "Access-Control-Request-Method": "POST"})
    evil = client.options("/api/check", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert ext.headers.get("access-control-allow-origin") == EXT
    assert "access-control-allow-origin" not in evil.headers


def test_demo_pages_are_served():
    assert client.get("/demo").status_code == 200
    assert client.get("/demo/fb").status_code == 200


def test_feedback_is_off_by_default(tmp_path, monkeypatch):
    monkeypatch.setenv("HM_FEEDBACK_DIR", str(tmp_path))
    monkeypatch.delenv("HM_FEEDBACK", raising=False)
    assert client.post("/feedback/posts", json={"text": NEUTRAL, "user_label": "true"}).json() == {"ok": False, "error": "disabled"}
    assert not (tmp_path / "feedback.csv").exists()


def test_feedback_does_not_store_author(tmp_path, monkeypatch):
    monkeypatch.setenv("HM_FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setenv("HM_FEEDBACK", "1")
    r = client.post("/feedback/posts", json={
        "text": NEUTRAL, "user_label": "true", "state": "not_assessed",
        "author": "Some Person", "author_url": "https://facebook.com/some.person",
    })
    assert r.json()["ok"] is True
    rows = list(csv.DictReader((tmp_path / "feedback.csv").open(encoding="utf-8-sig")))
    assert rows[0]["user_label"] == "true" and rows[0]["state"] == "not_assessed"
    assert "Some Person" not in (tmp_path / "feedback.csv").read_text(encoding="utf-8-sig")


def test_feedback_follows_legacy_header(tmp_path, monkeypatch):
    """A feedback.csv written by an older server (author / trust columns) must stay aligned."""
    monkeypatch.setenv("HM_FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setenv("HM_FEEDBACK", "1")
    legacy = "time,user_label,text,image_text,author,author_url,url,trust,zone\n"
    (tmp_path / "feedback.csv").write_text(legacy, encoding="utf-8-sig")
    client.post("/feedback/posts", json={"text": NEUTRAL, "user_label": "false"})
    rows = list(csv.DictReader((tmp_path / "feedback.csv").open(encoding="utf-8-sig")))
    assert rows[0]["user_label"] == "false" and rows[0]["author"] == "" and rows[0]["trust"] == ""
