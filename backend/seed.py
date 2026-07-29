"""Run: uv run python seed.py — populates the DB with realistic global demo data.

The actual dataset and seeding logic live in app.utils.seed_data so the same
code is reused by the periodic public-demo reset job started from main.py —
this script is just the CLI entry point.
"""

import asyncio

from app.utils.seed_data import seed_database


async def seed():
    await seed_database()
    print("\n✓ Demo data seeded successfully")
    print("\nRun the app and visit http://localhost:3000")


if __name__ == "__main__":
    asyncio.run(seed())
