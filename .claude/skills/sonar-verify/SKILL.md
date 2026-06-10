---
name: sonar-verify
description: Run SonarQube analysis on your changed files via the MCP server and iterate until clean. Use after writing or modifying code, before opening a PR.
---

# sonar-verify

Use the SonarQube MCP server to verify your own changes before review.

## Steps

1. Determine the files YOU changed in this branch. Diff against the ref you
   branched from — the run's start tag, not `main` (Task A branches from
   `baseline`, Task B from `task-b-bugged`):
   `git diff --name-only <start-tag>..HEAD` plus any uncommitted work
   (`git status --porcelain`). Do not diff against `main` — for Task B, `main`
   lacks the bugged ancestor and would over-report unrelated files.
2. For each changed source file, call `analyze_code_snippet` with the file's
   contents (and its language/path) to get SonarQube's analysis of that code.
3. Read every returned issue. Treat severity Medium and above as blocking.
4. Fix the issues in code. Re-run `analyze_code_snippet` on the changed files.
5. Repeat 2–4 until no Medium+ issues remain AND `npm test` passes.
6. Only then proceed to open the pull request.

Report, for each iteration: which files were analyzed, the issues found
(rule key + severity), and what you changed.
