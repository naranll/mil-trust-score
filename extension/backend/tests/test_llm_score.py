"""Tests for the Claude reader's plumbing. No network: the Claude call is replaced by a canned answer."""
from extension.backend.app import llm_score
from extension.backend.app.signals import to_signals

POST = {"id": "p1", "text": "ЭМЧ НАР НУУЖ БАЙНА! Энэ ундааг 7 хоног уувал хорт хавдар 100% эдгэрнэ",
        "image_text": None, "image_url": None, "link_domain": None, "link_title": None,
        "sponsored": False, "has_cta": False, "source_kind": "unknown", "factcheck": None}


def raw(**kw):
    base = {"id": "p1", "kind": "claim",
            "reasons": [{"signal": "absolute", "found": "100% эдгэрнэ", "text": "Хэт итгэлтэй амлалт",
                         "why": "Эмчилгээ 100% баталгаа өгдөггүй."}]}
    return {**base, **kw}


def test_schema_has_no_score():
    item = llm_score.SCHEMA["properties"]["results"]["items"]
    assert set(item["required"]) == {"id", "kind", "reasons"}
    assert "trust" not in item["properties"]


def test_claim_maps_to_signals_with_verbatim_quote():
    r = to_signals(llm_score.to_result(raw(), POST))
    assert (r["state"], r["post_type"], r["scorer"]) == ("signals", "claim", "llm")
    assert r["signals"][0]["found"] == "100% эдгэрнэ"
    assert "llm_unvalidated" in r["notes"]


def test_quote_not_in_post_is_dropped():
    reasons = [{"signal": "emotion", "found": "айдас төрүүлэх үг", "text": "Айдас", "why": "…"}]
    r = llm_score.to_result(raw(reasons=reasons), POST)
    assert "found" not in r["evidence"][0]


def test_no_reasons_is_not_assessed():
    r = to_signals(llm_score.to_result(raw(reasons=[]), {**POST, "source_kind": "trusted"}))
    assert r["state"] == "not_assessed" and r["why_not"] == "no_signals_found"


def test_strong_factcheck_match_sets_the_blue_state():
    fc = {"strong": True, "claim": "…", "by": "MFCC", "url": "https://mfcc.mn/x", "date": "2026-01-01"}
    r = to_signals(llm_score.to_result(raw(reasons=[]), {**POST, "factcheck": fc}))
    assert r["state"] == "factcheck" and r["factcheck"]["publisher"] == "MFCC"


def test_ad_and_personal():
    ad = to_signals(llm_score.to_result(raw(kind="ad"), POST))
    assert (ad["post_type"], ad["state"]) == ("ad", "signals")
    p = to_signals(llm_score.to_result(raw(kind="personal"), POST))
    assert (p["state"], p["why_not"]) == ("not_assessed", "personal_post")


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
    assert llm_score.score_batch([POST]) == {}            # failure -> caller falls back to the rules


def test_disabled_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    assert llm_score.score_batch([POST]) == {}
