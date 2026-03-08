from fastapi import FastAPI
import os
from backend.subagents.common.schemas import AgentRequest, AgentResponse
import uvicorn

app = FastAPI()
WORKSPACE_DIR = os.getenv("WORKSPACE_DIR", "/workspace")

from backend.subagents.common.guardrails import evaluate_path_tier, check_permission

@app.post("/execute", response_model=AgentResponse)
async def execute_file_op(req: AgentRequest):
    action = req.action
    params = req.parameters
    
    # Remove the old path restrictor. Implement Guardrail evaluation:
    tier = evaluate_path_tier(action, path)
    if not check_permission("file_operation", path, tier):
        return AgentResponse(
            status="error", 
            stdout="", 
            stderr=f"[GUARDRAIL BLOCKED - TIER: {tier}] You are attempting to modify a file outside the safe workspace: '{path}'. You MUST ask the human USER for explicit permission and provide this exact path snapshot before retrying."
        )
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