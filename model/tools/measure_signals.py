"""Measure how often the checker raises a badge on items labelled true (false positives), on the held-out split.

Runs the same code path as POST /api/check (rules + trained model, Claude reader OFF) and writes
registry/measurement.json, which the extension quotes in "Why am I seeing this?".

    python model/tools/measure_signals.py            (from the repo root, Python 3.12 env with model deps)
    node registry/sync.mjs                            (copies the result into the extension)

Honesty notes written into the output:
- every "true" item in the test split is news-article text, not a Facebook post;
- the fact-check index was built from train+val+test, so fact-check matches on FALSE items are not a fair test
  and no recall number is reported from them;
- labels come from the dataset builders (fact-checker articles / news outlets), not from model output.
"""
import csv
import json
import math
import os
import sys
import warnings
from collections import Counter
from datetime import date
from pathlib import Path

warnings.filterwarnings("ignore")
os.environ.setdefault("HM_LLM", "0")
os.environ.setdefault("WHOIS_ENABLED", "0")

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
from extension.backend.app.posts import Item, check_items  # noqa: E402

TEST = REPO / "data" / "datasets" / "HACKMIL_dataset_v31_test.csv"
OUT = REPO / "registry" / "measurement.json"


def wilson(k: int, n: int, z: float = 1.96):
    if n == 0:
        return [0.0, 0.0]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 3), round(min(1.0, c + h), 3)]


def main():
    rows = list(csv.DictReader(TEST.open(encoding="utf-8")))
    human = [r for r in rows if (r.get("is_llm") or "none") == "none"]
    items = [Item(id=r["id"], text=r["text"]) for r in human]
    results = {}
    for i in range(0, len(items), 20):
        for r in check_items(items[i:i + 20]):
            results[r["id"]] = r

    def tally(label_names):
        sub = [r for r in human if r["label_name"] in label_names]
        states = Counter(results[r["id"]]["state"] for r in sub)
        checked = sum(1 for r in sub if results[r["id"]]["checked"])
        return sub, states, checked

    true_rows, t_states, t_checked = tally({"true"})
    false_rows, f_states, f_checked = tally({"false", "misleading"})
    t_flag = t_states["signals"] + t_states["factcheck"]
    # Rule signals on false items, ignoring the (leaky) fact-check index
    f_rule = sum(1 for r in false_rows if any(not s["model_guess"] for s in results[r["id"]]["signals"]))
    sources = Counter(r["source_type"] for r in true_rows)

    out = {
        "measured_on": date.today().isoformat(),
        "dataset": "data/datasets/HACKMIL_dataset_v31_test.csv (held-out split, human-written items only)",
        "scorer": "rules + trained model (the Claude reader was not measured)",
        "true_items": {
            "n": len(true_rows), "assessed": t_checked,
            "badged": t_flag, "badged_signals": t_states["signals"], "badged_factcheck": t_states["factcheck"],
            "false_positive_rate": round(t_flag / max(t_checked, 1), 3),
            "ci95": wilson(t_flag, t_checked),
            "source_types": dict(sources),
        },
        "false_items": {
            "n": len(false_rows), "assessed": f_checked,
            "with_rule_signals": f_rule,
            "note": "Fact-check matches on these items are not reported: the fact-check index contains them.",
        },
        "caveats": [
            "All true items are news-article text. The false-positive rate on Facebook posts has not been measured.",
            "Small sample: read the 95% interval, not the point value.",
            "The fact-check index includes the test items, so it is not evaluated here.",
            "Labels come from fact-checker articles and news outlets chosen by the dataset builders, not from model output.",
        ],
        "summary": {
            "en": (f"On {t_checked} held-out news articles labelled true, our rules raised a badge on {t_flag} "
                   f"({100 * t_flag / max(t_checked, 1):.0f}%, 95% interval {100 * wilson(t_flag, t_checked)[0]:.0f}-"
                   f"{100 * wilson(t_flag, t_checked)[1]:.0f}%). Not yet measured on Facebook posts."),
            "mn": (f"Үнэн гэж шошголсон {t_checked} мэдээний нийтлэлээс (сургалтад ороогүй) манай дүрэм {t_flag}-д нь "
                   f"тэмдэг тавьсан ({100 * t_flag / max(t_checked, 1):.0f}%, 95% интервал "
                   f"{100 * wilson(t_flag, t_checked)[0]:.0f}-{100 * wilson(t_flag, t_checked)[1]:.0f}%). "
                   f"Facebook пост дээр хараахан хэмжээгүй."),
        },
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
