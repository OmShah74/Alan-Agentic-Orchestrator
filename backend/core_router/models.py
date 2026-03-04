from enum import Enum
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import time

class LLMProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    GEMINI = "gemini"
    OPENROUTER = "openrouter"

class APIKeyInstance(BaseModel):
    name: str
    key: str
    provider: LLMProvider
    model_name: Optional[str] = None
    active: bool = True
    request_count: int = 0
    error_count: int = 0
    last_used: float = Field(default_factory=time.time)

class LLMConfig(BaseModel):
    preferred_provider: Optional[LLMProvider] = None
    instances: Dict[LLMProvider, List[APIKeyInstance]] = {}