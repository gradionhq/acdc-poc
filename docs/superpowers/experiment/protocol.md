# Operator runbook — the 4 runs

## Fairness controls (apply to every run)
- **Identical ruleset:** the SonarQube quality profile and quality gate recorded
  in Task 2.1 are NOT changed between runs.
- **Identical "green" bar (both loops):** `npm test` passes AND SonarQube reports
  no new issues of severity Medium or above on changed code AND (Loop 2 only) the
  quality gate is Passed and no unresolved Gitar findings of Medium+ remain.
- **Run order (fixed, recorded):** A1 → A2 → B1 → B2. Within each task, Loop 1
  runs before Loop 2 so the pre-commit approach gets no second-mover advantage.
- **Fresh sessions:** each run is a brand-new Claude Code session with no memory
  of prior runs.
- **Fresh start state:** each run begins from a clean checkout of its start tag
  on a new branch (Task A runs from `baseline`; Task B runs from `task-b-bugged`).
- **Gitar auto-commits:** in Loop 2 the agent applies fixes via its own commits;
  Gitar is not allowed to auto-commit unmediated (keeps "who fixes" comparable).
- **Human-attention event = ** any of: (a) the operator must make a judgment the
  agent could not resolve; (b) the operator must unblock a stuck agent; (c) an
  ambiguous/conflicting review comment requires human adjudication. The single
  final "approve & merge" gate is present in BOTH loops and is NOT counted.

## SonarQube quality settings (record from Task 2.1 — must remain unchanged across all 4 runs)
Quality profile: <operator: record from Sonar project settings — likely "Sonar way">
Quality gate: <operator: record from Sonar project settings — likely "Sonar way">

## Per-run procedure
For run `<R>` with start tag `<TAG>`, task prompt `<TASKFILE>`, loop instruction
`<LOOPFILE>`:

1. `git checkout -b run/<R> <TAG>`
2. Start a fresh Claude Code session in this repo.
3. Paste the standardized prompt = contents of `<TASKFILE>` + contents of
   `<LOOPFILE>`. (Identical task body across both loops; only the loop block
   differs.)
4. Let the agent work the loop to the "green" bar, opening a real PR on GitHub.
5. While it runs, record on the scorecard: rework cycles, each issue + the stage
   that caught it, regressions, human-attention events, rough effort.
6. After "green": score escaped issues —
   - Task A: apply `acceptance/task-a-checklist.md` to the final diff.
   - Task B: copy `acceptance/task-b-acceptance.test.ts` into `test/`, run
     `npm test`, record pass/fail, then remove it. (Its import path is written
     relative to `test/`; do not edit it when copying.)
7. Do not merge runs into `main` (keep `main` clean); leave the run branches/PRs
   on GitHub for inspection. Only documentation under `docs/superpowers/results/`
   (the scorecard and findings) is committed to `main`.

## Run table
| Run | Task file | Start tag | Loop file |
|-----|-----------|-----------|-----------|
| A1 | task-a-prompt.md | baseline | loop1-instruction.md |
| A2 | task-a-prompt.md | baseline | loop2-instruction.md |
| B1 | task-b-prompt.md | task-b-bugged | loop1-instruction.md |
| B2 | task-b-prompt.md | task-b-bugged | loop2-instruction.md |
