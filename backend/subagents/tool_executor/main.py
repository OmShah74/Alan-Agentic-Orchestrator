from fastapi import FastAPI
import uvicorn
import os
from composio import ComposioToolSet, Action
from backend.subagents.common.schemas import AgentRequest, AgentResponse
from loguru import logger

app = FastAPI()

# Requires COMPOSIO_API_KEY in environment
COMPOSIO_API_KEY = os.getenv("COMPOSIO_API_KEY")
# Entity ID for connected accounts - matches what was used in Composio dashboard
COMPOSIO_ENTITY_ID = os.getenv("COMPOSIO_ENTITY_ID", "pg-test-078eaf96-0ebd-4653-9b2d-f090171987dc")

toolset = ComposioToolSet(
    api_key=COMPOSIO_API_KEY,
    entity_id=COMPOSIO_ENTITY_ID,
)

if not COMPOSIO_API_KEY:
    logger.warning("COMPOSIO_API_KEY is not set. Composio calls will fail.")

if COMPOSIO_ENTITY_ID == "ca_zL0GA4wB6ctZ":
    logger.warning(
        "COMPOSIO_ENTITY_ID is using the built-in fallback. "
        "Set COMPOSIO_ENTITY_ID in the environment if your connections use a different entity."
    )
elif COMPOSIO_ENTITY_ID == "default":
    logger.warning(
        "COMPOSIO_ENTITY_ID is not set; using default. "
        "If your connections are under a different entity, tools will report no connected account."
    )

# Map of known action name patterns to handle fuzzy matching
KNOWN_ACTIONS = {
    # Gmail
    "GMAIL_SEND_EMAIL", "GMAIL_FETCH_EMAILS", "GMAIL_GET_EMAIL",
    "GMAIL_CREATE_EMAIL_DRAFT", "GMAIL_LIST_LABELS",
    # GitHub
    "GITHUB_CREATE_AN_ISSUE", "GITHUB_LIST_REPOS", "GITHUB_GET_A_REPOSITORY",
    "GITHUB_SEARCH_REPOSITORIES", "GITHUB_CREATE_A_REPOSITORY",
    "GITHUB_LIST_REPOSITORY_ISSUES", "GITHUB_CREATE_A_PULL_REQUEST",
    "GITHUB_GET_REPOSITORY_README",
    # Google Sheets
    "GOOGLESHEETS_CREATE_GOOGLE_SHEET", "GOOGLESHEETS_BATCH_UPDATE",
    "GOOGLESHEETS_GET_SPREADSHEET_DATA", "GOOGLESHEETS_SHEET_FROM_JSON",
    # Discord
    "DISCORD_SEND_MESSAGE", "DISCORD_LIST_GUILDS",
    "DISCORD_FETCH_GUILD_CHANNELS", "DISCORD_LIST_GUILD_MEMBERS",
    # Canva
    "CANVA_CREATE_DESIGN",
}

def _resolve_action(action_name: str):
    """Resolve action string to Composio Action enum with fuzzy matching."""
    name = action_name.strip().upper().replace(" ", "_").replace("-", "_")
    
    # Try exact match on Action enum first
    try:
        return getattr(Action, name)
    except AttributeError:
        pass
    
    # Try known aliases / common mistakes
    aliases = {
        "SEND_EMAIL": "GMAIL_SEND_EMAIL",
        "GMAIL_SEND": "GMAIL_SEND_EMAIL",
        "GITHUB_CREATE_ISSUE": "GITHUB_CREATE_AN_ISSUE",
        "GITHUB_SEARCH_REPOS": "GITHUB_SEARCH_REPOSITORIES",
        "GITHUB_CREATE_REPO": "GITHUB_CREATE_A_REPOSITORY",
        "GITHUB_GET_REPO": "GITHUB_GET_A_REPOSITORY",
        "GITHUB_GET_README": "GITHUB_GET_REPOSITORY_README",
        "GITHUB_READ_README": "GITHUB_GET_REPOSITORY_README",
        "GOOGLESHEETS_CREATE_SPREADSHEET": "GOOGLESHEETS_CREATE_GOOGLE_SHEET",
        "GOOGLE_SHEETS_CREATE": "GOOGLESHEETS_CREATE_GOOGLE_SHEET",
        "SHEETS_CREATE": "GOOGLESHEETS_CREATE_GOOGLE_SHEET",
        "CREATE_SPREADSHEET": "GOOGLESHEETS_CREATE_GOOGLE_SHEET",
        "GITHUB_CREATE_SPREADSHEET": "GOOGLESHEETS_CREATE_GOOGLE_SHEET",
        "DISCORD_SEND": "DISCORD_SEND_MESSAGE",
    }
    
    if name in aliases:
        resolved = aliases[name]
        logger.info(f"Resolved alias '{name}' -> '{resolved}'")
        try:
            return getattr(Action, resolved)
        except AttributeError:
            return resolved
    
    # Fuzzy: find closest match from known actions
    for known in KNOWN_ACTIONS:
        if name in known or known in name:
            logger.info(f"Fuzzy matched '{name}' -> '{known}'")
            try:
                return getattr(Action, known)
            except AttributeError:
                return known
    
    # Last resort: return the name as string (Composio may accept it)
    logger.warning(f"No match found for action '{name}', using as-is")
    return name


def _summarize_entity_connections(entity) -> str:
    try:
        connections = None
        if hasattr(entity, "connections"):
            connections = entity.connections
        elif hasattr(entity, "get_connections"):
            connections = entity.get_connections()

        if connections is None:
            return "Connected apps: <unknown>"

        if not connections:
            return "Connected apps: none"

        app_names = set()
        for conn in connections:
            if isinstance(conn, dict):
                for key in ("app", "app_name", "app_slug"):
                    val = conn.get(key)
                    if val:
                        app_names.add(str(val))
                        break
            else:
                for attr in ("app", "app_name", "app_slug"):
                    if hasattr(conn, attr):
                        val = getattr(conn, attr)
                        if val:
                            app_names.add(str(val))
                            break

        if app_names:
            return "Connected apps: " + ", ".join(sorted(app_names))

        return f"Connected apps: {len(connections)} (apps not exposed)"
    except Exception as e:
        return f"Connected apps: <error reading connections: {e}>"


def _get_connected_account(app_name: str):
    """Try to find a connected account for the given app."""
    entity = None
    try:
        entity = toolset.client.get_entity(id=COMPOSIO_ENTITY_ID)
        connection = entity.get_connection(app=app_name)
        return connection
    except Exception as e:
        summary = ""
        if entity is not None:
            summary = _summarize_entity_connections(entity)
        logger.warning(
            f"Could not find connection for {app_name} on entity '{COMPOSIO_ENTITY_ID}'. "
            f"{summary} Error: {e}"
        )
        return None


# Map action prefixes to app names for connection lookup
ACTION_TO_APP = {
    "GMAIL_": "gmail",
    "GITHUB_": "github",
    "GOOGLESHEETS_": "googlesheets",
    "DISCORD_": "discord",
    "CANVA_": "canva",
}


@app.post("/execute", response_model=AgentResponse)
async def execute_tool(req: AgentRequest):
    """
    Execute a Composio tool action.
    Accepts both:
      - action="execute_tool" with parameters.action_name + parameters.params (legacy)
      - action="GMAIL_SEND_EMAIL" with parameters as direct tool params (new)
    """
    try:
        if not COMPOSIO_API_KEY:
            return AgentResponse(
                status="error",
                stdout="",
                stderr="COMPOSIO_API_KEY is not set in the environment for tool_executor."
            )

        # Determine the actual action and params
        if req.action == "execute_tool":
            action_name = req.parameters.get("action_name", "")
            params = req.parameters.get("params", {})
        else:
            action_name = req.action
            params = req.parameters
        
        if not action_name:
            return AgentResponse(
                status="error", stdout="", 
                stderr="No action_name provided. Use action='GMAIL_SEND_EMAIL' with direct params."
            )
        
        logger.info(f"Tool executor: action='{action_name}', params={list(params.keys())}")
        
        # Resolve the action
        action_enum = _resolve_action(action_name)
        action_str = action_name.strip().upper()
        
        # Find which app this action belongs to and get connection
        connected_account = None
        for prefix, app_name in ACTION_TO_APP.items():
            if action_str.startswith(prefix) or (isinstance(action_enum, str) and action_enum.startswith(prefix)):
                connected_account = _get_connected_account(app_name)
                if connected_account:
                    logger.info(f"Using connected account for {app_name}: {connected_account.id}")
                break
        
        # Execute with entity_id and optionally connected_account_id
        execute_kwargs = {
            "action": action_enum,
            "params": params,
            "entity_id": COMPOSIO_ENTITY_ID,
        }
        if connected_account:
            execute_kwargs["connected_account_id"] = connected_account.id
        
        result = toolset.execute_action(**execute_kwargs)
        
        # Format output
        output = str(result)
        if isinstance(result, dict):
            if result.get("successfull") or result.get("successful"):
                data = result.get("data", result)
                output = str(data)
            elif result.get("error"):
                return AgentResponse(
                    status="error", stdout="",
                    stderr=f"Composio error: {result.get('error')}"
                )
        
        logger.info(f"Tool executor success: {output[:200]}")
        return AgentResponse(status="success", stdout=output, stderr="")
        
    except Exception as e:
        error_msg = str(e)
        
        # Provide actionable error messages
        if "No connected account found" in error_msg:
            # Extract the app name from the error
            error_msg = (
                f"Connection error: {error_msg}. "
                f"Current COMPOSIO_ENTITY_ID='{COMPOSIO_ENTITY_ID}'. "
                "Verify the account is connected under this entity in the Composio dashboard "
                "and restart the services after updating env vars. "
                "Do NOT try to run 'composio add' commands - they won't work in this environment."
            )
        elif "Could not find connection" in error_msg:
            error_msg = (
                f"Connection lookup failed: {error_msg}. "
                "Please verify the tool is connected in the Composio dashboard."
            )
        
        logger.error(f"Tool executor error: {error_msg}")
        return AgentResponse(status="error", stdout="", stderr=error_msg)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8004)
