from fastapi import FastAPI, HTTPException
from backend.orchestrator.alan_agent import AlanOrchestrator
from backend.database.connection import init_db
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Alan Orchestrator API")

# Initialize database tables on startup
init_db()
alan = AlanOrchestrator()

class TaskRequest(BaseModel):
    prompt: str

@app.post("/api/v1/task")
async def create_task(req: TaskRequest):
    try:
        # Executes the recursive planning loop
        result = await alan.execute_task(req.prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)