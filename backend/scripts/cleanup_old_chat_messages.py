"""Deletes community-chat messages older than the retention window (backend/chat.py's
RETENTION_DAYS). Run via OS cron if you prefer that over the daily background task
already started in server.py's on_startup."""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import db as dbmod
import chat


async def main():
    await dbmod.connect(os.environ["DATABASE_URL"])
    await chat.purge_old_messages()
    await dbmod.close()


if __name__ == "__main__":
    asyncio.run(main())
