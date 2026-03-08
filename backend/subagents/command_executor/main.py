import subprocess
from fastapi import FastAPI
import os
from backend.subagents.common.schemas import AgentRequest, AgentResponse
import uvicorn
from loguru import logger

app = FastAPI()
WORKSPACE_DIR = os.getenv("WORKSPACE_DIR", "/workspace")

from backend.subagents.common.guardrails import evaluate_command_tier, check_permission


def _translate_win_path(cmd: str) -> str:
    """Translate Windows paths in commands to Docker-mounted /host_c/ paths."""
    import re
    # Match C:\path or C:/path patterns
    def replace_path(m):
        drive = m.group(1).lower()
        rest = m.group(2).replace("\\", "/")
        return f"/host_{drive}/{rest}"
    
    cmd = re.sub(r'([A-Za-z]):\\([^\s"\']+)', replace_path, cmd)
    cmd = re.sub(r'([A-Za-z]):/([^\s"\']+)', replace_path, cmd)
    return cmd


@app.post("/execute", response_model=AgentResponse)
async def execute_command(req: AgentRequest):
    if req.action != "run_command":
        return AgentResponse(status="error", stdout="", stderr=f"Unsupported action: {req.action}. Use 'run_command'.")

    raw_cmd = req.parameters.get("command", "")
    working_dir = req.parameters.get("working_dir", WORKSPACE_DIR)
    
    # Translate Windows paths
    cmd = _translate_win_path(raw_cmd)
    working_dir = _translate_win_path(working_dir)
    
    if not os.path.exists(working_dir):
        working_dir = WORKSPACE_DIR

    logger.info(f"Command: raw='{raw_cmd}' translated='{cmd}' cwd='{working_dir}'")

    tier = evaluate_command_tier(cmd)
    if not check_permission("command_execution", cmd, tier):
        return AgentResponse(
            status="error", stdout="",
            stderr=f"[GUARDRAIL BLOCKED - TIER: {tier}] Command blocked: '{cmd}'. Ask the user for permission."
        )

    try:
        process = subprocess.Popen(
            cmd, shell=True, cwd=working_dir,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        stdout, stderr = process.communicate(timeout=60)
        status = "success" if process.returncode == 0 else "error"
        return AgentResponse(
            status=status,
            stdout=stdout[-2000:] if len(stdout) > 2000 else stdout,
            stderr=stderr[-2000:] if len(stderr) > 2000 else stderr
        )
    except subprocess.TimeoutExpired:
        process.kill()
        return AgentResponse(status="error", stdout="", stderr="Command timed out (60s).")
    except Exception as e:
        return AgentResponse(status="error", stdout="", stderr=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)