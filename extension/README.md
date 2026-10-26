# extension/: Chrome extension (Manifest V3)

**Owner: extension member.** Plain JavaScript, no build step: load the folder in Chrome as an unpacked extension.
Product rules: [`CLAUDE.md`](../CLAUDE.md) section 2 (signals, not verdicts; no score; no green state).

```
Facebook feed ──▶ content.js: finds posts, draws a grey "Not assessed · Check" badge (Shadow DOM). Sends NOTHING.
                  click a badge ──▶ background.js ──(storage.session "sel:<tabId>")──▶ side panel opens
side panel ── user presses "Send for deeper check" ──▶ background.js ──▶ backend POST /api/check
                                                                     ◀── state + quoted signals
           badge updates to amber "Signals to check" / blue "Fact-check found" / grey "Not assessed"
side panel ── user presses "Look up" ──▶ /api/wayback, /api/rdap  (context cards)
offline or demo mode ──▶ demo-cache.json, every result labelled "cached demo result"
```

```
extension/
├── manifest.json     permissions: storage, sidePanel, activeTab; host permission for the API only
├── i18n.js           Mongolian + English strings (content teammate owns the Mongolian copy)
├── content.js        finds Facebook posts, draws the three-state badge in a closed Shadow DOM host
├── background.js     service worker: opens the panel (user gesture), calls the API, demo-cache fallback, install id
├── sidepanel.*       tabs: This page (post or pasted link/claim) · Tools (hub) · Mongolia · Habits
├── registry/         COPY of ../registry (tools, Mongolia sources, lessons, measurement). Do not edit here:
│                     edit ../registry and run `node registry/sync.mjs`
├── demo-cache.json   precomputed results for the demo pages (extension/backend/tools/build_demo_cache.py)
├── styles.css        page-level styles only (toast, highlight)
└── demo/             demo.html (fictional feed), fb_like.html (Facebook-like DOM incl. a Messenger chat that must be skipped)
```

## Run it

1. Backend (from the repo root):
   ```bash
   pip install -r extension/backend/requirements.txt
   python -m uvicorn extension.backend.app.main:app --port 8000
   ```
   Check http://127.0.0.1:8000/health.
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → this `extension/` folder. Chrome 116+.
3. Open http://127.0.0.1:8000/demo. Every post shows **Шалгаагүй · Шалгах**. Click one: the side panel opens with
   the post, an accuracy question, the **Гүнзгий шалгуулах** button and tools prefilled with the post's image/text/link.
4. No server? The panel shows **Demo mode** and answers from `demo-cache.json` with a "cached demo result" label.
   Settings (gear) → "Cached results only" forces this for the live demo, so no live call happens on stage.

## The three badge states

| Badge | Shape | Means | Never means |
|---|---|---|---|
| Шалгах дохио · Signals to check | amber triangle | wording/source features worth checking, with quotes | "false" |
| Баримт шалгалт олдсон · Fact-check found | blue page | MFCC / factcheck.mn checked a very similar claim; link + their headline | our verdict |
| Шалгаагүй · Not assessed | grey ring with a dash | not checked, could not check, or nothing found | "true" / "safe" |

There is no green state. Colour is never the only cue (shape + text). "Why am I seeing this?" in the panel shows
what triggered the state, what it can't tell you, and the measured false-positive rate
(`registry/measurement.json`, made by `model/tools/measure_signals.py`).

## Privacy

- Opening the panel from a badge sends nothing. Post text, image text, link and page name go to the backend only after
  "Send for deeper check"; the backend does not store them (feedback is off unless `HM_FEEDBACK=1`).
- Messenger chats (`role="article"` with `aria-roledescription="message"`) and Reels are skipped entirely.
- "Recently used" stores tool ids only, never URLs or text. The accuracy answer is never stored.

## Testing

- Gesture test (CLAUDE.md 9.1): click a badge on `/demo`. The panel should open. If Chrome refuses (no gesture),
  a toast says to click the toolbar icon; the panel then shows the same post from `storage.session`.
- Registry tests: `node --test "registry/test/*.test.js"` (includes a check that `extension/registry` is in sync).

## If badges do not appear on Facebook

Facebook changes its HTML often. In DevTools Console:
```js
document.querySelectorAll('div[aria-posinset], div[role="article"]').length   // posts found?
document.querySelectorAll('[data-ad-rendering-role="story_message"], [data-ad-preview="message"]').length  // text found?
```
If 0, update `POST_SELECTORS` / `MESSAGE_SELECTORS` in `content.js`. A post whose structure looks unexpected gets no
badge on purpose.

## Known limits

- The checker reads Mongolian wording only. Calm, formal falsehoods usually come out "Not assessed" (see the
  "хадгаламжийн 30%" demo post): that is honest, and the panel says so.
- Text inside images is read only from Facebook's automatic alt text, which often omits it.
- Firefox / Edge are out of scope.
