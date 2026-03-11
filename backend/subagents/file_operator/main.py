from fastapi import FastAPI
import os
from backend.subagents.common.schemas import AgentRequest, AgentResponse
import uvicorn
from loguru import logger
import shutil
import difflib

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
                shutil.rmtree(path)
                return AgentResponse(status="success", stdout=f"Directory deleted: {path}")
            return AgentResponse(status="error", stdout="", stderr=f"Path not found: {path}")

        elif action == "move_file":
            dest_raw = params.get("destination") or params.get("dest") or ""
            dest = _resolve_path(dest_raw)
            if not os.path.exists(path):
                return AgentResponse(status="error", stdout="", stderr=f"Source path not found: {path}")
            if not dest:
                return AgentResponse(status="error", stdout="", stderr=f"Destination path not provided.")
            
            # If destination is a directory, move inside it
            if os.path.isdir(dest):
                dest = os.path.join(dest, os.path.basename(path))
            
            # Guardrail check for destination
            dest_tier = evaluate_path_tier(action, dest)
            if not check_permission("file_operation", dest, dest_tier):
                return AgentResponse(status="error", stdout="", stderr=f"[GUARDRAIL BLOCKED] Destination blocked: '{dest}'")

            shutil.move(path, dest)
            return AgentResponse(status="success", stdout=f"Moved '{path}' to '{dest}'")

        elif action == "find_file":
            # list dir + fuzzy match
            if not os.path.exists(path) or not os.path.isdir(path):
                return AgentResponse(status="error", stdout="", stderr=f"Search directory not found: {path}")
            
            query = params.get("query", "").lower()
            if not query:
                return AgentResponse(status="error", stdout="", stderr="No query provided for finding.")
            
            entries = os.listdir(path)
            # Find closest matches using difflib
            matches = difflib.get_close_matches(query, [e.lower() for e in entries], n=5, cutoff=0.3)
            
            # Map lower back to original case and create full paths
            result_matches = []
            for match in matches:
                for original in entries:
                    if original.lower() == match.lower():
                        result_matches.append(os.path.join(path, original))
                        break
            
            # Also do a simple token-based substring search as fallback
            query_tokens = query.split()
            for entry in entries:
                full_path = os.path.join(path, entry)
                entry_lower = entry.lower()
                
                # if ALL tokens are in the filename
                if all(token in entry_lower for token in query_tokens):
                    if full_path not in result_matches:
                        result_matches.append(full_path)
            
            if result_matches:
                return AgentResponse(status="success", stdout="Found potential matches (Full Paths):\n" + "\n".join(result_matches[:10]))
            else:
                return AgentResponse(status="success", stdout="No files matched the query in this directory.")

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