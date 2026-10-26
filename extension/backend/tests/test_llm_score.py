"""Tests for the LLM scorer's plumbing. No network: the Claude call is replaced by a canned answer."""
import pytest

from extension.backend.app import llm_score

POST = {"id": "p1", "text": "ЭМЧ НАР НУУЖ БАЙНА! Энэ ундааг 7 хоног уувал хорт хавдар 100% эдгэрнэ",
        "image_text": None, "image_url": None, "link_domain": None, "link_title": None,
        "sponsored": False, "has_cta": False, "source_kind": "unknown", "factcheck": None}


def raw(**kw):
    base = {"id": "p1", "kind": "claim", "trust": 12, "summary": "Хэт амлалттай пост.",
            "reasons": [{"signal": "absolute", "found": "100% эдгэрнэ", "text": "Хэт итгэлтэй амлалт",
                         "why": "Эмчилгээ 100% баталгаа өгдөггүй."}],
            "trust_signals": []}
    return {**base, **kw}


def test_claim_maps_to_red_with_verbatim_quote():
    r = llm_score.to_result(raw(), POST)
    assert (r["status"], r["post_type"], r["zone"], r["trust"]) == ("ok", "claim", "red", 12)
    assert r["evidence"][0]["found"] == "100% эдгэрнэ"
    assert r["scorer"] == "llm"


def test_quote_not_in_post_is_dropped():
    reasons = [{"signal": "emotion", "found": "айдас төрүүлэх үг", "text": "Айдас", "why": "…"}]
    r = llm_score.to_result(raw(reasons=reasons), POST)
    assert "found" not in r["evidence"][0]


def test_green_needs_a_registered_source():
    assert llm_score.to_result(raw(trust=95), POST)["zone"] == "yellow"
    trusted = {**POST, "source_kind": "trusted"}
    assert llm_score.to_result(raw(trust=95), trusted)["zone"] == "green"


def test_refuted_claim_stays_red():
    fc = {**POST, "factcheck": {"strong": True, "claim": "…", "by": "MFCC"}}
    assert llm_score.to_result(raw(trust=80), fc)["zone"] == "red"


def test_ad_and_personal():
    ad = llm_score.to_result(raw(kind="ad", trust=20), POST)
    assert (ad["post_type"], ad["zone"]) == ("ad", "ad_scam")
    assert llm_score.to_result(raw(kind="personal"), POST)["status"] == "skip"


def test_score_batch_caches_and_survives_failure(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setenv("HM_LLM", "1")
    monkeypatch.setattr(llm_score, "_get_client", lambda: object())
    llm_score._cache.clear()
    calls = []

    def fake_call(posts, with_images):
        calls.append([p["id"] for p in posts])
        return llm_score.BatchScore.model_validate({"results": [raw()]})

    monkeypatch.setattr(llm_score, "_call", fake_call)
    assert set(llm_score.score_batch([POST])) == {"p1"}
    assert set(llm_score.score_batch([POST])) == {"p1"}   # second time from cache
    assert len(calls) == 1

    llm_score._cache.clear()
    monkeypatch.setattr(llm_score, "_call", lambda posts, with_images: None)
    assert llm_score.score_batch([POST]) == {}            # failure -> caller falls back to the scorecard


def test_disabled_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    assert llm_score.score_batch([POST]) == {}
