"""Bridge to the trained model code in model/ (hm_core, post_types, kb).

hm_core loads its joblib artifacts at import time and needs scikit-learn and lightgbm.
Importing lazily keeps the rest of the API (page scorecard, tests) usable when the model
dependencies are missing, and lets /health report the real state.
"""
import logging
import sys
from types import SimpleNamespace
from typing import Optional

from .config import MODEL_DIR

log = logging.getLogger(__name__)

_mods: Optional[SimpleNamespace] = None
_error: Optional[str] = None
_tried = False


def get_model() -> Optional[SimpleNamespace]:
    """Return a namespace with .hm_core, .post_types and .kb, or None if they could not be loaded."""
    global _mods, _error, _tried
    if not _tried:
        _tried = True
        try:
            if str(MODEL_DIR) not in sys.path:
                sys.path.insert(0, str(MODEL_DIR))
            import hm_core  # noqa: WPS433 (deliberately lazy)
            import kb
            import post_types

            _mods = SimpleNamespace(hm_core=hm_core, post_types=post_types, kb=kb)
        except Exception as e:  # missing deps, missing artifact, version mismatch
            _error = f"{type(e).__name__}: {e}"
            log.exception("trained model unavailable")
    return _mods


def status() -> dict:
    mods = get_model()
    return {"loaded": mods is not None, "error": _error}
