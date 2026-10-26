"""Single place for filesystem locations and environment switches.

Repo layout (see docs/ARCHITECTURE.md):
    model/        trained model code and artifacts (owned by the model/data member)
    data/         datasets, reference lists, local feedback (never committed)
    extension/    Chrome extension (also serves the /demo page)
"""
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]  # extension/backend/app/config.py -> repo root
MODEL_DIR = REPO_ROOT / "model"
EXTENSION_DIR = REPO_ROOT / "extension"


def _load_dotenv(path: Path) -> None:
    """KEY=VALUE lines from extension/backend/.env (git-ignored), so API keys work whatever shell starts
    uvicorn. Variables already set in the environment win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Reference lists (outlet domains, trusted Facebook pages). Same env var hm_core.py honours.
REFERENCE_DIR = Path(os.getenv("HM_REFERENCE_DIR", REPO_ROOT / "data" / "reference"))


def feedback_dir() -> Path:
    """Read at call time so tests can point it at a temp directory."""
    d = Path(os.getenv("HM_FEEDBACK_DIR", REPO_ROOT / "data" / "feedback"))
    d.mkdir(parents=True, exist_ok=True)
    return d
