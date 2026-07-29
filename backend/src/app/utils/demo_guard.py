"""Guard dependency for disabling destructive/irreversible actions in public demo mode."""

from fastapi import HTTPException

from app.config import settings


def block_if_public_demo() -> None:
    """FastAPI dependency — raise 403 for destructive endpoints when PUBLIC_DEMO_MODE is on.

    Use as `Depends(block_if_public_demo)` on any endpoint that deletes data or
    performs another irreversible bulk action, so anonymous public visitors
    cannot permanently damage the shared demo dataset.
    """
    if settings.public_demo_mode:
        raise HTTPException(status_code=403, detail="Disabled in the public demo")
