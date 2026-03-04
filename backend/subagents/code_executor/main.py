from fastapi import FastAPI
import subprocess
import tempfile
import os
import uvicorn
from backend.subagents.common.schemas import AgentRequest, AgentResponse

app = FastAPI()

@app.post("/execute", response_model=AgentResponse)
async def execute_code(req: AgentRequest):
    if req.action != "execute_code":
        return AgentResponse(status="error", stdout="", stderr="Unsupported action")
    
    language = req.parameters.get("language", "python").lower()
    code = req.parameters.get("code", "")
    
    # Map languages to execution commands and extensions
    runners = {
        "python": {"cmd": "python", "ext": ".py"},
        "javascript": {"cmd": "node", "ext": ".js"},
        "js": {"cmd": "node", "ext": ".js"}
    }
    
    if language not in runners:
        return AgentResponse(status="error", stdout="", stderr=f"Unsupported language: {language}")
        
    ext = runners[language]["ext"]
    cmd = runners[language]["cmd"]

    # Secure ephemeral execution
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False, mode='w', encoding='utf-8') as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name

    try:
        process = subprocess.Popen(
            [cmd, temp_file_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(timeout=30)
        status = "success" if process.returncode == 0 else "error"
        
        return AgentResponse(status=status, stdout=stdout, stderr=stderr)
    except subprocess.TimeoutExpired:
        process.kill()
        return AgentResponse(status="error", stdout="", stderr="Execution timed out after 30 seconds.")
    finally:
        os.remove(temp_file_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)