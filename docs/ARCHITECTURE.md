# Architecture

The product shows **signals to check, never a verdict** (rules: [`CLAUDE.md`](../CLAUDE.md) section 2). It makes the
first minutes of verification faster and teaches the habit behind them. No score, no true/false label, no green state.

```
                  ┌────────────────────┐   only after a user press   ┌──────────────────────────────────────┐
 Facebook feed ──▶│ extension/         │ ───────────────────────────▶│ extension/backend/ (FastAPI)         │
  (badge: local)  │ content.js (badge) │  POST /api/check            │  posts.py ─▶ model/hm_core.py, kb.py │
                  │ background.js      │  GET  /api/wayback|rdap     │  signals.py (drops every number)     │
                  │ sidepanel.*        │                             │  proxy.py ─▶ archive.org, rdap.org   │
                  └─────────▲──────────┘◀────────────────────────────│                                      │
                            │ build-time copy                         └──────────────────────────────────────┘
                  registry/ (tools.json, mongolia.json, lessons.json, measurement.json, buildLink.js)
                            │ build-time import (planned)
 Website hub (website/) ────┘
```

Badge states: **signals** (amber triangle), **factcheck** (blue page), **not_assessed** (grey ring). Colour is never
the only cue. Offline or in demo mode the extension answers from `extension/demo-cache.json`, labelled as cached.

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
| change which rules fire / add a feature | `model/hm_core.py` (retrain: `model/README.md`), mapping in `extension/backend/app/signals.py` |
| change page rules or keyword lists | `extension/backend/app/scorecard.py`, `features/text.py` |
| add or fix a tool in the sidebar / hub | `registry/tools.json`, then `node registry/sync.mjs` |
| add or fix a registered outlet | `data/reference/whitelist.json` (domains), `trusted_pages.json` (Facebook pages) |
| add training data | `data/datasets/` |
| change the badge / side panel | `extension/content.js`, `extension/sidepanel.js`, strings in `extension/i18n.js` |
| call the API from the website | `docs/API.md` |
| see what the API accepts and returns | `docs/API.md`, or http://localhost:8000/docs when the server runs |
| run the demo without Facebook | `http://127.0.0.1:8000/demo` |

## Contracts that must stay stable

- **Reason codes** (`clickbait`, `urgency`, `domain_lookalike`, …) are also the **MIL card ids** used by the extension
  and the website. Add new codes freely; rename only after telling the extension and website members.
- `POST /api/check` and proxy response shapes: [`API.md`](API.md). No score field, ever.
- Privacy: nothing identifying a person (names, comments, browsing history) or any uploaded image is stored.
  The extension sends page content only.
- Unknown signals contribute nothing. Never penalise missing data.
