import asyncio
from database.db import engine, Base
from database.models import User
import aiosqlite

async def migrate():
    # 1. Create the new `users` table safely
    async with engine.begin() as conn:
        await conn.run_sync(User.metadata.create_all)
        print("Created users table if it didn't exist.")

    # 2. Add `user_id` to `issue_reports` table manually via raw SQL
    async with aiosqlite.connect('testify.db') as db:
        try:
            await db.execute('ALTER TABLE issue_reports ADD COLUMN user_id VARCHAR REFERENCES users(id)')
            await db.commit()
            print("Added user_id column to issue_reports.")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("Column user_id already exists.")
            else:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
