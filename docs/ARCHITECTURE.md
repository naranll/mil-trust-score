# Architecture

Итгэлцлийн оноо gives a news page or a Facebook post an explainable 0–100 score with the top 3 reasons, then
teaches the user to check the information. It scores **method** (source, style, context), never politics, and
never decides what is true.

```
                  ┌────────────────────┐        ┌────────────────────────────────────┐
 Facebook feed ──▶│ extension/         │  HTTP  │ backend/  (FastAPI)                │
                  │ content.js         │───────▶│  POST /score/posts ──▶ model/hm_core.py ──▶ model/artifacts/*.joblib
                  │ background.js      │◀───────│  POST /score       ──▶ app/scorecard.py ──▶ data/reference/*.json
                  └────────────────────┘        │  POST /feedback*   ──▶ data/feedback/ (local, git-ignored)
                                                └────────────▲───────────────────────┘
 Website  (website/)  ─────── same API, plus its own pages/games ┘
 Mobile screenshot scanner (planned, website /scan) ── POST /score/image (planned)
```

Zones: green ≥ 70, yellow 40–69, red < 40. A zone is never shown by color alone: always with a text label and an
icon (✓ / ! / ✕ · «Найдвартай / Болгоомжил / Эрсдэлтэй»), in every client and chart.

## Who owns what

| Folder | Owner | Contains | Others should |
|---|---|---|---|
| `model/` | model & data member | `hm_core.py`, notebook, tools, trained artifacts | not edit; ask for new features/fields |
| `data/` | model & data member | datasets, reference lists, local feedback | send additions to outlet lists via PR |
| `backend/` | API / mobile-scanner member | FastAPI app, tests | not edit routes without telling them |
| `extension/` | extension member | Chrome MV3 extension, demo feed | call only documented endpoints |
| `website/` | website member | frontend, its own server code if any, games, MIL cards | call the scoring API; do not copy model code |
| `docs/` | everyone | architecture, API contract, workflow | keep up to date when you change a contract |

## Where do I find …?

| I want to … | Go to |
|---|---|
| change how a post is scored / add a feature | `model/hm_core.py`, then retrain (`model/README.md`) |
| change page-scorecard weights or keyword lists | `backend/app/scorecard.py`, `backend/app/features/text.py` |
| add or fix a registered outlet | `data/reference/whitelist.json` (domains), `trusted_pages.json` (Facebook pages) |
| add training data | `data/datasets/` |
| change the badge / detail card in Facebook | `extension/content.js`, `extension/styles.css` |
| call the API from the website | `docs/API.md`; use `GET /score/mock?zone=` while developing |
| see what the API accepts and returns | `docs/API.md`, or http://localhost:8000/docs when the server runs |
| run the demo without Facebook | `http://127.0.0.1:8000/demo` |

## Contracts that must stay stable

- **Reason codes** (`clickbait`, `urgency`, `domain_lookalike`, …) are also the **MIL card ids** used by the extension
  and the website. Add new codes freely; rename only after telling the extension and website members.
- `POST /score` and `POST /score/posts` response shapes: [`API.md`](API.md).
- Privacy: nothing identifying a person (names, comments, browsing history) or any uploaded image is stored.
  The extension sends page content only.
- Unknown signals contribute nothing. Never penalise missing data.
