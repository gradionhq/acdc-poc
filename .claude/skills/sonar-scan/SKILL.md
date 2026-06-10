---
name: sonar-scan
description: Fetch project guidelines and browse SonarQube issues for context before writing code. Use at the start of a task.
---

# sonar-scan

Use the SonarQube MCP server to gather context before coding.

## Steps

1. Call `get_guidelines` to retrieve the project's coding guidelines and apply
   them while writing code.
2. If touching existing code, browse current SonarQube issues for the relevant
   files to avoid repeating known problems.
3. Summarize the guidelines you will follow before you start editing.
