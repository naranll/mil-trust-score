import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import llm_score, model_adapter, posts, proxy
from .config import EXTENSION_DIR
from .schemas import PageCheckResponse, ScoreRequest
from .scorecard import check_page

app = FastAPI(title="Signals-to-check API", version="0.3.0",
              description="Signals to check, never a verdict. No score, no true/false label.")

# CORS: only the Chrome extension and local development pages may call the API from a browser.
# HM_EXTENSION_IDS (comma separated) narrows chrome-extension:// to our own extension id(s) once known;
# unpacked installs get a different id per machine, so the default allows any extension origin.
# A deployed website goes in HM_CORS_ORIGINS (comma separated), e.g. HM_CORS_ORIGINS=https://site.example.mn
_extra = [o.strip() for o in os.getenv("HM_CORS_ORIGINS", "").split(",") if o.strip()]
_ids = [i.strip() for i in os.getenv("HM_EXTENSION_IDS", "").split(",") if i.strip()]
_ext = f"chrome-extension://({'|'.join(_ids)})" if _ids else r"chrome-extension://[a-p]{32}"
app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra,
    allow_origin_regex=rf"{_ext}|http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Install-Id"],
    expose_headers=["X-Cache"],
)

app.include_router(posts.router)
app.include_router(proxy.router)


@app.get("/health")
def health():
    m = model_adapter.status()
    return {"ok": True, "model": "rules + scorecard v4" if m["loaded"] else "unavailable", "model_error": m["error"],
            "llm": llm_score.status(), "feedback": posts.feedback_enabled()}


@app.get("/demo", include_in_schema=False)
def demo():
    """Facebook-free demo page for the extension (extension/demo/demo.html)."""
    return FileResponse(EXTENSION_DIR / "demo" / "demo.html")


@app.get("/demo/fb", include_in_schema=False)
def demo_fb():
    """Test page that mimics Facebook's real DOM structure (extension/demo/fb_like.html)."""
    return FileResponse(EXTENSION_DIR / "demo" / "fb_like.html")


@app.post("/api/check/page", response_model=PageCheckResponse)
def api_check_page(req: ScoreRequest) -> PageCheckResponse:
    """Rule signals for a news article / web page. No number, no verdict."""
    return check_page(req)
