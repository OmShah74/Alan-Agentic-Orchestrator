Name: local_executor
Description: Accesses local desktop systems. Governed by Tiered Guardrails (Cerbos).
Capabilities: Running local native apps, modifying system config, high-risk host operations.
Input Schema:
{
  "action": "local_command",
  "parameters": {
    "command": "npm install -g something",
    "risk_tier": "tier3"
  }
}