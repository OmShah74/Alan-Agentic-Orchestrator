from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Union

class AgentRequest(BaseModel):
    task_id: Union[str, int]
    action: str
    parameters: Dict[str, Any]

class AgentResponse(BaseModel):
    status: str  # "success" or "error"
    stdout: str
    stderr: Optional[str] = ""
    artifacts_generated: List[str] = []