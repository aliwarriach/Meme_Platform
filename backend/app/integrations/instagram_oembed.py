"""Instagram metadata fetch — **stubbed** (Project_Requirements §13). A real integration
needs Instagram Graph API app review + an access token, neither of which exist in this
project yet. This module exposes the stable interface every caller should use
(`fetch_metadata(source_url) -> OEmbedMetadata`) so swapping in the real oEmbed/Graph API
call later touches only this file — never a consumer. Confirmed with user: build the
pluggable interface now, stub the actual HTTP call, same pattern as `services/scoring.py`.
"""

from dataclasses import dataclass


@dataclass
class OEmbedMetadata:
    title: str | None
    thumbnail_url: str | None


async def fetch_metadata(source_url: str) -> OEmbedMetadata:
    """Placeholder: derives a best-effort title from the URL itself and returns no
    thumbnail. Swap this body for a real Instagram Graph API oEmbed call (requires an
    approved app + access token) without changing the function signature or any caller.
    """
    slug = source_url.rstrip("/").rsplit("/", 1)[-1] or "Instagram post"
    return OEmbedMetadata(title=f"Instagram post ({slug})", thumbnail_url=None)
