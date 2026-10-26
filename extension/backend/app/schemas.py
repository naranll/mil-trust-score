"""API shapes for page checks (POST /api/check/page). Post checks live in posts.py.

The extension sends only page content. No usernames, comments or browsing history.
There is no score, zone or verdict field anywhere: see CLAUDE.md section 2.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ScoreRequest(BaseModel):
    url: str
    title: str = ""
    text: str = ""
    links: List[str] = Field(default_factory=list)   # hrefs found on the page
    images: List[str] = Field(default_factory=list)  # image URLs (unused in MVP)
    author: Optional[str] = None                      # from meta tag, if present
    published_date: Optional[str] = None              # ISO date, e.g. 2026-10-20


class PageItem(BaseModel):
    code: str            # stable id, also the MIL card id
    label: str           # short Mongolian text shown to the user


class PageCheckResponse(BaseModel):
    state: Literal["signals", "not_assessed"]
    signals: List[PageItem]                      # up to 3, most important first
    context: List[PageItem]                      # facts about the page, not a judgement
    disclaimer: str = "Эдгээр нь шалгах дохио, дүгнэлт биш. Мэдээ үнэн эсэхийг хэлэхгүй."
