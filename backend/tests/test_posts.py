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
    assert by_id["a"]["status"] == "ok" and by_id["a"]["zone"] == "green"
    assert by_id["b"]["status"] == "skip"  # too short to be a claim
    assert {"trust", "risks", "trust_signals", "card"} <= set(by_id["a"])


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
