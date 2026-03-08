from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey, Integer
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()

class Conversation(Base):
    __tablename__ = 'conversations'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")

class Message(Base):
    __tablename__ = 'messages'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey('conversations.id'), nullable=False)
    role = Column(String, nullable=False)  # "user", "assistant", "system", "subagent"
    content = Column(Text, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)  # subagent info, guardrail data, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation = relationship("Conversation", back_populates="messages")

class Task(Base):
    __tablename__ = 'tasks'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey('conversations.id'), nullable=True)
    original_prompt = Column(Text, nullable=False)
    status = Column(String, default="running")  # running, completed, failed, awaiting_approval
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
    step_number = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)