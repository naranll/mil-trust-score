"""
Facebook-ийн санал хүсэлтээр (feedback.csv) загварыг дахин сургах.

Санаа: extension дээр «✅ Үнэн / ❌ Худал» гэж дарсан пост бүр шошготой Facebook өгөгдөл болно.
Загвар одоо зөвхөн мэдээний сайтын текстээр сурсан тул Facebook-ийн бичих хэлбэрийг мэддэггүй —
энэ өгөгдөл яг тэр цоорхойг нөхнө.

Ажиллуулах (repo-ийн үндэс хавтаснаас):
    python model/tools/retrain_with_feedback.py
Гаралт:
    model/artifacts/hackmil_scorecard.joblib (хуучин нь hackmil_scorecard.bak.joblib болж хадгалагдана, git-д орохгүй)
    Facebook-ийн test дээр ӨМНӨ / ДАРАА үр дүн
"""
import argparse
import shutil
import sys
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline

MODEL = Path(__file__).resolve().parent.parent          # model/
REPO = MODEL.parent
ARTIFACTS = MODEL / "artifacts"
sys.path.insert(0, str(MODEL))
import hm_core  # noqa: E402  — clean(), signals(), хуучин загвар

ap = argparse.ArgumentParser()
ap.add_argument("--data", default=str(REPO / "data" / "datasets" / "HACKMIL_dataset_v31_"),
                help="train/val/test csv-ийн угтвар (анхдагч: data/datasets/ доторх)")
ap.add_argument("--feedback", default=str(REPO / "data" / "feedback" / "feedback.csv"))
ap.add_argument("--fb-test", type=float, default=0.3, help="Facebook өгөгдлийн хэдэн хувийг test болгох")
ap.add_argument("--repeat", type=int, default=3, help="Facebook мөр бүрийг train-д хэдэн удаа давтах (жин)")
args = ap.parse_args()

# ---------------------------------------------------------------------------
# 1. Өгөгдөл
# ---------------------------------------------------------------------------
for s in ("train", "val", "test"):
    if not Path(f"{args.data}{s}.csv").exists():
        sys.exit(f"⚠️  {args.data}{s}.csv олдсонгүй — --data-д файлын бүтэн замыг (угтвартай нь) өгнө үү")
if not Path(args.feedback).exists():
    sys.exit("⚠️  feedback.csv алга — эхлээд extension дээр постуудыг ✅/❌ гэж шошголно уу")
train, val, test = (pd.read_csv(f"{args.data}{s}.csv") for s in ("train", "val", "test"))
# dtype=str: эс бөгөөд pandas "true"/"false"-г bool болгочихно
fb = pd.read_csv(args.feedback, encoding="utf-8-sig", dtype=str)
fb["user_label"] = fb.user_label.str.lower()
fb = fb[fb.user_label.isin(["true", "false"])].copy()          # «мэдэгдэл биш»-ийг хасна
fb["raw"] = fb.text.fillna("").where(fb.text.fillna("").str.len() > 0, fb.image_text.fillna(""))
fb["text"] = fb.raw.map(hm_core.clean)
fb["label"] = (fb.user_label == "false").astype(int)
fb = fb[fb.text.str.split().str.len() >= 6].drop_duplicates("text", keep="last").reset_index(drop=True)
print(f"Facebook санал: {len(fb)} мөр (үнэн {(fb.label == 0).sum()}, худал {(fb.label == 1).sum()})")
if len(fb) < 10 or fb.label.nunique() < 2:
    sys.exit("⚠️  Хангалттай өгөгдөл алга: дор хаяж 10 мөр, үнэн ба худал хоёулаа байх ёстой")

if len(fb) >= 20:
    fb_tr, fb_te = train_test_split(fb, test_size=args.fb_test, stratify=fb.label, random_state=42)
else:
    fb_tr, fb_te = fb, fb.iloc[0:0]
    print("ℹ️  20-иос цөөн мөр тул бүгдийг train-д оруулав (Facebook test байхгүй)")

# Facebook мөрийг давтаж жин өгнө; давхардлууд нэг pair_id-тэй тул GroupKFold-д тусдаа fold-д хуваагдахгүй
fb_rep = pd.concat([fb_tr.assign(pair_id=[f"fb_{i}" for i in range(len(fb_tr))])] * args.repeat, ignore_index=True)
tr = pd.concat([train[["text", "label", "pair_id"]], fb_rep[["text", "label", "pair_id"]]], ignore_index=True)
print(f"Сургалт: {len(train)} хуучин + {len(fb_rep)} Facebook (×{args.repeat})")

# ---------------------------------------------------------------------------
# 2. Сургах (notebook-ийн 2–4, 8-р алхамтай ижил)
# ---------------------------------------------------------------------------
COLS, SIGNALS, EXTRA = hm_core.COLS, hm_core.SIGNALS, hm_core.EXTRA
MONO = hm_core.MONO


def text_model():
    return Pipeline([("tf", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True,
                                            max_features=200000)),
                     ("lr", LogisticRegression(max_iter=3000, class_weight="balanced", C=2.0))])


def lgbm():
    return lgb.LGBMClassifier(objective="binary", learning_rate=0.05, num_leaves=15, min_child_samples=20,
                              n_estimators=400, subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                              monotone_constraints=[MONO[c] for c in COLS], is_unbalance=True, verbose=-1,
                              random_state=42)


S_tr = hm_core.signals(tr.text)
S_tr["text_model"] = cross_val_predict(text_model(), tr.text, tr.label, cv=GroupKFold(5), groups=tr.pair_id,
                                       method="predict_proba")[:, 1]
tm = text_model().fit(tr.text, tr.label)
model = CalibratedClassifierCV(lgbm(), method="isotonic", cv=5).fit(S_tr[COLS], tr.label)
explainer = lgbm().fit(S_tr[COLS], tr.label)


# ---------------------------------------------------------------------------
# 3. Үнэлгээ: ӨМНӨ (хуучин загвар) vs ДАРАА
# ---------------------------------------------------------------------------
def trust_of(texts, m, t):
    S = hm_core.signals(texts)
    S["text_model"] = t.predict_proba(list(texts))[:, 1]
    return 100 * (1 - m.predict_proba(S[COLS])[:, 1])


def report(name, df, m, t):
    if len(df) == 0:
        return
    tr_ = trust_of(df.text, m, t)
    y = df.label.values
    acc = ((tr_ < 50) == (y == 1)).mean()
    red_true = ((tr_ < 40) & (y == 0)).sum() / max((y == 0).sum(), 1)
    green_false = ((tr_ >= 70) & (y == 1)).sum() / max((y == 1).sum(), 1)
    print(f"  {name:22s} n={len(df):4d}  нарийвчлал {acc:6.1%}   үнэн→🔴 {red_true:6.1%}   худал→🟢 {green_false:6.1%}")


print("\nӨМНӨ (хуучин загвар):")
report("Энгийн test", test, hm_core.MODEL, hm_core.TM)
report("Facebook test", fb_te, hm_core.MODEL, hm_core.TM)
print("ДАРАА (шинэ загвар):")
report("Энгийн test", test, model, tm)
report("Facebook test", fb_te, model, tm)

# ---------------------------------------------------------------------------
# 4. Хадгалах
# ---------------------------------------------------------------------------
out = ARTIFACTS / "hackmil_scorecard.joblib"
shutil.copy(out, ARTIFACTS / "hackmil_scorecard.bak.joblib")
joblib.dump({"model": model, "explainer": explainer, "text_model": tm, "cols": COLS,
             "signals": SIGNALS, "extra": EXTRA, "whitelist": hm_core.WHITELIST}, out)
print(f"\n💾 {out.name} шинэчлэгдлээ (хуучин нь hackmil_scorecard.bak.joblib). Серверээ дахин асаана уу.")
