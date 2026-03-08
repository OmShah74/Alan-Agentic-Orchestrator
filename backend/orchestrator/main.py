from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.orchestrator.alan_agent import AlanOrchestrator
from backend.database.connection import init_db, SessionLocal
from backend.database.models import Conversation, Message, Task, Step
from pydantic import BaseModel
from typing import Optional
from loguru import logger
import uvicorn
import json

app = FastAPI(title="Alan Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
alan = AlanOrchestrator()


# ─── Models ──────────────────────────────────────────────────────
class TaskRequest(BaseModel):
    prompt: str
    conversation_id: Optional[str] = None

class CancelRequest(BaseModel):
    conversation_id: str


# ─── Conversations ───────────────────────────────────────────────
@app.get("/api/v1/conversations")
async def list_conversations():
    db = SessionLocal()
    try:
        convos = db.query(Conversation).order_by(Conversation.updated_at.desc()).all()
        return [
            {"id": c.id, "title": c.title, "created_at": str(c.created_at), "updated_at": str(c.updated_at)}
            for c in convos
        ]
    finally:
        db.close()

@app.post("/api/v1/conversations")
async def create_conversation():
    db = SessionLocal()
    try:
        convo = Conversation()
        db.add(convo)
        db.commit()
        db.refresh(convo)
        return {"id": convo.id, "title": convo.title}
    finally:
        db.close()

@app.get("/api/v1/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str):
    db = SessionLocal()
    try:
        msgs = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at).all()
        return [
            {"id": m.id, "role": m.role, "content": m.content, "metadata": m.metadata_, "created_at": str(m.created_at)}
            for m in msgs
        ]
    finally:
        db.close()

@app.delete("/api/v1/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    db = SessionLocal()
    try:
        db.query(Message).filter(Message.conversation_id == conversation_id).delete()
        db.query(Step).filter(Step.task_id.in_(
            db.query(Task.id).filter(Task.conversation_id == conversation_id)
        )).delete(synchronize_session=False)
        db.query(Task).filter(Task.conversation_id == conversation_id).delete()
        db.query(Conversation).filter(Conversation.id == conversation_id).delete()
        db.commit()
        return {"status": "deleted"}
    finally:
        db.close()


# ─── Cancel ──────────────────────────────────────────────────────
@app.post("/api/v1/cancel")
async def cancel_task(req: CancelRequest):
    alan.request_cancel(req.conversation_id)
    return {"status": "cancel_requested"}


# ─── Task (REST fallback) ───────────────────────────────────────
@app.post("/api/v1/task")
async def create_task(req: TaskRequest):
    try:
        result = await alan.execute_task(req.prompt, conversation_id=req.conversation_id)
        return result
    except Exception as e:
        logger.error(f"Task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Steps ───────────────────────────────────────────────────────
@app.get("/api/v1/tasks/{task_id}/steps")
async def get_task_steps(task_id: str):
    db = SessionLocal()
    try:
        steps = db.query(Step).filter(Step.task_id == task_id).order_by(Step.step_number).all()
        return [
            {
                "id": s.id, "agent": s.agent_assigned,
                "payload_sent": s.payload_sent, "payload_received": s.payload_received,
                "status": s.status, "step_number": s.step_number,
                "created_at": str(s.created_at)
            }
            for s in steps
        ]
    finally:
        db.close()


# ─── WebSocket Chat ──────────────────────────────────────────────
@app.websocket("/ws/chat/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str):
    await websocket.accept()
    db = SessionLocal()

    try:
        convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not convo:
            convo = Conversation(id=conversation_id)
            db.add(convo)
            db.commit()

        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # Handle cancel messages
            if payload.get("type") == "cancel":
                alan.request_cancel(conversation_id)
                await websocket.send_json({"type": "cancelled", "content": "Execution cancelled."})
                continue

            user_message = payload.get("message", "")
            if not user_message:
                continue

            # Store user message
            user_msg = Message(conversation_id=conversation_id, role="user", content=user_message)
            db.add(user_msg)
            db.commit()

            await websocket.send_json({"type": "ack", "message_id": user_msg.id})

            # Title from first message
            msg_count = db.query(Message).filter(Message.conversation_id == conversation_id).count()
            if msg_count <= 1:
                convo.title = user_message[:50] + ("..." if len(user_message) > 50 else "")
                db.commit()

            try:
                await websocket.send_json({"type": "status", "status": "thinking", "agent": "alan"})
                
                result = await alan.execute_task(
                    user_message, conversation_id=conversation_id, websocket=websocket
                )

                final_content = result.get("result", result.get("message", "Task completed."))
                status = result.get("status", "success")

                assistant_msg = Message(
                    conversation_id=conversation_id, role="assistant",
                    content=final_content, metadata_={"task_status": status}
                )
                db.add(assistant_msg)
                db.commit()

                try:
                    await websocket.send_json({
                        "type": "final", "content": final_content,
                        "message_id": assistant_msg.id, "status": status
                    })
                except Exception:
                    pass

            except Exception as e:
                logger.error(f"WebSocket task error: {e}")
                err_content = f"Error: {str(e)}"
                err_msg = Message(conversation_id=conversation_id, role="assistant", content=err_content)
                db.add(err_msg)
                db.commit()
                try:
                    await websocket.send_json({"type": "error", "content": err_content})
                except Exception:
                    pass

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {conversation_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        db.close()


# ─── Health ──────────────────────────────────────────────────────
@app.get("/api/v1/health")
async def health():
    return {"status": "healthy", "service": "alan_orchestrator"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)