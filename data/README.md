# data/ — datasets, reference lists, local feedback

**Owner: model & data member.** Code never lives here; this folder is read by `model/` and `backend/`.

```
data/
├── datasets/     HACKMIL_dataset_v31_{train,val,test}.csv   labelled texts used to train/evaluate
├── reference/    hand-curated lists the backend reads at runtime
│   ├── whitelist.json        registered outlet DOMAINS (page scorecard: registered_outlet, domain_lookalike)
│   └── trusted_pages.json    trusted FACEBOOK PAGES by name/slug (post scoring: source_adjust)
└── feedback/     local only, git-ignored: feedback.csv, page_feedback.jsonl (written by the backend)
```

## datasets/

2,534 / 286 / 287 rows (train / val / test). Main columns: `text`, `label` (0 = true, 1 = false/misleading),
`label_name` (`true|false|misleading|inaccurate`), `source_type` (`news|factcheck|rewrite`), `platform`
(`gogo|ikon|eagle|mfcc|factcheckmn|claude`), `source_url`, `date`, `pair_id` (group id; the notebook uses it for grouped cross-validation),
`split`, `is_llm`, `title`.

Known imbalance: most `label=1` rows come from fact-checkers (MFCC, factcheck.mn) and most `label=0` rows from news
outlets, so a model can learn *outlet style* instead of *manipulation*. Always report the share of **real outlet
articles landing in red** when you change data or features. That is our most important metric.

To add data: put new files in `datasets/` with the same prefix/columns, then retrain
(`model/README.md`). Do not edit the existing split files by hand; add new versions (`v32`) instead.

## reference/

- Both lists are **starter lists** and must be verified against the official registry before the demo.
- `whitelist.json` (domains, used by the page scorecard) and `trusted_pages.json` (Facebook pages) describe the same
  outlets in two forms. The trained model also embeds a third copy (see `model/README.md`). Keep them consistent.
- Adding a Facebook page: see "Эх сурвалж" in [`model/README.md`](../model/README.md). The server picks up edits
  to `trusted_pages.json` without a restart.

## feedback/ — privacy

Feedback is collected from the extension buttons. Rules:
- Only the post text, image text, link, the user's label and the score shown are stored. **No author names, URLs of
  people's profiles, or user identifiers.** (Older local `feedback.csv` files may still contain author columns;
  they are never committed, and you can delete those columns.)
- Contents are git-ignored on purpose. Share a labelled file with teammates through a private channel, and
  review it before it is turned into a public dataset.
