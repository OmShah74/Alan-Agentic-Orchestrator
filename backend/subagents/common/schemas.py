from pydantic import BaseModel
from typing import Dict, Any, Optional, List

class AgentRequest(BaseModel):
    task_id: str
    action: str
    parameters: Dict[str, Any]

class AgentResponse(BaseModel):
    status: str  # "success" or "error"
    stdout: str
    stderr: Optional[str] = ""
    artifacts_generated: List[str] =[]