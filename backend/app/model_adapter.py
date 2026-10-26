"""Bridge to the trained model in model/hm_core.py.

hm_core loads its joblib artifacts at import time and needs scikit-learn and lightgbm.
Importing it lazily keeps the rest of the API (page scorecard, /sources, tests) usable
when the model dependencies are missing, and lets /health report the real state.
"""
import logging
import sys
from types import ModuleType
from typing import Optional

from .config import MODEL_DIR

log = logging.getLogger(__name__)

_core: Optional[ModuleType] = None
_error: Optional[str] = None
_tried = False


def get_core() -> Optional[ModuleType]:
    """Return the hm_core module, or None if the model could not be loaded."""
    global _core, _error, _tried
    if not _tried:
        _tried = True
        try:
            if str(MODEL_DIR) not in sys.path:
                sys.path.insert(0, str(MODEL_DIR))
            import hm_core  # noqa: WPS433 (deliberately lazy)

            _core = hm_core
        except Exception as e:  # missing deps, missing artifact, version mismatch
            _error = f"{type(e).__name__}: {e}"
            log.exception("trained model unavailable")
    return _core


def status() -> dict:
    core = get_core()
    return {"loaded": core is not None, "error": _error}
