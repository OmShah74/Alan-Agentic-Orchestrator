import subprocess
from fastapi import FastAPI, HTTPException
import os
from backend.subagents.common.schemas import AgentRequest, AgentResponse
import uvicorn

app = FastAPI()
WORKSPACE_DIR = os.getenv("WORKSPACE_DIR", "/workspace")

from backend.subagents.common.guardrails import evaluate_command_tier, check_permission

@app.post("/execute", response_model=AgentResponse)
async def execute_command(req: AgentRequest):
    if req.action != "run_command":
        return AgentResponse(status="error", stdout="", stderr="Unsupported action")
    
    cmd = req.parameters.get("command")
    working_dir = req.parameters.get("working_dir", WORKSPACE_DIR)

    # SECURE INTERCEPT
    tier = evaluate_command_tier(cmd)
    if not check_permission("command_execution", cmd, tier):
        return AgentResponse(
            status="error",
            stdout="",
            stderr=f"[GUARDRAIL BLOCKED - TIER: {tier}] You are attempting to run a potentially unsafe command: '{cmd}'. You MUST ask the human USER for explicit permission and provide this exact command snapshot before retrying."
        )

    try:
        # Secure subprocess execution
        process = subprocess.Popen(
            cmd,
            shell=True,
            cwd=working_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # 60 second timeout guardrail
        stdout, stderr = process.communicate(timeout=60)
        
        status = "success" if process.returncode == 0 else "error"
        
        # Truncate logs if they are huge to save LLM context window
        return AgentResponse(
            status=status,
            stdout=stdout[-2000:] if len(stdout) > 2000 else stdout,
            stderr=stderr[-2000:] if len(stderr) > 2000 else stderr
        )
    except subprocess.TimeoutExpired:
        process.kill()
        return AgentResponse(status="error", stdout="", stderr="Command timed out after 60 seconds.")
    except Exception as e:
        return AgentResponse(status="error", stdout="", stderr=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)