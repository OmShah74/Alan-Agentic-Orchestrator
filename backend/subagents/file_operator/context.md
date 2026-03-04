Name: file_operator
Description: Safely reads, writes, and modifies files inside the designated /workspace directory.
Capabilities: Writing code to files, reading config files, creating directories.
Input Schema:
{
  "action": "write_file" | "read_file" | "create_dir",
  "parameters": {
    "file_path": "/workspace/target.py",
    "content": "print('hello')" (Only for write_file)
  }
}