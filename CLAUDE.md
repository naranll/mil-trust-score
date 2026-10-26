# CLAUDE.md v2 — "Cure from the Core" (HACKMIL 2026, MIL track)

> This file REPLACES the earlier CLAUDE.md. The product plan changed on 2026-10-26 (evening). Where this file and the old one disagree, this one wins. Keep the old "hard rules" spirit (signals, not verdicts) — it is restated below.
> Read it fully, then do the "First 2 hours" section before building anything new.
>
> **Decision 2026-10-26 (team):** no Google Fact Check Tools API. No `/api/factcheck`, no key. Fact-check matches come
> from the local MFCC / factcheck.mn index (`/api/check`); Fact Check Explorer is a plain link in the registry.
> Where sections 3.3, 5.1, 9 and 10 below mention the Google API, this decision wins.

## 0. Situation

- Hackathon: HACKMIL 2026 (Oct 26–27), run by an information/news agency. Track: Media and Information Literacy (MIL). Motto: "Cure from the core."
- Team of 4, about 24 hours left. Demo reliability beats feature count.
- We ALREADY have: a Chrome extension with a checker model, and a website. Do NOT rewrite them from scratch. Audit, then reshape (section 8).
- Stack is unknown to this file. Detect it from the repo, report it, and reuse it. Ask before introducing a new framework.

## 1. Product (new plan)

**One-line thesis:** "If people become even slightly interested in where their information comes from, we can make a change." We do not tell people what is true. We make the first ten minutes of verification faster and teach the habit behind them.

**Three surfaces, one shared tool registry:**

1. **Extension warning signs.** Small badges on posts/articles. They show *signals to check*, never a verdict.
2. **Sidebar (button press).** Opens `chrome.sidePanel` with: tools, sources, and context cards for the current page/selection.
3. **Website tool hub** (iLovePDF-style). Task-first tool grid, same registry, same tools, plus lessons and a Mongolia sources page.

**Audiences (role chips in both sidebar and hub):**
- Journalists / editors (redactors) / news writers: professional verification stack.
- Researchers / students: source tracing, archives, claim search.
- Office workers with a critical-thinking base: SIFT, short lessons, habit-building.

**Principle: signals, not verdicts.** The evidence (EDMO, WITNESS, label research) says opaque scores lose professionals' trust and detectors have documented false positives. Our value is honesty, maintenance and speed, not model novelty.

## 2. Hard rules (do not violate)

- No trust score, credibility score, true/false label, "fake" label, or composite number anywhere (UI, API, logs shown to users).
- **No green / "OK / verified" state.** Absence of a signal is "Not assessed", not "Safe".
- Do NOT show an "AI probability" for text. Do NOT host or run open-source deepfake detectors as a user-facing signal. AI-image/video/audio/watermark checks are LINK-OUTS with written limits.
- Never claim to reveal a platform's algorithm; never claim a tool is accurate without our measured numbers.
- Third-party ratings (MBFC, AllSides, Ad Fontes, NewsGuard): LINK OUT ONLY. Do not ingest or redistribute their data.
- Show third-party fact-check ratings VERBATIM with the publisher's name. Never normalize them. "No fact-check found" = absence of evidence, not a clean result.
- Do not scan or scrape live Facebook feeds in the default flow. Prefer user-selected text/images, news-article pages, or a "Check this post" button on user action. Never send Facebook post text, author names or IDs to our backend without an explicit "send for deeper check" press.
- No accounts/login. Anonymous install ID only. Minimise data retention (journalists' sources are at risk; Mongolia criminalises "false information" defamation).
- No remote code (Chrome Web Store policy). Remote config must be data-only.
- Nothing secret in the extension bundle. API keys live on the proxy.
- No live external call in the DEMO path. Every card must have a cached fallback and a visible "cached demo result" label.
- UI copy honesty: state what each tool cannot do. Small samples are reported as small samples.

## 3. Architecture

### 3.1 Shared registry (single source of truth)
`packages/registry/tools.json` (or the repo's equivalent), validated by a schema, imported at BUILD TIME by both the extension and the website (remote updates, if any, are data-only).

```ts
type ToolEntry = {
  id: string;
  name: string;            // task-first, e.g. "Where else has this photo appeared?"
  subtitle?: string;       // e.g. "TinEye"
  description: string;     // one line
  categories: ("images"|"video"|"claims"|"sources"|"archives"|"ai-signals"|"geolocation"|"documents"|"habits")[];
  audiences: ("journalist"|"editor"|"researcher"|"office")[];
  input: "url"|"image_url"|"text"|"claim"|"domain"|"none";
  cost: "free"|"free-with-signup"|"paid"|"unknown";
  needsLogin: boolean;
  limits: string;          // REQUIRED, plain-language "what this can't tell you"
  open:
    | { mode: "deeplink"; template: string; fallbackUrl: string }   // {U} = encodeURIComponent(input)
    | { mode: "api"; adapter: "wayback"|"factcheck"|"checker"|"c2pa" }
    | { mode: "internal"; route: string };
  status: "ok"|"unverified"|"broken";
  lastVerified: string;    // ISO date
  sourceUrl: string;       // where we learned about it
};
```

- Default to `deeplink` (no backend, degrades to homepage). Use `api` only for: Wayback card, Fact Check card, our checker model, C2PA reader.
- Shared `buildLink(tool, input)`: http/https only, max 2,048 chars, `encodeURIComponent`, unit-tested on at least 3 templates.
- Where a URL parameter format is not verified, set `template` to the homepage and show the claim/URL text with a copy button. Do not guess templates.
- A link-check script opens each template with a sample, writes `status` + `lastVerified`.

### 3.2 Extension
- `chrome.sidePanel` (Chrome 114+; `open()` needs 116+ and a USER GESTURE). Request only: `sidePanel`, `storage`, `activeTab`, plus host permissions for our proxy/demo domains.
- Content script: thin. Badge in a **Shadow DOM** host. Minimal messages to the service worker. The service worker builds URLs and calls `fetch()` (content scripts are bound by page CORS).
- Service worker is killed after ~30 s idle: keep state in `chrome.storage` (not globals).
- **Test in the first hour:** does a badge click in a content script still open the side panel after `runtime.sendMessage`? (An `await` before `open()` loses the gesture.) Fallback: badge click writes context to `chrome.storage.session` keyed by tabId, and `openPanelOnActionClick: true` so the toolbar click opens the panel, which reads that state.
- Feed DOM is fragile: prefer `[role="article"]`, sanity-check structure before injecting, show NO badge if the structure is unexpected. Use `MutationObserver` for dynamic content.
- Firefox/Edge: out of scope (Firefox needs `sidebar_action` + dual background keys). Do not spend time.

### 3.3 Proxy (thin Cloudflare Worker, ~150 lines, or the repo's existing backend if it has one)
- `/api/wayback` (archive history), `/api/factcheck` (Google Fact Check Tools Claim Search, key as secret), optional `/api/check` (our model), data-only `/api/registry`.
- Validate inputs (http/https only, block private IP ranges). CORS restricted to our site + extension origin.
- Cache: Wayback ~1 h, fact checks 6–24 h. Return `X-Cache` header.
- Rate limit by anonymous install ID (not IP) + a daily budget counter for the Google API.
- 4–5 s timeouts. On failure: fall back to the plain deep link, never an error wall.

### 3.4 Offline demo pack
- `demo-cache.json`: the registry, 10–20 precomputed responses for demo URLs/claims, cached checker outputs for demo posts.
- Visible **Demo mode** when `navigator.onLine` is false or the proxy returns non-200. Label results "cached demo result".
- A static **fixture feed page** runs the badge behaviour for the live demo; keep a screen recording of the real-site run.

## 4. Warning-sign (badge) design — honest states

Three states, each with icon + text (colour is never the only cue, WCAG 1.4.1):

| State | Colour | Meaning |
|---|---|---|
| Signals to check | amber | our checker/rules found things worth checking (shows top 2–3 reasons in plain words) |
| Fact-check found | blue | a publisher's fact-check exists; link to the publisher, rating shown verbatim |
| Not assessed | grey | we did not or could not check; says nothing about truth |

- NO green. Red only for a human-published "rated false" result from a fact-checker, shown with their name.
- Show a coarse band instead of a percentage, plus coverage ("assessed 14 of 20 posts").
- "Why am I seeing this?" panel: what triggered it, what it can't tell you, and our model's measured false-positive rate on held-out data (see section 7 — MEASURE IT).
- Pair with a 1-question accuracy prompt and a 30-second "spot the tactic" card (accuracy prompts have field-experiment support; inoculation evidence is mixed, so we claim "modest, mixed" not "reduces misinformation").
- UI strings in Mongolian and English. Avoid loaded translations of "misinformation" (there is no direct word); use plain "signal to check" phrasing. Content teammate owns Mongolian copy.

## 5. Sidebar & hub contents

### 5.1 First tools (15–20 registry entries)
| Group | Tools | Mode |
|---|---|---|
| Reverse image | Google Lens `https://lens.google.com/uploadbyurl?url={U}`; Yandex `https://yandex.com/images/search?rpt=imageview&url={U}`; TinEye `https://tineye.com/search?url={U}`; Baidu `https://image.baidu.com/n/pc_search?queryImageUrl={U}`; SauceNAO (homepage) | deeplink (templates are UNOFFICIAL, from one OSINT site: VERIFY, store `lastVerified`). Bing has no working template: omit. |
| Archives | Wayback availability `https://archive.org/wayback/available?url=` | api via proxy (429 anti-bot since 2026-09-15: cache + backoff) |
| Claims | Google Fact Check Tools Claim Search (`claims:search`, v1alpha1, API key) | api via proxy. Fact Check Explorer: homepage link only. Fallback: Data Commons ClaimReview feed (CC BY 4.0) pre-downloaded. |
| Geolocation/time | SunCalc, Google Earth, OpenStreetMap | homepage link only (params unverified) |
| Metadata | ExifTool-class viewer, FotoForensics | homepage link only |
| Video | InVID-WeVerify plugin (Chrome Web Store) | link, recommend; do NOT rebuild |
| AI signals | C2PA / Content Credentials reader (`c2pa-web`, MIT, client-side) | internal; DeepFake-o-Meter, SynthID Detector (Google, public Oct 2026 per secondary reports: VERIFY synthid.com), Hive extension | link-out with limits |
| Habits | SIFT lesson (CC BY 4.0, attribute Caulfield), IFCN Code 5-commitments checklist | internal |
| Mongolia | see 5.2 | internal page |

Every entry needs a real `limits` string. Example (reverse image): "Finds copies the engine has indexed. No match does not mean the image is new." Example (C2PA): "Shows who signed a file and declared edits. Most web images lose credentials when platforms re-encode, so 'none found' tells you nothing."

### 5.2 Mongolia card
- MFCC (Mongolian Fact-Checking Center, mfcc.mn, Nest Center) and its "Asuu" Messenger tipline (Meedan Check, launched 2024-05-17). Wording: **"IFCN-assessed"** with a link, NOT "IFCN signatory" (current status is contradictory; verify on the live IFCN list).
- Press Institute of Mongolia (pressinst.org.mn): monitoring, training, media stats.
- Media Council of Mongolia (mediacouncil.mn): self-regulation, public complaints.
- National MIL network (PIM + UNESCO Mongolian committee): curriculum and tutorials exist; direct links not found.
- Ownership: RSF Media Ownership Monitor, label "2016 data" (about 89% of 39 outlets not transparent about owners; 74% politically affiliated). Teach users to consult registry/beneficial-ownership filings.
- Primary data (LINK-OUT only, no integration): legalinfo.mn (legislation), opendata.1212.mn (National Statistics Office; API returns HTTP 500 often).
- RSF Press Freedom Index: show country score UNMODIFIED with attribution (CC BY-ND, non-commercial); frame as the press-freedom environment of the country, never an outlet rating.

### 5.3 Context cards (the "live value", sidebar)
For the current page/selection: domain info (RDAP: registrar + creation date; registrant mostly redacted), archive history (Wayback), fact-check matches (Fact Check API), Content Credentials (C2PA, images), outlet context (Wikipedia Perennial Sources list as a pre-built static JSON where an entry exists; otherwise "no entry found"). Show facts, not scores. For outlet bias/ratings, if shown at all, show each rater's own wording side by side with date + methodology link and a line that raters disagree, or "no ratings found".

## 6. Tone / bias / AI-text policy

- Tone: no positive/negative label. Show quoted emotionally loaded phrases, counts of absolutes/hedges, whether claims are attributed. Each clickable to the exact text. Standing line: "Experimental. Not validated for Mongolian."
- No validated Mongolian sentiment or bias model was found. An LLM that returns quoted loaded phrases is acceptable if labelled unvalidated.
- AI text: show nothing. AI watermark: link-out. Deepfake: link-out. C2PA: the only in-product AI-related signal, shown as "Signed by X on date Y, declared edits Z" or "No Content Credentials found (uninformative)".

## 7. Measurement (keep the "cure" provable)

- MEASURE the checker model's false-positive rate on a held-out set of labelled items THIS AFTERNOON; the badge copy depends on it. Ask the content teammate for ground-truth labels (human labels, never model output).
- Stretch: a local, privacy-preserving pre/post "spot the signal" quiz (6 items pre, different 6 items post, no hints in post; random ID stored locally; opt-in aggregate upload only). Report n honestly; there is no control group, so claim "skill change in this session", not habit change.
- Optional: log which tools were opened on which URL and when, locally, as an exportable evidence log (mirrors newsroom evidence-handling practice).

## 8. First task: audit the existing code (report, then wait)

1. List every screen, feature, endpoint, model call in the extension and website.
2. Classify each KEEP / RESHAPE / CUT with one test: **does it do the user's thinking for them, or hide its limits?**
   - Outputs a score/verdict/"fake" label → RESHAPE to signals + reasons + three-state badge.
   - Stats dashboard about misinformation → CUT or replace with the tool hub.
   - Chatbot → CUT, or make it ask questions instead of answering.
   - Existing model → KEEP behind `/api/check`, show reasons, measure its false positives.
   - Auto-scan of every feed post → RESHAPE to user-action or allowlisted news pages.
3. Report as a short table with the detected stack and what you would change. Wait for confirmation before large refactors. Small, safe fixes (UI bugs) can proceed.

## 9. First 2 hours (de-risk BEFORE building features)

Do these as tiny spikes and report each as PASS / FAIL / PARTIAL:
1. Badge click → side panel opens (gesture test) or fallback works.
2. Google Fact Check API key works; note any quota errors. (Docs last updated 2023; snippets removed from Search in 2025: do not assume.)
3. Open every deep-link template with a sample image; record status/lastVerified.
4. Wayback call from the proxy: works, caching, 429 handling.
5. `c2pa-web` loads and reads a manifest from a known Content Credentials sample image (README has no usage example: confirm the API).
6. Check synthid.com status (secondary reports only so far).
7. Check the live IFCN signatory list for MFCC.

## 10. Build order (after the audit and spikes)

1. Registry package + schema + `buildLink` + tests.
2. Sidebar and hub both render from the registry (role chips, task-first search, categories, "recently used").
3. Proxy: `/api/wayback`, `/api/factcheck`, cache, timeouts, fallbacks.
4. Three-state badge + "Why am I seeing this?" + limits text on every tool.
5. Context card (domain, archive, fact-checks).
6. Mongolia card + Mongolian/English strings.
7. Demo pack, Demo mode, fixture feed page.
8. Accessibility pass: icon + text, 24 px targets, `aria-live` for panel updates.
9. Stretch, in order: C2PA reader panel; Wikipedia perennial-sources static list; Wikidata ownership + RDAP domain age; local pre/post quiz.
10. FREEZE code at hour 22. Rehearse twice.

**CUT without regret:** Firefox; scanning live Facebook feeds; X/Reddit/Bing/Meta/face-search integrations; ingesting MBFC/AllSides/Ad Fontes/NewsGuard data; any composite credibility/bias/"AI probability" score; hosted open-source deepfake detectors; a text AI detector; OpenCorporates, Common Crawl, Media Cloud; anything needing remote code.

**Irreducible demo if time collapses:** registry, hub, sidebar with deep links, Wayback + Fact Check cards, three-state badge with honest copy, Demo mode.

## 11. Pitch spine (so the build serves it)

1. Others hand you a verdict and ask you to trust it. Professionals do not trust opaque verdicts.
2. We built the layer above the tools professionals already use: one input, every engine, limits beside each tool, honest signals.
3. Demo: badge → sidebar → context card → tool opened with prefilled input → "Not assessed" example showing we don't fake certainty.
4. Honesty slide: what we don't claim (no verdicts, no AI-text detection, Mongolian tone experimental).
5. "A verdict treats one claim. Literacy treats the next thousand."

## 12. Open decisions (ask the user; do not assume)

- Detected stack of the extension and website, and what the model currently outputs.
- Exact roles per teammate and who owns the proxy.
- Whether Mongolian items/copy are ready from the content teammate.
- Whether to ship the pre/post quiz or leave it as roadmap.

## 13. Known unverified facts (treat as hypotheses, label in UI if used)

Google Fact Check API still working in Oct 2026 and its quota; the deep-link templates above (single OSINT source); SynthID Detector launch details (secondary reports); `c2pa-web` API surface; MFCC current IFCN status; Chrome Web Store tightening from 2026-08-01; any claim sourced only to maxintel.org; ownership data currency (2016). Full sources and reasoning: see the research report `MIL tools for journalists.md`.
