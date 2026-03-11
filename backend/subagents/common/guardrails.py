import re
from loguru import logger

TIER_1_SAFE = "tier1"     # Read-only, status checks (Auto-approved)
TIER_2_LOW = "tier2"      # File creation in workspaces (Auto-approved)
TIER_3_HIGH = "tier3"     # Modifying files outside workspace, network ops (Requires Approval)
TIER_4_CRIT = "tier4"     # Destructive system commands (Requires Strict Approval)


def evaluate_command_tier(command: str) -> str:
    """Evaluate a raw shell command to determine its risk tier."""
    cmd_lower = command.lower().strip()

    # Tier 4: Critical destructive
    critical = [r"\brm\s+-rf\b", r"\bformat\b", r"\bmkfs\b", r"\bchmod\s+-R\b", r"\bchown\b", r"\bdel\s+/f\b", r"\bdd\s+if="]
    for pat in critical:
        if re.search(pat, cmd_lower):
            return TIER_4_CRIT

    # Tier 1: Safe read commands
    safe_starts = ["ls", "dir", "echo", "cat", "pwd", "whoami", "python -c", "python", "node -e",
                   "head", "tail", "wc", "find", "which", "type", "stat", "file"]
    for s in safe_starts:
        if cmd_lower.startswith(s):
            return TIER_1_SAFE

    # Tier 2: Safe write commands (mkdir, touch, cp within workspace)
    safe_write = ["mkdir", "touch"]
    for s in safe_write:
        if cmd_lower.startswith(s):
            return TIER_2_LOW

    # Tier 3: Everything else
    return TIER_3_HIGH


def evaluate_path_tier(action: str, file_path: str) -> str:
    """Evaluate a file operation. More permissive for /host_c/ paths (user explicitly mounted)."""
    if action == "read_file" or action == "list_dir" or action == "find_file":
        return TIER_1_SAFE

    if action in ["write_file", "create_dir", "move_file"]:
        # Docker workspace = always safe
        if file_path.startswith("/workspace") or file_path.startswith("/app"):
            return TIER_1_SAFE
        # /host_c/ is the mounted C drive — user explicitly allowed this
        if "/host_c/" in file_path:
            # Critical system paths
            critical_paths = ["/host_c/Windows", "/host_c/Program Files", "/host_c/ProgramData"]
            for cp in critical_paths:
                if file_path.startswith(cp):
                    return TIER_3_HIGH
            # User directories are Tier 2 (auto-approved)
            return TIER_2_LOW
        return TIER_2_LOW

    if action == "delete_file":
        if "/host_c/Windows" in file_path or "/host_c/Program" in file_path:
            return TIER_4_CRIT
        if "/host_c/" in file_path:
            return TIER_3_HIGH
        return TIER_2_LOW

    return TIER_3_HIGH


def check_permission(action_type: str, payload: str, tier: str) -> bool:
    """Check if the action is allowed based on tier."""
    logger.info(f"Guardrail Check | Type: {action_type} | Tier: {tier} | Payload: {payload[:80] if payload else 'empty'}")

    if tier in [TIER_1_SAFE, TIER_2_LOW]:
        return True

    if tier in [TIER_3_HIGH, TIER_4_CRIT]:
        return False

    return False
