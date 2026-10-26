import os

os.environ["WHOIS_ENABLED"] = "0"  # no network in tests

from fastapi.testclient import TestClient

from extension.backend.app.main import app

client = TestClient(app)

GOOD_TEXT = (
    "Сангийн яам өнөөдөр төсвийн тухай мэдэгдэл хийлээ. Сайд «төсвийн орлого төлөвлөснөөс 4 хувиар өссөн» "
    "гэж мэдэгдсэн. Албан ёсны тайланг яамны цахим хуудаст байршууллаа. " * 3
)
BAD_TEXT = (
    "ШОК!!! НУУЦ НЬ ИЛЧЛЭГДЛЭЭ!!! Эх сурвалжийн мэдээлснээр нэрээ нууцалсан албаны хүн хулгайч урвагч "
    "дайсан гэж хэлсэн. Аймаар ичгүүртэй сүйрэл болж байна!!! " * 3
)


def test_health():
    assert client.get("/health").json()["ok"] is True


def test_registered_outlet_is_context_not_a_rating():
    body = client.post("/api/check/page", json={
        "url": "https://montsame.mn/mn/read/1",
        "title": "Төсвийн орлого өслөө",
        "text": GOOD_TEXT,
        "links": ["https://montsame.mn/mn/about", "https://mof.gov.mn/report"],
        "author": "Б. Болд",
        "published_date": "2026-10-24",
    }).json()
    assert body["state"] == "not_assessed" and body["signals"] == []
    assert {"registered_outlet", "has_author_date"} <= {c["code"] for c in body["context"]}
    assert "score" not in body and "zone" not in body


def test_lookalike_clickbait_has_signals():
    body = client.post("/api/check/page", json={
        "url": "http://ikon-news.mn/shok", "title": "ШОК! Та итгэхгүй!!", "text": BAD_TEXT, "links": [],
    }).json()
    assert body["state"] == "signals" and 1 <= len(body["signals"]) <= 3
    assert "domain_lookalike" in {s["code"] for s in body["signals"]}
    assert all("points" not in s for s in body["signals"])


def test_empty_page_is_not_assessed():
    body = client.post("/api/check/page", json={"url": "https://example.com/a", "title": "", "text": ""}).json()
    assert body["state"] == "not_assessed"


def test_old_endpoints_are_gone():
    assert client.post("/score", json={"url": "https://x.mn"}).status_code == 404
    assert client.post("/feedback", json={"url": "https://x.mn"}).status_code == 404
