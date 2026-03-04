from fastapi import FastAPI
import os
from common.schemas import AgentRequest, AgentResponse
import uvicorn

app = FastAPI()
WORKSPACE_DIR = os.getenv("WORKSPACE_DIR", "/workspace")

def is_safe_path(path: str) -> bool:
    """Chroot-like security check to prevent directory traversal out of workspace"""
    abs_path = os.path.abspath(path)
    return abs_path.startswith(os.path.abspath(WORKSPACE_DIR))

@app.post("/execute", response_model=AgentResponse)
async def execute_file_op(req: AgentRequest):
    action = req.action
    params = req.parameters
    
    path = params.get("file_path", "")
    if not is_safe_path(path):
        return AgentResponse(status="error", stdout="", stderr="Security Exception: Path traversal attempt blocked.")

    try:
        if action == "create_dir":
            os.makedirs(path, exist_ok=True)
            return AgentResponse(status="success", stdout=f"Directory created: {path}")

        elif action == "write_file":
            content = params.get("content", "")
            # Ensure parent dir exists
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return AgentResponse(status="success", stdout=f"File written securely: {path}")

        elif action == "read_file":
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            return AgentResponse(status="success", stdout=content)
            
        return AgentResponse(status="error", stdout="", stderr="Unknown action")
    except Exception as e:
        return AgentResponse(status="error", stdout="", stderr=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)