"""Build extension/demo-cache.json: precomputed results for the demo feed pages, so the live demo works with no
server and no internet. The extension shows every cached result with a visible "cached demo result" label.

    python extension/backend/tools/build_demo_cache.py      (from the repo root, model deps installed)

checks:   /api/check results (rules + trained model, Claude reader off) for every post on demo.html and fb_like.html,
          keyed like background.js textKey(): text | image_text, whitespace collapsed, lower case, 300 chars.
wayback, rdap:  real proxy answers for the links on the demo pages, recorded now (skipped if offline).
Nothing is ever made up.
"""
import html
import json
import os
import re
import sys
import warnings
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

warnings.filterwarnings("ignore")
os.environ["HM_LLM"] = "0"
os.environ.setdefault("WHOIS_ENABLED", "0")

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO))
from fastapi.testclient import TestClient  # noqa: E402

from extension.backend.app.main import app  # noqa: E402
from extension.backend.app.posts import Item, check_items  # noqa: E402

EXT = REPO / "extension"
OUT = EXT / "demo-cache.json"

# A real archive.org answer recorded on 2026-10-26 (manual call). archive.org answered this script's calls
# with 429 that day, so this stands in until a live call succeeds. "first" is unknown, so it stays null.
RECORDED_WAYBACK = {
    "https://ikon.mn/": {"ok": True, "url": "https://ikon.mn/", "archived": True, "first": None,
                         "latest": {"timestamp": "20261026053447", "date": "2026-10-26",
                                    "url": "http://web.archive.org/web/20261026053447/https://ikon.mn/"},
                         "history_url": "https://web.archive.org/web/*/https://ikon.mn/", "recorded": "2026-10-26"},
}
EXTRA_URLS = ["https://ikon.mn/"]   # for the "paste a link" part of the demo


def text_key(text, image_text=None):
    return " ".join(" | ".join(x for x in (text, image_text) if x).split()).lower()[:300]


MIN_CHARS = 25   # content.js ignores captions shorter than this, so the cache must too


def visible(text):
    # JavaScript's .length counts UTF-16 code units (an emoji is 2), so count the same way
    return text if text and len(text.strip().encode("utf-16-le")) // 2 >= MIN_CHARS else ""


def demo_posts():
    """Posts from demo.html (a JS array) and fb_like.html (Facebook-like markup)."""
    out = []
    src = (EXT / "demo" / "demo.html").read_text(encoding="utf-8")
    slugs = dict(re.findall(r'"([^"]+)":\s*"([^"]+)"', re.search(r"const SLUG = \{([^}]*)\}", src).group(1)))
    for m in re.finditer(r'^\s*\["([^"]+)",\s*"([^"]+)",\s*(null|"[^"]*")(?:,\s*(null|"[^"]*"))?', src, re.M):
        who, text, link, img = m.group(1), m.group(2), m.group(3), m.group(4)
        slug = slugs.get(who) or who.replace(" ", ".").lower()
        out.append({"author": who, "author_url": f"https://www.facebook.com/{slug}", "text": visible(text),
                    "url": None if link == "null" else link.strip('"'),
                    "image_text": None if img in (None, "null") else img.strip('"')})
    fb = (EXT / "demo" / "fb_like.html").read_text(encoding="utf-8")
    for chunk in re.split(r'<div aria-posinset=', fb)[1:]:
        t = re.search(r'data-ad-preview="message"><div dir="auto">([^<]+)</div>', chunk)
        if not t:
            continue
        name = re.search(r'profile_name"><h4><a role="link" href="([^"]+)"><b><span>([^<]+)</span>', chunk)
        link = re.search(r'l\.php\?u=([^"]+)"', chunk)
        title = re.search(r'data-ad-rendering-role="title"><span dir="auto">([^<]+)<', chunk)
        out.append({"author": name and html.unescape(name.group(2)), "author_url": name and name.group(1),
                    "text": visible(html.unescape(t.group(1))),
                    "url": link and parse_qs(urlparse("x?u=" + link.group(1)).query)["u"][0],
                    "sponsored": ">Sponsored<" in chunk, "has_cta": "cta-button" in chunk,
                    "link_title": title and html.unescape(title.group(1))})
    return out


def main():
    posts = demo_posts()
    posts = [p for p in posts if p["text"] or p.get("image_text")]
    items = [Item(id=f"d{i}", **{k: v for k, v in p.items() if v is not None}) for i, p in enumerate(posts)]
    results = {r["id"]: r for r in check_items(items)}
    checks = {}
    for i, p in enumerate(posts):
        r = dict(results[f"d{i}"])
        r.pop("id", None)
        checks[text_key(p["text"], p.get("image_text"))] = r

    client = TestClient(app)
    urls = sorted({p["url"] for p in posts if p.get("url")} | set(EXTRA_URLS))
    domains = sorted({urlparse(u).hostname.removeprefix("www.") for u in urls})
    wayback, rdap = {}, {}
    for u in urls:
        body = client.get("/api/wayback", params={"url": u}).json()
        if body.get("ok"):
            wayback[u.lower()] = body
        elif u in RECORDED_WAYBACK:
            wayback[u.lower()] = RECORDED_WAYBACK[u]
    for d in domains:
        body = client.get("/api/rdap", params={"domain": d}).json()
        if body.get("ok") or body.get("reason") == "no_rdap_for_tld":
            rdap[d] = body

    out = {"_about": f"Generated {date.today().isoformat()} by extension/backend/tools/build_demo_cache.py. "
                     "Rules + trained model only. Shown in the extension as 'cached demo result'.",
           "checks": checks, "wayback": wayback, "rdap": rdap}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    states = {}
    for r in checks.values():
        states[r["state"]] = states.get(r["state"], 0) + 1
    print(f"{len(checks)} posts {states}; wayback {len(wayback)}/{len(urls)}; rdap {len(rdap)}/{len(domains)}; "
          f"-> {OUT}")


if __name__ == "__main__":
    main()
