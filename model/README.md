# model/ — trained model, training code, artifacts

**Owner: model & data member.** Everything the backend needs to score text lives here. Nothing in this folder
depends on the website or the extension.

```
model/
├── hm_core.py                    inference: clean(), signals(), trust_score(), reasons(), factcheck_match()
│                                 (ONE implementation, imported by the backend AND by tools/ so training
│                                  and serving cannot drift apart)
├── notebooks/
│   └── HACKMIL_scorecard_v31.ipynb   training notebook, writes ../artifacts/hackmil_scorecard.joblib
├── tools/
│   ├── retrain_with_feedback.py      retrain with extension feedback (data/feedback/feedback.csv)
│   └── build_factcheck_index.py      rebuild artifacts/factcheck_index.joblib from data/datasets
├── artifacts/                    files the backend loads (committed; see "Artifacts" below)
│   ├── hackmil_scorecard.joblib      LightGBM scorecard + TF-IDF text model + SHAP explainer
│   └── factcheck_index.joblib        1,982 refuted claims (MFCC = Mongolian Fact-Checking Center, factcheck.mn)
└── requirements.txt              pinned ML dependencies
```

Reference lists (outlets, trusted Facebook pages) and datasets are in [`data/`](../data/README.md), not here.

## Run things

All commands from the **repo root**:

```bash
pip install -r model/requirements.txt
jupyter notebook model/notebooks/HACKMIL_scorecard_v31.ipynb     # retrain from scratch
python model/tools/retrain_with_feedback.py                       # retrain with feedback
python model/tools/build_factcheck_index.py                       # rebuild fact-check index
```

## Artifacts — read before committing a new `.joblib`

- The backend loads `model/artifacts/*.joblib` (override the folder with `HM_ARTIFACTS_DIR`).
- A joblib is only valid with the **scikit-learn version it was pickled with**. `requirements.txt` pins that
  version (currently `1.8.0`). If you retrain on another version, change the pin **in the same commit** as the
  new artifacts, and tell the backend owner.
- `factcheck_index.joblib` was last built under a different scikit-learn version than the scorecard; it loads,
  but rebuild it (`build_factcheck_index.py`) in your pinned environment when convenient.
- Feature **codes** (`clickbait`, `urgency`, `scam`, ...) are used by the extension and website as MIL-card ids.
  Adding a feature is fine; renaming one needs a heads-up to the extension and website members.
- `trust_score()` must keep returning the dict the extension reads: `status`, `trust`, `zone`, `risks`,
  `trust_signals`, `card`, `guardrail`, `source`, `text_only_trust`, `factcheck`.
- The artifact also embeds its own outlet whitelist (`ikon.mn, gogo.mn, ... 24tsag.mn`). It is baked in at
  training time and is **not** the same list as `data/reference/whitelist.json`; reconcile when you retrain.

## How the score is made

## Оноо хэрхэн гардаг вэ
| Алхам | Юу хийдэг |
|---|---|
| Цэвэрлэгээ | Сургалтын өгөгдөлтэй ижил: линк/утас/он маскална, эхний 2 өгүүлбэр |
| Claim шүүлтүүр | 6-аас цөөн үг, эсвэл кирилл биш бол оноохгүй |
| Загвар | TF-IDF текст ангилагч + 14 шинж тэмдэг → LightGBM (monotonic) → калибровк |
| Домэйн | Цагаан жагсаалт +10, дуурайсан домэйн −30, HTTPS байхгүй −10 |
| **Guardrail** | Манипуляцийн дохио (clickbait, яаруулах, 100%, хуйвалдаан, луйвар, ТОМ ҮСЭГ, !!!) илрээгүй бол 🔴 болгохгүй → хамгийн ихдээ 🟡 |
| Шалтгаан | SHAP + илэрсэн дохио → дээд тал нь 3 |

Test дээр guardrail-тэй үр дүн: үнэн мэдээ 🔴 болох **0%**, худал мэдээ 🟢 болох **2%**.
(Facebook-ийн жинхэнэ пост дээр хараахан хэмжээгүй — бодит тоо биш.)

## Эх сурвалж (пост оруулсан пэйж) — `data/reference/trusted_pages.json`
| Төрөл | Юу хийдэг |
|---|---|
| ✔ Бүртгэлтэй пэйж (жагсаалтад байгаа) | Хүчтэй манипуляцийн дохио (луйвар, яаруулах, 100%, хуйвалдаан) байхгүй бол хамгийн багадаа 75 🟢; байвал +20 |
| − Дуурайсан нэр (жагсаалтынхаас 1–2 үсгээр зөрүүтэй) | −25, guardrail ажиллахгүй |
| Цэнхэр тэмдэгтэй (verified) | +10 (verified нь үнэний баталгаа биш тул бага жинтэй) |

Одоогийн жагсаалт (Facebook хаягийг тухайн байгууллагын **өөрийн сайтын** линкээс баталгаажуулсан):
Montsame (`montsame.agency`), MNB (`mnbtv`), iKon.mn (`iKonNews`), GoGo.mn (`gogo.mn`), News.mn (`news.mn.agency`),
Өнөөдөр (`www.unuudur.mn`), iSee.mn (`www.iSee.mn`), MFCC (`mfcc.mn`), Medee.mn (`www.MedeeMN` — Facebook хайлтаар),
Eagle News (хаяг баталгаажаагүй — slug хоосон).
**Slug нэрнээс давуу:** нэрийг яг хуулсан ч slug нь өөр бол «дуурайсан пэйж» гэж үзнэ.

Пэйж нэмэх: Facebook дээр F12 → Console-ийн шүүлтүүрийг **Verbose** болгоход
`[Итгэлцлийн оноо] зохиогч: Medee.mn https://www.facebook.com/...` гэж гарна.
Тэр нэр эсвэл slug-ийг `data/reference/trusted_pages.json`-д нэмнэ (сервер restart хийх шаардлагагүй):
```json
{"name": "Medee.mn", "slug": "medee.mn", "note": ""}
```

## Баримт шалгалттай тулгах (`model/artifacts/factcheck_index.joblib`)
MFCC, factcheck.mn-ийн няцаасан 1,982 мэдэгдэлтэй постыг харьцуулна (тэмдэгтийн TF-IDF cosine).
Facebook дээр худал мэдээлэл дахин дахин эргэлддэг тул энэ нь хамгийн найдвартай дохио.
| Ижил төстэй байдал | Юу хийдэг |
|---|---|
| ≥ 0.45 | Оноог 15 хүртэл бууруулна + шалгалтын линк. Үнэн мэдээний **0.1%**-ийг л буруу таардаг; өөр үгээр бичсэн худлын **~66%**-ийг олдог |
| 0.38–0.45 | Оноонд нөлөөлөхгүй, зөвхөн «төстэй мэдэгдэл шалгагдсан» гэж харуулна |
Пост нь худлыг ишлээд няцааж байвал («... гэдэг худал») эсвэл бүртгэлтэй пэйжийнх бол шийтгэхгүй.
Индексийг шинэчлэх: `python model/tools/build_factcheck_index.py        # repo-ийн үндэсээс`

## Санал хүсэлт → дахин сургах
Тэмдэг дээр дарахад «✅ Үнэн / ❌ Худал / 💬 Мэдэгдэл биш» товч гарна → `data/feedback/feedback.csv` (git-д орохгүй)-д хадгалагдана.
Багаараа Facebook гүйлгэж 150–200 пост шошголсны дараа:
```bash
python model/tools/retrain_with_feedback.py      # өгөгдөл: data/datasets/ (repo-ийн үндэсээс ажиллуулна)
```
Facebook өгөгдлийн 30%-ийг test болгож, хуучин ба шинэ загварыг харьцуулж хэвлэнэ. Шинэ загвар `model/artifacts/hackmil_scorecard.joblib`-д
хадгалагдана (хуучин нь `.bak`, git-д орохгүй). Серверээ дахин асаахад л хангалттай.
