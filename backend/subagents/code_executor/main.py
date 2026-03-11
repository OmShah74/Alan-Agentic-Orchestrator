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

    if "code" in req.parameters and req.parameters["code"]:
        # Secure ephemeral execution of string code
        code_body = req.parameters["code"]
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False, mode='w', encoding='utf-8') as temp_file:
            temp_file.write(code_body)
            temp_file_path = temp_file.name
        execute_path = temp_file_path
        cleanup = True
    elif "file" in req.parameters or "path" in req.parameters:
        raw_path = req.parameters.get("file") or req.parameters.get("path")
        # Reuse existing logic if they passed a file
        import re
        def replace_path(m): return f"/host_{m.group(1).lower()}/{m.group(2).replace(chr(92), '/')}"
        
        proc_path = re.sub(r'([A-Za-z]):[\\/]([^\s"\']+)', replace_path, raw_path)
        
        if " " in proc_path and not proc_path.startswith('"'):
            # Docker paths from windows mounts won't have quotes intrinsically if taken raw
            # wait, Popen array args don't need quotes manually
            pass 
        execute_path = proc_path
        cleanup = False
    else:
        return AgentResponse(status="error", stdout="", stderr="No 'code' or 'file' parameters provided.")

    try:
        process = subprocess.Popen(
            [cmd, execute_path],
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
        if cleanup and os.path.exists(execute_path):
            os.remove(execute_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)