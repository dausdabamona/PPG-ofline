"""
Database Connection Manager - PPG Sorong Desktop
Menggunakan SQLAlchemy 2.0+ dengan SQLite
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager
import sys
import os

# Add parent to path for config import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATABASE_URL, DATABASE_PATH

# Create engine dengan konfigurasi SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,  # Untuk multi-threading PyQt
    },
    poolclass=StaticPool,  # Single connection pool untuk SQLite
    echo=False,  # Set True untuk debug SQL
)

# Enable foreign keys di SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging untuk performa
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

@contextmanager
def get_session() -> Session:
    """Context manager untuk database session"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def init_database():
    """Inisialisasi database - create tables dan seed data"""
    from .models import Base
    from .seed_data import seed_initial_data

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Seed data awal
    with get_session() as session:
        seed_initial_data(session)

    print(f"Database initialized at: {DATABASE_PATH}")

def reset_database():
    """Reset database - DROP ALL dan recreate (HANYA UNTUK DEVELOPMENT!)"""
    from .models import Base

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    from .seed_data import seed_initial_data
    with get_session() as session:
        seed_initial_data(session)

    print("Database reset complete!")
