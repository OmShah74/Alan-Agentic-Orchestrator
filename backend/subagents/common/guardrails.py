import re
from loguru import logger

# Define the 4 Tiers of Execution
TIER_1_SAFE = "tier1"     # Read-only operations, status checks (Auto-approved)
TIER_2_LOW = "tier2"      # File creation in isolated workspaces (Auto-approved)
TIER_3_HIGH = "tier3"     # Modifying local files outside workspace, network (Requires Approval)
TIER_4_CRIT = "tier4"     # System commands (rm, format, chmod), binaries (Requires Strict Approval)

def evaluate_command_tier(command: str) -> str:
    """Evaluate a raw shell command to determine its risk tier."""
    cmd_lower = command.lower().strip()
    
    # Tier 4: Critical Destruction or System modification
    critical_patterns = [r"\brm\s+-rf\b", r"\bformat\b", r"\bmkfs\b", r"\bchmod\s+-R\b", r"\bchown\b", r"\bdel\s+/f\b"]
    for pattern in critical_patterns:
        if re.search(pattern, cmd_lower):
            return TIER_4_CRIT
            
    # Tier 3: Network requests or potentially mutating system state commands
    high_risk_cmds = ["curl", "wget", "npm install", "pip install", "apt-get", "apk add", "docker", "git push", "mv ", "cp ", "del "]
    for h_cmd in high_risk_cmds:
        if h_cmd in cmd_lower:
            return TIER_3_HIGH
            
    # Tier 1/2: Safe Read commands
    safe_cmds = ["ls", "dir", "echo", "cat", "pwd", "whoami", "python -c", "node -e"]
    for s_cmd in safe_cmds:
        if cmd_lower.startswith(s_cmd):
            return TIER_1_SAFE

    # Default to Tier 3 if unknown to be safe
    return TIER_3_HIGH

def evaluate_path_tier(action: str, file_path: str) -> str:
    """Evaluate a file operation based on the action and the path affected."""
    # Action determines base risk
    if action == "read_file":
        return TIER_1_SAFE
        
    if action in ["write_file", "create_dir", "delete_file"]:
        # If it's modifying the host C drive directly, it's Tier 3/4
        if "/host_c" in file_path or "C:\\" in file_path:
            return TIER_3_HIGH
        # Modifying internal docker workspace is Tier 2
        return TIER_2_LOW
        
    return TIER_3_HIGH

def check_permission(action_type: str, payload: str, tier: str) -> bool:
    """
    Check if the action is allowed. 
    In this headless orchestrator, returning False means the subagent will 
    return an error requiring the LLM to ask the USER for permission.
    """
    logger.info(f"Guardrail Check | Type: {action_type} | Tier: {tier} | Payload: {payload[:50]}")
    
    if tier in [TIER_1_SAFE, TIER_2_LOW]:
        return True # Allowed automatically
        
    if tier in [TIER_3_HIGH, TIER_4_CRIT]:
        return False # Blocked, requires explicit HITL approval from the LLM chat
        
    return False
