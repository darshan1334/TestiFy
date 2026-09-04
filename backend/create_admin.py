import asyncio
from database.db import get_db
from database.models import User
from routers.auth import get_password_hash

async def create_admin():
    async for db in get_db():
        admin = User(
            name="Admin User",
            email="admin@testify.com",
            password_hash=get_password_hash("adminpassword123"),
            role="ADMIN"
        )
        db.add(admin)
        await db.commit()
        print("Admin user created: admin@testify.com / adminpassword123")

if __name__ == "__main__":
    asyncio.run(create_admin())
