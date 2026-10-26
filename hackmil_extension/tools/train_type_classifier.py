"""
Постын төрлийн ML ангилагч (claim / commerce / personal) сургах.

Өгөгдөл (Q23):
  • claim    — HACKMIL v31 (мэдээ, баримт шалгагчийн мэдэгдэл), дүрмээр «мэдэгдэл» гэж ангилагдсан мөрүүд
  • commerce — v31-ийн доторх зар/луйврын мөрүүд (дүрмээр) + data/type_seed_commerce.txt
  • personal — data/type_seed_personal.txt + feedback.csv-ийн «Мэдэгдэл биш» гэж шошгосон постууд
⚠️ seed файлуудыг Claude бичсэн (синтетик). Facebook-ийн бодит «Мэдэгдэл биш» санал цугларах тусам
   дахин сургаад, синтетик өгөгдлийн жинг багасгана.

Ажиллуулах:  python tools/train_type_classifier.py
Гаралт:      backend/type_model.joblib
"""
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline, make_union

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import post_types  # noqa: E402

d = pd.concat([pd.read_csv(ROOT / "data" / f"HACKMIL_dataset_v31_{s}.csv") for s in ("train", "val", "test")],
              ignore_index=True)
d = d[d.platform != "claude"]
rule = [post_types.rule_classify(t)[0] for t in d.text]
d = d.assign(rule=rule)

claim = d[d.rule == "claim"].sample(n=min(700, (d.rule == "claim").sum()), random_state=0)
rows = [(t, "claim", "v31") for t in claim.text]
rows += [(t, "commerce", "v31") for t in d[d.rule == "commerce"].text]
rows += [(t.strip(), "commerce", "seed") for t in open(ROOT / "data" / "type_seed_commerce.txt", encoding="utf-8") if t.strip()]
rows += [(t.strip(), "personal", "seed") for t in open(ROOT / "data" / "type_seed_personal.txt", encoding="utf-8") if t.strip()]
fb = ROOT / "backend" / "feedback.csv"
if fb.exists():
    f = pd.read_csv(fb, encoding="utf-8-sig", dtype=str)
    rows += [(t, "personal", "feedback") for t in f[f.user_label == "not_claim"].text.dropna()]
data = pd.DataFrame(rows, columns=["text", "type", "src"]).drop_duplicates("text")
print(data.groupby(["type", "src"]).size(), "\n")


def model():
    return make_pipeline(
        make_union(TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True),
                   TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
        LogisticRegression(max_iter=3000, class_weight="balanced", C=3.0))


pred = cross_val_predict(model(), data.text, data.type, cv=StratifiedKFold(5, shuffle=True, random_state=0))
print("5-fold CV (⚠️ seed өгөгдөл синтетик тул бодит Facebook дээр бага гарна):")
print(classification_report(data.type, pred, digits=3))

m = model().fit(data.text, data.type)
# Чухал шалгалт: бодит мэдээ / худал мэдэгдэл «хувийн пост» гэж ангилагдаж алга болох уу?
rest = d[~d.text.isin(data.text)]
P = m.predict_proba(rest.text)
pi = list(m.classes_).index("personal")
for lab, name in [(0, "үнэн мэдээ"), (1, "худал мэдэгдэл")]:
    msk = (rest.label == lab).values
    print(f"{name:15s}: «хувийн пост» (p≥0.75) гэж алгасагдах {np.mean(P[msk, pi] >= .75):.1%}  (n={msk.sum()})")
joblib.dump(m, ROOT / "backend" / "type_model.joblib")
print("\n💾 backend/type_model.joblib")
