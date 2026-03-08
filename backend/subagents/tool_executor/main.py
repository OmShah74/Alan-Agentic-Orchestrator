from fastapi import FastAPI
import uvicorn
import os
from composio import ComposioToolSet, Action, App
from backend.subagents.common.schemas import AgentRequest, AgentResponse

app = FastAPI()

# Requires COMPOSIO_API_KEY in environment
toolset = ComposioToolSet(api_key=os.getenv("COMPOSIO_API_KEY"))

@app.post("/execute", response_model=AgentResponse)
async def execute_tool(req: AgentRequest):
    if req.action != "execute_tool":
        return AgentResponse(status="error", stdout="", stderr="Unsupported action")
    
    app_name = req.parameters.get("app_name")
    action_name = req.parameters.get("action_name")
    params = req.parameters.get("params", {})
    
    try:
        # Dynamically fetch the Composio Action enum, fallback to string
        try:
            action_enum = getattr(Action, action_name.upper())
        except AttributeError:
            action_enum = action_name.upper()
        
        # Execute the tool call
        result = toolset.execute_action(
            action=action_enum,
            params=params
        )
        
        return AgentResponse(
            status="success", 
            stdout=str(result), 
            stderr=""
        )
    except Exception as e:
        return AgentResponse(status="error", stdout="", stderr=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8004)