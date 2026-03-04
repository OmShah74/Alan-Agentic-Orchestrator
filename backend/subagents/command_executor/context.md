Name: command_executor
Description: Executes terminal, shell, or PowerShell commands on the system. Uses strict timeouts.
Capabilities: Installing dependencies (npm, pip), building projects, checking network ports, starting servers.
Input Schema:
{
  "action": "run_command",
  "parameters": {
    "command": "npm install react",
    "working_dir": "/workspace/my_app" (Optional)
  }
}