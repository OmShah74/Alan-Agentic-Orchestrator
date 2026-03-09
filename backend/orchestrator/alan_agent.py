import os
import json
import httpx
import re
import asyncio
from loguru import logger
from backend.database.connection import SessionLocal
from backend.database.models import Task, Step
from backend.core_router.router import LLMRouter
from backend.core_router.models import LLMConfig, LLMProvider
from backend.orchestrator.prompts import ORCHESTRATOR_SYSTEM_PROMPT


class AlanOrchestrator:
    def __init__(self):
        config = LLMConfig(preferred_provider=LLMProvider.GROQ)
        self.router = LLMRouter(config=config)
        # Keys are loaded from persistent JSON file by the router automatically.
        # Users manage keys via the API Keys panel in the frontend.
        key_count = sum(len(v) for v in self.router.config.instances.values())
        logger.info(f"Router initialized with {key_count} API keys from persistent storage.")

        self.agent_urls = {
            "command_executor": "http://command_executor:8001/execute",
            "file_operator": "http://file_operator:8002/execute",
            "code_executor": "http://code_executor:8003/execute",
            "tool_executor": "http://tool_executor:8004/execute",
            "local_executor": "http://local_executor:8005/execute",
        }
        
        # Track cancellation per conversation
        self._cancel_flags: dict[str, bool] = {}

    def request_cancel(self, conversation_id: str):
        """Set flag to cancel the running task for a conversation."""
        self._cancel_flags[conversation_id] = True

    def _load_agent_contexts(self) -> str:
        contexts = ""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_path = os.path.abspath(os.path.join(current_dir, "..", "subagents"))
        if not os.path.exists(base_path):
            logger.error(f"Subagents directory not found: {base_path}")
            return "No agents found."
        for agent_dir in os.listdir(base_path):
            if agent_dir == "common":
                continue
            ctx_path = os.path.join(base_path, agent_dir, "context.md")
            if os.path.exists(ctx_path):
                with open(ctx_path, "r") as f:
                    contexts += f"\n--- {agent_dir.upper()} ---\n{f.read()}\n"
        return contexts

    def _parse_markdown_response(self, response: str) -> dict:
        try:
            # Match ## Delegation with optional trailing text on same line
            delegation_match = re.search(r"## Delegation\s*\n(.+)", response)
            payload_match = re.search(r"## Payload\s*\n```json\n(.*?)\n```", response, re.DOTALL)

            agent = delegation_match.group(1).strip() if delegation_match else "USER"
            payload_str = payload_match.group(1).strip() if payload_match else "{}"

            # Clean agent name — remove brackets, extra text
            agent = re.sub(r'[\[\]`*]', '', agent).strip()
            
            return {"agent": agent, "payload": json.loads(payload_str)}
        except Exception as e:
            logger.error(f"Parse error: {e}")
            return {"agent": "ERROR", "payload": {}}

    def _extract_user_message(self, llm_response: str, steps_summary: list) -> str:
        """Extract a clean, user-facing message from the LLM's markdown planning response."""
        # Try to get the message from the Payload JSON first
        try:
            payload_match = re.search(r'## Payload\s*\n```json\n(.*?)\n```', llm_response, re.DOTALL)
            if payload_match:
                payload = json.loads(payload_match.group(1).strip())
                msg = payload.get("parameters", {}).get("message", "")
                if msg and msg.strip():
                    clean = msg.strip()
                    if steps_summary:
                        clean += "\n\n**Execution Summary:**\n" + "\n".join(steps_summary)
                    return clean
        except Exception:
            pass

        # Try to get from Current State section
        current_state = re.search(r'## Current State\s*\n(.+?)(?=\n## |$)', llm_response, re.DOTALL)
        objective = re.search(r'## Objective\s*\n(.+?)(?=\n## |$)', llm_response, re.DOTALL)
        active_node = re.search(r'## Active Node\s*\n(.+?)(?=\n## |$)', llm_response, re.DOTALL)

        parts = []
        if objective:
            parts.append(objective.group(1).strip())
        if current_state:
            state_text = current_state.group(1).strip()
            if state_text and state_text != parts[0] if parts else True:
                parts.append(state_text)
        if active_node:
            node_text = active_node.group(1).strip()
            if "no further" not in node_text.lower():
                parts.append(node_text)

        if parts:
            clean = "\n\n".join(parts)
            if steps_summary:
                clean += "\n\n**Execution Summary:**\n" + "\n".join(steps_summary)
            return clean

        # Fallback: return the whole thing but strip markdown headers
        fallback = re.sub(r'## (Objective|Current State|Active Node|Delegation|Payload).*?(?=## |$)', '', llm_response, flags=re.DOTALL).strip()
        return fallback if fallback else "Task completed."

    async def execute_task(self, prompt: str, conversation_id: str = None, websocket=None):
        db = SessionLocal()
        
        # Reset cancel flag
        cancel_key = conversation_id or "default"
        self._cancel_flags[cancel_key] = False
        
        try:
            task = Task(original_prompt=prompt, conversation_id=conversation_id)
            db.add(task)
            db.commit()
            db.refresh(task)  # Ensure task.id is loaded
            task_id = task.id  # Store locally to avoid DetachedInstanceError

            agent_contexts = self._load_agent_contexts()
            system_prompt = ORCHESTRATOR_SYSTEM_PROMPT.format(agent_contexts=agent_contexts)
            conversation_history = [{"role": "user", "content": prompt}]
            step_number = 0

            for iteration in range(20):
                # Check cancel
                if self._cancel_flags.get(cancel_key, False):
                    task.status = "cancelled"
                    db.commit()
                    return {"status": "cancelled", "result": "Task cancelled by user.", "task_id": task_id}

                logger.info(f"Alan Planning Iteration {iteration + 1}")

                if websocket:
                    try:
                        await websocket.send_json({
                            "type": "status", "status": "thinking",
                            "agent": "alan", "iteration": iteration + 1
                        })
                    except Exception:
                        pass

                llm_response = self.router.complete(
                    messages=conversation_history,
                    system_prompt=system_prompt
                )
                conversation_history.append({"role": "assistant", "content": llm_response})
                parsed = self._parse_markdown_response(llm_response)

                target_agent = parsed["agent"]
                payload = parsed["payload"]

                if target_agent in ["USER", "DONE", "user", "done"]:
                    # Build steps summary for the user
                    steps_summary = []
                    db_steps = db.query(Step).filter(Step.task_id == task_id).order_by(Step.step_number).all()
                    for s in db_steps:
                        result = s.payload_received or {}
                        status_emoji = "✅" if s.status == "success" else "❌" if s.status == "error" else "⏳"
                        stdout_preview = (result.get("stdout") or "")[:150]
                        steps_summary.append(f"{status_emoji} **{s.agent_assigned}** → {(s.payload_sent or {}).get('action', '?')}: {stdout_preview or s.status}")

                    clean_message = self._extract_user_message(llm_response, steps_summary)
                    task.status = "completed"
                    task.final_output = clean_message
                    db.commit()
                    return {"status": "success", "result": clean_message, "task_id": task_id}

                if target_agent == "ERROR":
                    conversation_history.append({"role": "user", "content": "Error parsing your response. Please follow the exact format."})
                    continue

                if target_agent not in self.agent_urls:
                    conversation_history.append({
                        "role": "user",
                        "content": f"Error: '{target_agent}' is not a valid subagent. Valid: {list(self.agent_urls.keys())}. Use 'USER' when done."
                    })
                    continue

                step_number += 1
                step = Step(
                    task_id=task_id, agent_assigned=target_agent,
                    payload_sent=payload, step_number=step_number
                )
                db.add(step)
                db.commit()
                db.refresh(step)
                step_id = step.id

                if websocket:
                    try:
                        await websocket.send_json({
                            "type": "delegation", "agent": target_agent,
                            "action": payload.get("action", ""),
                            "step_number": step_number, "step_id": step_id,
                            "payload": payload
                        })
                    except Exception:
                        pass

                # Dispatch
                async with httpx.AsyncClient(timeout=120.0) as client:
                    try:
                        res = await client.post(
                            self.agent_urls[target_agent],
                            json={
                                "task_id": task_id,
                                "action": payload.get("action", ""),
                                "parameters": payload.get("parameters", {})
                            }
                        )
                        agent_result = res.json()
                        step.status = agent_result.get("status", "failed")
                        step.payload_received = agent_result
                    except Exception as e:
                        agent_result = {"status": "error", "stdout": "", "stderr": str(e)}
                        step.status = "error"
                        step.payload_received = agent_result
                db.commit()

                stderr = agent_result.get("stderr", "")

                # Guardrail approval flow
                if "GUARDRAIL BLOCKED" in stderr:
                    task.status = "awaiting_approval"
                    db.commit()

                    if websocket:
                        try:
                            await websocket.send_json({
                                "type": "approval_required",
                                "agent": target_agent, "step_id": step_id,
                                "task_id": task_id,
                                "command": payload.get("parameters", {}).get("command", payload.get("parameters", {}).get("path", "")),
                                "message": stderr
                            })

                            approval_data = await asyncio.wait_for(
                                websocket.receive_text(), timeout=300
                            )
                            approval = json.loads(approval_data)

                            task.status = "running"
                            db.commit()

                            if approval.get("approved", False):
                                eval_str = f"## Evaluation\nThe user APPROVED the blocked action. Retry the SAME delegation to {target_agent} with the SAME payload."
                            else:
                                eval_str = f"## Evaluation\nThe user REJECTED the action. Find an alternative approach."
                            conversation_history.append({"role": "user", "content": eval_str})
                            continue
                        except Exception:
                            task.status = "running"
                            db.commit()

                # Send step result to frontend
                if websocket:
                    try:
                        await websocket.send_json({
                            "type": "step_result", "agent": target_agent,
                            "step_number": step_number,
                            "status": agent_result.get("status"),
                            "stdout": (agent_result.get("stdout") or "")[:1000],
                            "stderr": (agent_result.get("stderr") or "")[:1000]
                        })
                    except Exception:
                        pass

                eval_str = (
                    f"## Evaluation\nAgent {target_agent} returned:\n"
                    f"Status: {agent_result['status']}\n"
                    f"STDOUT: {agent_result.get('stdout', '')[:500]}\n"
                    f"STDERR: {agent_result.get('stderr', '')[:500]}\n\n"
                    f"Determine the next Active Node."
                )
                conversation_history.append({"role": "user", "content": eval_str})

            task.status = "timeout"
            db.commit()
            return {"status": "timeout", "message": "Max iterations reached.", "task_id": task_id}
        
        finally:
            db.close()
