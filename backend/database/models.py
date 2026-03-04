from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

class Task(Base):
    __tablename__ = 'tasks'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    original_prompt = Column(Text, nullable=False)
    status = Column(String, default="running") # running, completed, failed
    final_output = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Step(Base):
    __tablename__ = 'steps'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String, ForeignKey('tasks.id'))
    agent_assigned = Column(String, nullable=False)
    payload_sent = Column(JSON, nullable=False)
    payload_received = Column(JSON, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)