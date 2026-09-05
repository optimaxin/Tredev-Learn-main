"""One-time backfill: fills title_hi/excerpt_hi/body_hi on blogs and
title_hi/subtitle_hi/description_hi on offerings for rows created before
auto-translation was added. Safe to re-run: skips rows that already have a
title_hi set."""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import db as dbmod
from db import db
from translate import auto_translate


async def backfill_blogs():
    rows = await db.blogs.find({"title_hi": None}).to_list(None)
    for row in rows:
        update = {
            "title_hi": auto_translate(row.get("title") or ""),
            "excerpt_hi": auto_translate(row.get("excerpt") or ""),
            "body_hi": auto_translate(row.get("body") or ""),
        }
        await db.blogs.update_one({"_id": row["_id"]}, {"$set": update})
        print(f"blog {row['_id']}: translated")


async def backfill_offerings():
    rows = await db.offerings.find({"title_hi": None}).to_list(None)
    for row in rows:
        update = {
            "title_hi": auto_translate(row.get("title") or ""),
            "subtitle_hi": auto_translate(row.get("subtitle") or ""),
            "description_hi": auto_translate(row.get("description") or ""),
        }
        await db.offerings.update_one({"_id": row["_id"]}, {"$set": update})
        print(f"offering {row['_id']}: translated")


async def main():
    await dbmod.connect(os.environ["DATABASE_URL"])
    await backfill_blogs()
    await backfill_offerings()
    await dbmod.close()


if __name__ == "__main__":
    asyncio.run(main())
