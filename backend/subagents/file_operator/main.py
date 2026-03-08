from fastapi import FastAPI
import os
from backend.subagents.common.schemas import AgentRequest, AgentResponse
import uvicorn
from loguru import logger

app = FastAPI()
WORKSPACE_DIR = os.getenv("WORKSPACE_DIR", "/workspace")

from backend.subagents.common.guardrails import evaluate_path_tier, check_permission


def _resolve_path(raw_path: str) -> str:
    """Convert Windows paths to Docker-mounted paths. 
    C:\\Users\\... -> /host_c/Users/...
    Also handle already-correct /host_c/ paths."""
    if not raw_path:
        return ""
    
    # Already a Linux path
    if raw_path.startswith("/"):
        return raw_path
    
    # Windows path: C:\Users\... or C:/Users/...
    path = raw_path.replace("\\", "/")
    if len(path) >= 2 and path[1] == ":":
        drive_letter = path[0].upper()
        rest = path[2:]
        if rest.startswith("/"):
            rest = rest[1:]
        return f"/host_{drive_letter.lower()}/{rest}"
    
    # Relative path — put in workspace
    return os.path.join(WORKSPACE_DIR, raw_path)


@app.post("/execute", response_model=AgentResponse)
async def execute_file_op(req: AgentRequest):
    action = req.action
    params = req.parameters
    
    # Extract path from multiple possible keys
    raw_path = params.get("path") or params.get("file_path") or params.get("filepath") or params.get("directory") or ""
    path = _resolve_path(raw_path)
    
    if not path:
        return AgentResponse(status="error", stdout="", stderr=f"No path provided. Parameters received: {list(params.keys())}. Must include 'path' key.")

    logger.info(f"File op: action={action}, raw_path={raw_path}, resolved_path={path}")

    # Guardrail check
    tier = evaluate_path_tier(action, path)
    if not check_permission("file_operation", path, tier):
        return AgentResponse(
            status="error", stdout="",
            stderr=f"[GUARDRAIL BLOCKED - TIER: {tier}] File operation blocked: '{path}'. Ask the user for permission."
        )

    try:
        if action == "create_dir":
            os.makedirs(path, exist_ok=True)
            return AgentResponse(status="success", stdout=f"Directory created: {path}")

        elif action == "write_file":
            content = params.get("content", "")
            parent = os.path.dirname(path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return AgentResponse(status="success", stdout=f"File written: {path} ({len(content)} chars)")

        elif action == "read_file":
            if not os.path.exists(path):
                return AgentResponse(status="error", stdout="", stderr=f"File not found: {path}")
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            return AgentResponse(status="success", stdout=content[:5000])

        elif action == "delete_file":
            if os.path.isfile(path):
                os.remove(path)
                return AgentResponse(status="success", stdout=f"File deleted: {path}")
            elif os.path.isdir(path):
                import shutil
                shutil.rmtree(path)
                return AgentResponse(status="success", stdout=f"Directory deleted: {path}")
            return AgentResponse(status="error", stdout="", stderr=f"Path not found: {path}")

        elif action == "list_dir":
            if not os.path.exists(path):
                return AgentResponse(status="error", stdout="", stderr=f"Directory not found: {path}")
            entries = os.listdir(path)
            return AgentResponse(status="success", stdout="\n".join(entries))

        return AgentResponse(status="error", stdout="", stderr=f"Unknown action: {action}")
    except Exception as e:
        logger.error(f"File op error: {e}")
        return AgentResponse(status="error", stdout="", stderr=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)