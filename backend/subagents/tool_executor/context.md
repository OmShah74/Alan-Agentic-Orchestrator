Name: tool_executor
Description: Interfaces with 30+ external APIs (GitHub, Slack, Gmail, Notion, etc.) using Composio.
Capabilities: Creating repos, sending emails, messaging on Slack, querying databases.
Input Schema:
{
  "action": "execute_tool",
  "parameters": {
    "app_name": "GITHUB",
    "action_name": "GITHUB_CREATE_ISSUE",
    "params": {
      "owner": "user",
      "repo": "my_repo",
      "title": "Bug fix"
    }
  }
}