"""Shared slowapi Limiter instance.

Lives in its own module (rather than main.py) so router modules can import
`limiter` to decorate individual endpoints without a circular import with
main.py (which imports the routers).
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Generous default for plain read (GET) endpoints and other routes; AI-backed
# endpoints override this with a stricter limit via @limiter.limit(...).
limiter = Limiter(key_func=get_remote_address, default_limits=["120/hour"])

# Endpoints that call into ai_service.py get a stricter budget — those calls
# are the most expensive and, if a real API key is configured, the only ones
# that could incur cost from anonymous traffic.
AI_RATE_LIMIT = "20/hour"


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                "You've hit the rate limit for this public demo "
                f"({exc.detail}). Please wait a bit and try again."
            )
        },
    )
