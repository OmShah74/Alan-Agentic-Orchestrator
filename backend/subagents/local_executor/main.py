from fastapi import FastAPI
import subprocess
import uvicorn
import httpx
from backend.subagents.common.schemas import AgentRequest, AgentResponse

app = FastAPI()

# Cerbos PDP url from docker-compose
CERBOS_URL = "http://cerbos:3592/api/check"

from backend.subagents.common.guardrails import evaluate_command_tier, check_permission

@app.post("/execute", response_model=AgentResponse)
async def execute_local(req: AgentRequest):
    cmd = req.parameters.get("command", "")
    
    # 1. New Guardrails Check replacing Cerbos
    tier = evaluate_command_tier(cmd)
    if not check_permission("local_execution", cmd, tier):
        return AgentResponse(
            status="error",
            stdout="",
            stderr=f"[GUARDRAIL BLOCKED - TIER: {tier}] You are attempting to execute a potentially unsafe system command on the Local Machine: '{cmd}'. You MUST ask the human USER for explicit permission through the chat and provide this exact command snapshot before retrying."
        )

    # 2. Execution (If Allowed)
    try:
        process = subprocess.Popen(
            cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        stdout, stderr = process.communicate(timeout=60)
        status = "success" if process.returncode == 0 else "error"
        return AgentResponse(status=status, stdout=stdout, stderr=stderr)
    except Exception as e:
        return AgentResponse(status="error", stdout="", stderr=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8005)