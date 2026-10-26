"""API contract shared with the extension (role 3) and the model (role 1).

The extension sends only page content. No usernames, comments or browsing history.
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


class Reason(BaseModel):
    code: str            # stable id, also the MIL card id
    label: str           # short Mongolian text shown to the user
    points: float        # contribution to the score (negative lowers it)


class ScoreResponse(BaseModel):
    score: int                                   # 0-100
    zone: Literal["green", "yellow", "red"]
    reasons: List[Reason]                        # top 3 by impact
    disclaimer: str = "Энэ оноо бүрэн найдвартай биш. Эх сурвалжийг өөрөө шалгаарай."


class FeedbackRequest(BaseModel):
    url: str
    score_shown: int
    user_says: Literal["too_low", "too_high", "wrong_reason"]
    comment: Optional[str] = None
