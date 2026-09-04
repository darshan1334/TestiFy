"""
Async SQLite database engine and session factory.
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text, event
from contextlib import asynccontextmanager
from database.models import Base
from config import settings
import logging

logger = logging.getLogger(__name__)

# Create async engine
# timeout: how long a connection waits for a lock before raising
# "database is locked" (SQLite's default of 5s is easily exceeded while the
# agent pipeline writes a batch of issues).
engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False, "timeout": 30},
)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record):
    """
    Configure SQLite for concurrent access.

    The API request that creates a session and the background agent pipeline
    that fills it in run on different pooled connections. Under the default
    rollback journal, SQLite locks the whole database file for any writer, so
    those two collide and the pipeline dies with "database is locked".

    WAL lets readers and a writer coexist, and busy_timeout makes a competing
    writer wait its turn instead of failing immediately.
    """
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Create all tables if they don't exist and ensure schema is up to date."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Schema migration check for backward compatibility
        def migrate_schema(sync_conn):
            try:
                res = sync_conn.execute(text("PRAGMA table_info(test_reports)")).fetchall()
                col_names = [r[1] for r in res]
                if "pdf_path" not in col_names:
                    sync_conn.execute(text("ALTER TABLE test_reports ADD COLUMN pdf_path VARCHAR"))

                res = sync_conn.execute(text("PRAGMA table_info(test_sessions)")).fetchall()
                col_names = [r[1] for r in res]
                if "source_type" not in col_names:
                    sync_conn.execute(text(
                        "ALTER TABLE test_sessions ADD COLUMN source_type VARCHAR DEFAULT 'url'"
                    ))
                    sync_conn.execute(text(
                        "UPDATE test_sessions SET source_type = 'url' WHERE source_type IS NULL"
                    ))
            except Exception as e:
                logger.warning(f"Schema check notice: {e}")
                
        await conn.run_sync(migrate_schema)
    logger.info("Database initialized successfully")


async def get_db() -> AsyncSession:
    """FastAPI dependency: yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context():
    """Context manager for use outside of FastAPI dependency injection."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
