# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router, `cacheComponents`), TypeScript, Tailwind v4, React Three Fiber for 3D, Supabase (Postgres) for data-viz data with a local JSON fallback. Deploy on Vercel. Chosen by the team (Mike) in the HACKMIL 2026 planning session.

## Users

- Hackathon judges at HACKMIL 2026 (media & information literacy hackathon, 26–27 Oct 2026) watching a 3-minute demo on a projector, then opening the link on their own phones.
- Mongolian young people (18–25) who use Facebook daily and meet scams, outrage bait and misinformation in their feed.

## Product Purpose

Companion website for the team's browser extension. The extension is the core product (select Facebook text → manipulation-risk level + reasons). The site explains *why* the problem exists and teaches algorithm literacy: how the feed decides what you see.

Success for the demo: a judge understands the idea in one viewport, plays the algorithm game in under 2 minutes, and leaves knowing that misinformation is a multi-factor social problem.

## Positioning

Slogan: **Cure from the Core.** Metaphor: a pill/capsule — but not "one pill cures it".

- The **symptom** is one false/misleading claim. Everyone else treats the symptom (score the article).
- The **core** is the system that produces, selects and delivers the claim, plus the habits that make us accept it.
- The **patient is the information ecosystem, not the user.** The user is the clinician. Never say "we cure you".
- Four layers of the core, each mapped to an asset:
  1. Claim (symptom) → extension: signal breakdown, no verdict.
  2. Distribution (why it reached you) → the feed game / feed forensics. **The deep layer.**
  3. Production (who makes it and why) → source profiles (stub).
  4. Cognition (your own defaults) → training mode + pre/post measurement.
- Visual (home, 27 Oct 2026): a scroll-driven landing (`components/landing/`, GSAP). A monochrome capsule (the grey,
  uniform "core") gets "sick", splits, and releases 5 Okabe-Ito pills, one per site section (`src/data/sections.ts`).
  Each pill colour is that section's accent token (`--sec-*`). Motto on the landing: "Cure the Core".

Language to avoid: "we solve misinformation", "our AI detects fake news", "we cure people", "trust score".
Lines to use: "Treat the root, not the leaf." "The symptom is the claim. The disease is the pipeline."

## Capabilities and Constraints

- Routes: `/` home, `/game` feed-algorithm game, `/data` data viz, `/blog` + `/blog/[slug]`, `/about` (team + light map). The extension has no page on the site.
- No login, no user accounts. Mongolian (Cyrillic) only.
- Supabase stores data-viz statistics and the light map (`lights`: aimag, kind, time — no personal data). If env vars are missing the site reads the same numbers from `src/data/stats.ts` so the demo never breaks.
- It is a demo website for the hackathon, not a finished product.
- All code is written by AI agents; Mike gives direction and fixes.

## Brand Commitments

- Slogan "Cure from the Core" (user-given).
- Pill/capsule metaphor (user-given): one grey capsule is not the cure; many coloured pills (the 5 sections) are.
- The extension has no page on the site; its pill links to the install guide on GitHub.
- The site is used mostly on phones: design 390 px first, then desktop.
- Visual system: **HACKMIL 2026 Design system v3** (user-supplied sheets): Okabe Ito for UI and verdicts, Paul Tol for chart scales, Golos Text, light + dark, WCAG 2.2 AA, color never works alone.
- Visual references supplied by the user: an opened capsule spilling particles (3D); tsaaguur.mn/network starfield graph for the light map.
- Light map: every finished game or share lights +1 on a 3D map of Mongolia in the sharer's aimag.

## Evidence on Hand

- Real public statistics with sources in `docs/SOURCES.md` (Mongolian Police via ikon.mn/gogo.mn, NapoleonCat, DataReportal, Reuters Institute DNR 2026, NUM journal, Press Institute of Mongolia).
- Game posts are synthetic and labelled as such.
- Team member names other than Mike (М.Мөнх-Оргил) are unknown: placeholders must stay marked.
- No testimonials, user counts or accuracy numbers for the extension exist; never invent them.

## Product Principles

1. Teach, don't verdict: show how things work so the user decides.
2. Many factors, one capsule: always show the problem as a composition.
3. Every number has a source a judge can click.
4. Demo never breaks: fallback data, no auth, no external runtime dependency.

## Accessibility & Inclusion

Mongolian Cyrillic incl. Ө ө Ү ү must render in every face. Respect `prefers-reduced-motion` (3D stays static). Works on phones (judges open it on mobile).
