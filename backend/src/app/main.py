import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.database import init_db
from app.routers import analytics, customers, invoices, reminders
from app.utils.rate_limit import limiter, rate_limit_exceeded_handler
from app.utils.seed_data import reset_database

logger = logging.getLogger(__name__)

_reset_task: asyncio.Task | None = None


async def _periodic_reset_loop() -> None:
    """Restore the demo database to its originally-seeded state on a fixed interval."""
    interval_seconds = max(settings.demo_reset_interval_minutes, 1) * 60
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await reset_database()
        except Exception:
            # A failed reset must never take down the app for public visitors.
            logger.exception("Scheduled demo database reset failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _reset_task
    await init_db()

    if settings.public_demo_mode:
        try:
            # First-run convenience: if the demo DB is empty (fresh deploy,
            # no manual `seed.py` run yet), seed it once at startup so the
            # public demo isn't blank.
            from sqlalchemy import func, select

            from app.database import AsyncSessionLocal
            from app.models.customer import Customer

            async with AsyncSessionLocal() as db:
                count = (await db.execute(select(func.count(Customer.id)))).scalar_one()
            if not count:
                await reset_database()
        except Exception:
            logger.exception("Initial public demo seed check failed")

        _reset_task = asyncio.create_task(_periodic_reset_loop())

    yield

    if _reset_task:
        _reset_task.cancel()


app = FastAPI(
    title=settings.app_name,
    description="AI-powered revenue recovery system — automated invoice follow-up, risk classification, and payment collection.",
    version="1.0.0",
    lifespan=lifespan,
    # Interactive docs are a public information-disclosure surface — disable
    # entirely for the public demo.
    docs_url=None if settings.public_demo_mode else "/docs",
    redoc_url=None if settings.public_demo_mode else "/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers.router, prefix="/api/v1")
app.include_router(invoices.router, prefix="/api/v1")
app.include_router(reminders.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "app": settings.app_name, "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
