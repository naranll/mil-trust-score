# Итгэлцлийн оноо — Backend (FastAPI)

## Ажиллуулах

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest -q
```

Docs: http://localhost:8000/docs

## Endpoint

| Method | Path | Зориулалт |
|---|---|---|
| POST | `/score` | Хуудасны агуулгыг авч оноо, бүс, 3 шалтгаан буцаана |
| GET | `/score/mock?zone=red\|yellow\|green` | Extension-д зориулсан хатуу кодолсон хариу |
| POST | `/feedback` | «Энэ оноо буруу байна» товчны хариу (`app/data/feedback.jsonl`) |
| GET | `/health` | Шалгалт |

`POST /score` body: `url, title, text, links[], images[], author?, published_date?`
Хариу: `{score, zone, reasons[{code,label,points}], disclaimer}`

## Хэн юуг солих вэ

- **Загварын гишүүн:** `app/scorecard.py` дахь `WEIGHTS`-ийг сургасан жингээр солино. `code`-ууд тогтмол үлдэнэ (MIL картын id мөн эдгээр).
- **Өгөгдлийн гишүүд:** `app/data/whitelist.json` (бүртгэлтэй сайтууд, ЭХЛЭЛТИЙН ЖАГСААЛТ, баталгаажуулах) болон `app/features/text.py` дахь түлхүүр үгсийн жагсаалт.
- **Extension:** Эхлээд `/score/mock`-тэй холбож, дараа нь `/score` руу шилжинэ.

## Тэмдэглэл

- Тодорхойгүй шинж тэмдэг (`None`) оноонд нөлөөлөхгүй (жишээ нь WHOIS хандах боломжгүй үед).
- WHOIS-ийг унтраах: `WHOIS_ENABLED=0`.
- Хувийн мэдээлэл хадгалахгүй: зөвхөн хуудасны агуулга, санал хүсэлт.
- Хийгдээгүй: reverse image search, NLI, 1212.mn тулгалт, LLM нотолгоо (MVP-ээс хассан).
