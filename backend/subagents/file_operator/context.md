Name: file_operator
Description: Safely reads, writes, and modifies files inside the designated /workspace directory.
Capabilities: Writing code to files, reading config files, creating directories, moving files, fuzzy finding files.
Input Schema:
{
  "action": "write_file" | "read_file" | "create_dir" | "delete_file" | "list_dir" | "move_file" | "find_file",
  "parameters": {
    "path": "/host_c/Users/OM SHAH/Downloads/",
    "content": "print('hello')",               // Only for write_file
    "destination": "/host_c/Users/.../Desktop/", // Only for move_file
    "query": "The Two Towers"                    // Only for find_file (fuzzy search in 'path')
  }
}