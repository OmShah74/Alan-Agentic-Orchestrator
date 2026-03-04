import os
import json
import httpx
import re
from loguru import logger
from database.connection import SessionLocal, Task, Step
from core_router.router import LLMRouter # Your pasted router
from core_router.models import LLMConfig, LLMProvider
from orchestrator.prompts import ORCHESTRATOR_SYSTEM_PROMPT

class AlanOrchestrator:
    def __init__(self):
        # Initialize Router with Dummy/Real config
        config = LLMConfig(preferred_provider=LLMProvider.ANTHROPIC)
        self.router = LLMRouter(config=config)
        self.router.add_api_key(LLMProvider.ANTHROPIC, "main", os.getenv("ANTHROPIC_API_KEY", ""))
        
        # Mapping of agent names to their internal docker network URLs
        self.agent_urls = {
            "command_executor": "http://command_executor:8001/execute",
            "file_operator": "http://file_operator:8002/execute",
            # Add other agents...
        }

    def _load_agent_contexts(self) -> str:
        """Dynamically loads context.md from all subagents"""
        contexts = ""
        base_path = os.path.join(os.getcwd(), "backend", "subagents")
        if not os.path.exists(base_path): return "No agents found."
        
        for agent_dir in os.listdir(base_path):
            if agent_dir == "common": continue
            context_path = os.path.join(base_path, agent_dir, "context.md")
            if os.path.exists(context_path):
                with open(context_path, "r") as f:
                    contexts += f"\n--- {agent_dir.upper()} ---\n{f.read()}\n"
        return contexts

    def _parse_markdown_response(self, response: str) -> dict:
        """Extracts the agent name and JSON payload from Alan's Markdown"""
        try:
            delegation_match = re.search(r"## Delegation\s*\n(.+)", response)
            payload_match = re.search(r"## Payload\s*\n```json\n(.*?)\n```", response, re.DOTALL)
            
            agent = delegation_match.group(1).strip() if delegation_match else "USER"
            payload_str = payload_match.group(1).strip() if payload_match else "{}"
            
            return {
                "agent": agent,
                "payload": json.loads(payload_str)
            }
        except Exception as e:
            logger.error(f"Failed to parse Alan's response: {e}")
            return {"agent": "ERROR", "payload": {}}

    async def execute_task(self, prompt: str):
        db = SessionLocal()
        task = Task(original_prompt=prompt)
        db.add(task)
        db.commit()

        agent_contexts = self._load_agent_contexts()
        system_prompt = ORCHESTRATOR_SYSTEM_PROMPT.format(agent_contexts=agent_contexts)
        
        conversation_history = [{"role": "user", "content": prompt}]

        # RECURSIVE DEP LOOP
        for loop_iteration in range(20): # Hard cap to prevent infinite loops
            logger.info(f"Alan Planning Iteration {loop_iteration+1}")
            
            llm_response = self.router.complete(
                messages=conversation_history,
                system_prompt=system_prompt
            )
            
            conversation_history.append({"role": "assistant", "content": llm_response})
            parsed = self._parse_markdown_response(llm_response)
            
            target_agent = parsed["agent"]
            payload = parsed["payload"]

            if target_agent == "USER" or target_agent == "DONE":
                task.status = "completed"
                task.final_output = llm_response
                db.commit()
                return {"status": "success", "result": llm_response}

            if target_agent not in self.agent_urls:
                conversation_history.append({"role": "user", "content": f"Error: Subagent {target_agent} does not exist."})
                continue

            # Log Step
            step = Step(task_id=task.id, agent_assigned=target_agent, payload_sent=payload)
            db.add(step)
            db.commit()

            # Dispatch to Subagent
            async with httpx.AsyncClient(timeout=120.0) as client:
                try:
                    res = await client.post(
                        self.agent_urls[target_agent],
                        json={"task_id": task.id, "action": payload.get("action", ""), "parameters": payload.get("parameters", {})}
                    )
                    agent_result = res.json()
                    step.status = agent_result.get("status", "failed")
                    step.payload_received = agent_result
                except Exception as e:
                    agent_result = {"status": "error", "stdout": "", "stderr": str(e)}
                    step.status = "error"
                    step.payload_received = agent_result
            
            db.commit()

            # Append agent evaluation to context
            eval_str = f"## Evaluation\nAgent {target_agent} returned:\nStatus: {agent_result['status']}\nSTDOUT: {agent_result['stdout']}\nSTDERR: {agent_result['stderr']}\n\nAnalyze this and determine the next Active Node."
            conversation_history.append({"role": "user", "content": eval_str})

        return {"status": "timeout", "message": "Max recursive steps reached."}
