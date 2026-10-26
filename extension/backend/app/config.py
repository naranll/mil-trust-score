"""Single place for filesystem locations and environment switches.

Repo layout (see docs/ARCHITECTURE.md):
    model/        trained model code and artifacts (owned by the model/data member)
    data/         datasets, reference lists, local feedback (never committed)
    extension/    Chrome extension (also serves the /demo page)
"""
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = REPO_ROOT / "model"
EXTENSION_DIR = REPO_ROOT / "extension"

# Reference lists (outlet domains, trusted Facebook pages). Same env var hm_core.py honours.
REFERENCE_DIR = Path(os.getenv("HM_REFERENCE_DIR", REPO_ROOT / "data" / "reference"))


def feedback_dir() -> Path:
    """Read at call time so tests can point it at a temp directory."""
    d = Path(os.getenv("HM_FEEDBACK_DIR", REPO_ROOT / "data" / "feedback"))
    d.mkdir(parents=True, exist_ok=True)
    return d
