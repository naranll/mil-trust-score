"""Proxy endpoints with the network replaced by canned responses."""
import httpx
import pytest
from fastapi.testclient import TestClient

from extension.backend.app import guard, proxy
from extension.backend.app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset():
    proxy.reset()
    guard.reset()


def fake(responses):
    """responses: list of (status, json) returned in order; records the calls."""
    calls = []

    def _get(url, params=None):
        calls.append((url, params))
        status, body = responses[min(len(calls) - 1, len(responses) - 1)]
        return httpx.Response(status, json=body, request=httpx.Request("GET", url))

    return _get, calls


SNAP_NEW = {"archived_snapshots": {"closest": {"available": True, "timestamp": "20261026053447",
                                               "url": "http://web.archive.org/web/20261026053447/https://ikon.mn/"}}}
SNAP_OLD = {"archived_snapshots": {"closest": {"available": True, "timestamp": "20090301000000",
                                               "url": "http://web.archive.org/web/20090301000000/https://ikon.mn/"}}}


@pytest.mark.parametrize("u", ["javascript:alert(1)", "file:///etc/passwd", "http://127.0.0.1/x", "http://10.0.0.5/",
                               "http://localhost:8000/", "http://[::1]/", "http://169.254.169.254/latest", "ftp://x.mn"])
def test_private_and_non_http_urls_are_refused(u):
    assert guard.valid_public_url(u) is None


def test_public_urls_pass():
    assert guard.valid_public_url("https://ikon.mn/n/3abc") == "https://ikon.mn/n/3abc"
    assert guard.valid_domain("https://www.ikon.mn/n/1") == "ikon.mn"
    assert guard.valid_domain("127.0.0.1") is None


def test_wayback_first_and_latest_then_cache(monkeypatch):
    get, calls = fake([(200, SNAP_NEW), (200, SNAP_OLD)])
    monkeypatch.setattr(proxy, "_get", get)
    r = client.get("/api/wayback", params={"url": "https://ikon.mn/"})
    body = r.json()
    assert r.headers["x-cache"] == "MISS" and body["ok"] and body["archived"]
    assert body["latest"]["date"] == "2026-10-26" and body["first"]["date"] == "2009-03-01"
    assert calls[1][1]["timestamp"] == "19960101"
    r2 = client.get("/api/wayback", params={"url": "https://ikon.mn/"})
    assert r2.headers["x-cache"] == "HIT" and len(calls) == 2


def test_wayback_429_backs_off_and_falls_back_to_a_link(monkeypatch):
    get, calls = fake([(429, {})])
    monkeypatch.setattr(proxy, "_get", get)
    body = client.get("/api/wayback", params={"url": "https://ikon.mn/"}).json()
    assert body == {"ok": False, "reason": "rate_limited", "fallback_url": "https://web.archive.org/web/*/https://ikon.mn/"}
    client.get("/api/wayback", params={"url": "https://ikon.mn/other"})
    assert len(calls) == 1          # in back-off: no second upstream call


def test_wayback_refuses_private_url(monkeypatch):
    get, calls = fake([(200, SNAP_NEW)])
    monkeypatch.setattr(proxy, "_get", get)
    assert client.get("/api/wayback", params={"url": "http://192.168.1.1/"}).json()["reason"] == "invalid_url"
    assert calls == []


def test_rdap_maps_registrar_and_dates(monkeypatch):
    api = {"events": [{"eventAction": "registration", "eventDate": "1997-09-15T04:00:00Z"},
                      {"eventAction": "expiration", "eventDate": "2028-09-14T04:00:00Z"}],
           "entities": [{"roles": ["registrar"], "vcardArray": ["vcard", [["version", {}, "text", "4.0"],
                                                                         ["fn", {}, "text", "MarkMonitor Inc."]]]}],
           "status": ["client delete prohibited"]}
    get, _ = fake([(200, api)])
    monkeypatch.setattr(proxy, "_get", get)
    body = client.get("/api/rdap", params={"domain": "google.com"}).json()
    assert (body["registrar"], body["registered"], body["expires"]) == ("MarkMonitor Inc.", "1997-09-15", "2028-09-14")


def test_rdap_missing_tld_falls_back_to_whois(monkeypatch):
    get, _ = fake([(404, {})])
    monkeypatch.setattr(proxy, "_get", get)
    body = client.get("/api/rdap", params={"domain": "ikon.mn"}).json()
    assert body["reason"] == "no_rdap_for_tld" and body["fallback_url"] == "https://www.whois.com/whois/ikon.mn"


def test_upstream_timeout_is_not_an_error_wall(monkeypatch):
    def boom(url, params=None):
        raise httpx.ConnectTimeout("slow", request=httpx.Request("GET", url))
    monkeypatch.setattr(proxy, "_get", boom)
    r = client.get("/api/rdap", params={"domain": "example.org"})
    assert r.status_code == 200 and r.json()["reason"] == "upstream_error"


def test_registry_is_data_only():
    body = client.get("/api/registry").json()
    assert isinstance(body["tools"], list) and body["tools"]
