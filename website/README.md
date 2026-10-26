# website/ — educational site (frontend, server code if needed, games)

**Owner: website member.** This folder is yours to structure. Suggested layout (adapt to your framework):

```
website/
├── frontend/     pages: Data Viz, Education + Law, Mini Game, About us, Blog, Extension introduction, /scan
├── server/       only if the site needs its own server code (blog, content API). Scoring stays in ../backend
├── games/        interactive MIL games (can be part of frontend/ if the framework prefers)
└── content/      MIL cards, blog posts, quiz data as JSON/Markdown so non-developers can edit them
```

Once you pick a framework, put the install / dev-server / build commands at the top of this file. `node_modules/`
and build output (`dist/`, `.next/`) are already in `.gitignore`.

## Using the scoring API

- Base URL: configure it (e.g. `VITE_API_URL` / `NEXT_PUBLIC_API_URL`), default `http://127.0.0.1:8000`.
- Contract and examples: [`docs/API.md`](../docs/API.md). While the model is not running, use
  `GET /score/mock?zone=red|yellow|green`.
- Reason `code`s are MIL card ids: key your MIL-card content by them (`content/cards/<code>.json`).
- Do not copy scoring logic into the website; call the API.

## Rules that apply to every page

- **Color-blind safe:** never show a zone by color alone. Always pair color with a text label and an icon
  (✓ Найдвартай · ! Болгоомжил · ✕ Эрсдэлтэй). Check charts with a color-blind simulator.
- User-facing text is Mongolian (Cyrillic). Code and comments are English.
- Show the disclaimer: the score is not fully reliable and does not say what is true.
- Law content: only laws and articles the team has verified; present as general information, not legal advice.
- Do not store usernames, comments, browsing history or uploaded images.
