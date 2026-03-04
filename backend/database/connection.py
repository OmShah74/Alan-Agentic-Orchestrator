import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.models import Base
import redis

# Postgres Setup
PG_USER = os.getenv("POSTGRES_USER", "alan")
PG_PASS = os.getenv("POSTGRES_PASSWORD", "alan_secure_pass")
PG_DB = os.getenv("POSTGRES_DB", "alan_db")
PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_PORT = os.getenv("POSTGRES_PORT", "5432")

DATABASE_URL = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{PG_DB}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

# Redis Setup
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
redis_client = redis.Redis(host=REDIS_HOST, port=int(REDIS_PORT), decode_responses=True)