import os
import json
import httpx
import re
from loguru import logger
from backend.database.connection import SessionLocal
from backend.database.models import Task, Step
from backend.core_router.router import LLMRouter # Your pasted router
from backend.core_router.models import LLMConfig, LLMProvider
from backend.orchestrator.prompts import ORCHESTRATOR_SYSTEM_PROMPT

class AlanOrchestrator:
    def __init__(self):
        # Initialize Router with configurable provider, default to ANTHROPIC
        provider_env = os.getenv("PREFERRED_PROVIDER", "ANTHROPIC").upper()
        try:
            preferred_provider = LLMProvider[provider_env]
        except KeyError:
            preferred_provider = LLMProvider.ANTHROPIC

        config = LLMConfig(preferred_provider=preferred_provider)
        self.router = LLMRouter(config=config)
        
        # Register ALL available keys from the environment to enable failover rotation
        api_keys = {
            LLMProvider.ANTHROPIC: os.getenv("ANTHROPIC_API_KEY"),
            LLMProvider.OPENAI: os.getenv("OPENAI_API_KEY"),
            LLMProvider.GROQ: os.getenv("GROQ_API_KEY"),
            LLMProvider.GEMINI: os.getenv("GEMINI_API_KEY"),
        }

        for provider, key in api_keys.items():
            if key and not any(p in key for p in ["your-openai-key", "your-anthropic-key", "your_gemini_key"]):
                self.router.add_api_key(provider, "main_env", key)
                logger.info(f"Registered {provider.name} for dynamic rotation.")
        
        # Mapping of agent names to their internal docker network URLs
        self.agent_urls = {
            "command_executor": "http://command_executor:8001/execute",
            "file_operator": "http://file_operator:8002/execute",
            "code_executor": "http://code_executor:8003/execute",
            "tool_executor": "http://tool_executor:8004/execute",
            "local_executor": "http://local_executor:8005/execute",
        }

    def _load_agent_contexts(self) -> str:
        """Dynamically loads context.md from all subagents"""
        contexts = ""
        # Get absolute directory where this file sits (backend/orchestrator/)
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        # Resolve path to backend/subagents/
        base_path = os.path.abspath(os.path.join(current_file_dir, "..", "subagents"))
        
        if not os.path.exists(base_path): 
            logger.error(f"Subagents directory not found at: {base_path}")
            return "No agents found."
        
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
