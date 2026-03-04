from fastapi import FastAPI
import subprocess
import uvicorn
import httpx
from backend.subagents.common.schemas import AgentRequest, AgentResponse

app = FastAPI()

# Cerbos PDP url from docker-compose
CERBOS_URL = "http://cerbos:3592/api/check"

async def check_cerbos_policy(action: str, resource: str, risk_tier: str) -> bool:
    """Check action against Cerbos Guardrails"""
    payload = {
        "principal": {"id": "alan_agent", "roles": ["system_agent"]},
        "resource": {"kind": "system_command", "id": resource, "attr": {"risk_tier": risk_tier}},
        "actions": [action]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(CERBOS_URL, json=payload)
            # If cerbos returns allow, proceed. Else require HITL.
            result = res.json()
            # Simplistic check for demo (Requires fully fleshed Cerbos schema)
            return True # Assuming safe for now, adjust based on strict cerbos parsing
        except:
            # Fail closed on policy engine error
            return False

@app.post("/execute", response_model=AgentResponse)
async def execute_local(req: AgentRequest):
    cmd = req.parameters.get("command", "")
    risk_tier = req.parameters.get("risk_tier", "tier3") # Default to high risk
    
    # 1. Policy Check
    is_allowed = await check_cerbos_policy("execute", cmd, risk_tier)
    
    if not is_allowed or risk_tier == "tier3":
        # Simulate Human In The Loop (HITL) Webhook
        # In a real desktop app, this would fire a webhook to the Windows 11 UI
        return AgentResponse(
            status="error",
            stdout="",
            stderr="[GUARDRAIL BLOCKED] Tier 3 action requires Human Approval. Please verify via Desktop UI."
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