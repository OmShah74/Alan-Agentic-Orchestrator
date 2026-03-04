import subprocess
import os
from typing import Tuple

class ShellManager:
    def __init__(self, default_cwd: str, timeout: int = 60):
        self.default_cwd = default_cwd
        self.timeout = timeout

    def execute(self, command: str, working_dir: str = None) -> Tuple[bool, str, str]:
        """
        Executes a shell command securely and truncates outputs.
        Returns: (Success Boolean, STDOUT string, STDERR string)
        """
        cwd = working_dir if working_dir else self.default_cwd
        
        # Ensure working directory exists
        if not os.path.exists(cwd):
            return False, "", f"Directory does not exist: {cwd}"

        try:
            process = subprocess.Popen(
                command,
                shell=True,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            stdout, stderr = process.communicate(timeout=self.timeout)
            success = process.returncode == 0
            
            # Truncate to prevent context window blowing up
            truncated_stdout = stdout[-2000:] if len(stdout) > 2000 else stdout
            truncated_stderr = stderr[-2000:] if len(stderr) > 2000 else stderr
            
            return success, truncated_stdout, truncated_stderr
            
        except subprocess.TimeoutExpired:
            process.kill()
            return False, "", f"Command timed out after {self.timeout} seconds."
        except Exception as e:
            return False, "", f"Shell Execution Error: {str(e)}"