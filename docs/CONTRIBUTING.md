# Working together

Four people, one repo. The goal of this guide is that nobody has to ask "where does this go?" or "who broke the
build?".

## Branches and commits

- `main` always runs. Work on a branch named after the area and task: `model/retrain-v32`, `website/games`,
  `extension/pause-before-share`, `backend/image-scanner`.
- Open a pull request into `main`; at least one other person looks at it when it touches a contract
  (`docs/API.md`, reason codes, the `trust_score()` result).
- Commit messages and code comments in English, short and specific ("Add urgency keywords for loan scams"). The
  user-facing text in the product is Mongolian.
- Keep commits small. Do not reformat files you did not change.
- Stay inside your folder (see the table in [`ARCHITECTURE.md`](ARCHITECTURE.md)). Need a change elsewhere? Open an
  issue or message the owner; for tiny fixes, a PR touching their folder is fine if they are tagged.

## Never commit

Enforced by `.gitignore`, but check `git status` before you commit:
- virtual environments (`.venv/`), `node_modules/`, `__pycache__/`
- `data/feedback/*`: it contains what real users flagged
- secrets and `.env` files (use `.env.example` with fake values)
- model backups (`*.bak.joblib`)

## Setup (all commands from the repo root)

```bash
python -m venv .venv                 # one venv for backend + model
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend && pytest -q              # should be green before you start
```

Python 3.11 or 3.12 recommended. If `pip` fails with `CERTIFICATE_VERIFY_FAILED` behind a school/office proxy, use
`pip install --use-feature=truststore ...` (uses the Windows/macOS certificate store; do not disable verification).

## Model files

`.joblib` artifacts are binary and tied to a scikit-learn version. Only the model & data member commits them, and
the version pin in `model/requirements.txt` changes in the same commit. Details: [`model/README.md`](../model/README.md).

## Before you push

- Backend: `cd backend && pytest -q`
- Extension: reload it in `chrome://extensions`, open `http://127.0.0.1:8000/demo`, check the badge
- If you changed a score-affecting file (`hm_core.py`, weights, keyword lists, reference lists): check that real
  outlets still land green. A real outlet in red is a demo failure.
- If you changed an endpoint or a reason code: update `docs/API.md` in the same PR.

## Line endings

`.gitattributes` normalises text files to LF in the repository, so Windows and macOS teammates do not create
whole-file diffs. CSV datasets are left untouched on purpose.
