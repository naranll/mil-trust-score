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


def test_registered_outlet_is_green():
    r = client.post("/score", json={
        "url": "https://montsame.mn/mn/read/1",
        "title": "Төсвийн орлого өслөө",
        "text": GOOD_TEXT,
        "links": ["https://montsame.mn/mn/about", "https://mof.gov.mn/report"],
        "author": "Б. Болд",
        "published_date": "2026-10-24",
    })
    body = r.json()
    assert body["zone"] == "green" and body["score"] >= 70
    assert len(body["reasons"]) <= 3


def test_lookalike_clickbait_is_red():
    r = client.post("/score", json={
        "url": "http://ikon-news.mn/shok",
        "title": "ШОК! Та итгэхгүй!!",
        "text": BAD_TEXT,
        "links": [],
    })
    body = r.json()
    assert body["zone"] == "red" and body["score"] < 40
    assert all(x["points"] < 0 for x in body["reasons"])


def test_unknown_features_do_not_punish():
    r = client.post("/score", json={"url": "https://example.com/a", "title": "", "text": ""})
    assert r.json()["score"] == 60


def test_mock_and_feedback(tmp_path, monkeypatch):
    monkeypatch.setenv("HM_FEEDBACK_DIR", str(tmp_path))  # never write into the real data/feedback
    for z in ("red", "yellow", "green"):
        assert client.get(f"/score/mock?zone={z}").json()["zone"] == z
    r = client.post("/feedback", json={"url": "https://x.mn", "score_shown": 20, "user_says": "too_low"})
    assert r.json() == {"saved": True}
    assert (tmp_path / "page_feedback.jsonl").exists()
