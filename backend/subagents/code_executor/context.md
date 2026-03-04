Name: code_executor
Description: Executes code strings (Python, Node.js, JS) securely inside a temporary sandbox. Does NOT write to persistent files.
Capabilities: Running isolated scripts, testing frontend/backend logic, compiling small snippets.
Input Schema:
{
  "action": "execute_code",
  "parameters": {
    "language": "python" | "javascript",
    "code": "print('Hello World')"
  }
}