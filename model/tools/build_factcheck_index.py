"""
Баримт шалгалтын индекс бүтээх: MFCC, factcheck.mn-ийн НЯЦААГДСАН мэдэгдлүүдийг хайлтын индекс болгоно.
Facebook дээр худал мэдээлэл ихэвчлэн ДАХИН ДАХИН эргэлддэг тул «өмнө нь няцаагдсан уу?» гэдэг нь
хамгийн найдвартай (тайлбарлах боломжтой) дохио.

Ажиллуулах:  python model/tools/build_factcheck_index.py   (repo-ийн үндэс хавтаснаас)
Гаралт:      model/artifacts/factcheck_index.joblib
"""
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

REPO = Path(__file__).resolve().parents[2]
prefix = sys.argv[1] if len(sys.argv) > 1 else str(REPO / "data" / "datasets" / "HACKMIL_dataset_v31_")
full = pd.concat([pd.read_csv(f"{prefix}{s}.csv") for s in ("train", "val", "test")])
# Зөвхөн хүн бичсэн, баримт шалгагчийн няцаасан мэдэгдэл (Claude-ийн дахин бичсэнийг оруулахгүй)
idx = full[(full.label == 1) & full.platform.isin(["mfcc", "factcheckmn"])].drop_duplicates("text")
vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True).fit(idx.text)
out = Path(__file__).resolve().parent.parent / "artifacts" / "factcheck_index.joblib"
joblib.dump({"vec": vec, "X": vec.transform(idx.text),
             "text": idx.text.tolist(), "url": idx.source_url.fillna("").tolist(),
             "label": idx.label_name.fillna("false").tolist(), "date": idx.date.fillna("").astype(str).tolist(),
             "platform": idx.platform.tolist()}, out)
print(f"{len(idx)} мэдэгдэл → {out}")
