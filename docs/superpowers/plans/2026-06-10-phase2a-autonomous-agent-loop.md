# Phase 2a — Autonomous Agent Loop Implementation Plan

> **For agentic workers:** This plan is executed by the **orchestrator (this Claude Code session)** following the runbook in Chunk 2, spawning the implementer/resolver **subagents** (via the Agent tool with `isolation: worktree`) as specified. It is NOT executed by a single meta-subagent. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Prove the fully-autonomous loop on one issue (#21, pagination controls): an in-session orchestrator spawns worktree subagents to implement → open a PR with a Playwright video → Gitar + CodeRabbit + Claude Code review → a resolver subagent addresses findings → CI+SonarCloud green + findings resolved → programmatic merge; capture a reviewer scorecard.

**Architecture:** Orchestrator (this session) selects the issue, spawns workers, polls reviews/CI, enforces the gate + iteration cap, merges, scores. Implementer/resolver subagents run in a git worktree off fresh `main`. Reviewers are GitHub-integrated bots/apps. Experiment artifacts (checklist, scorecard, prompts) live on `experiment-control` and are kept OUT of subagent inputs so they can't leak/bias.

**Tech Stack:** Claude Code Agent tool (worktree isolation), git worktrees, `gh` CLI, the Phase-1 template (npm workspaces, Playwright, SonarCloud, CI), Gitar + CodeRabbit + Claude Code review.

**Spec:** `experiment-control:docs/superpowers/specs/2026-06-10-phase2a-autonomous-agent-loop-design.md`

## Prerequisites (operator, before the run)
- **CodeRabbit installed** on `gradionai/acdc-poc` (Gitar + Claude Code review already connected).
- `main` is green at `v0.1.0`; `gh` authed; working tree clean.

## File Structure
| Path (on `experiment-control`) | Responsibility |
|------|----------------|
| `docs/superpowers/experiment/phase2a/issue-21-checklist.md` | The "what could go wrong" rubric for #21 — orchestrator-only, used to judge reviewer TP/FP. NOT given to subagents. |
| `docs/superpowers/experiment/phase2a/implementer-prompt.md` | Standardized implementer subagent prompt |
| `docs/superpowers/experiment/phase2a/resolver-prompt.md` | Standardized resolver subagent prompt |
| `docs/superpowers/results/phase2a-scorecard.md` | The filled reviewer scorecard for the #21 PR |

---

## Chunk 1: Prep artifacts (BUILD, on `experiment-control`)

### Task 1.1: The #21 judging checklist

**Files:** Create `docs/superpowers/experiment/phase2a/issue-21-checklist.md`

- [ ] **Step 1: Write the checklist** (orchestrator-only; the set of real issues to judge reviewer findings against)

```markdown
# Issue #21 (pagination controls) — "what could go wrong" rubric
Used ONLY by the orchestrator to judge reviewer findings as TP/FP. Never given to
the implementer/resolver subagents.

Correctness:
- [ ] Total pages computed as ceil(total / pageSize) from the `X-Total-Count` header.
- [ ] Previous disabled on page 1; Next disabled on the last page (no off-by-one).
- [ ] Cannot navigate below page 1 or past the last page.
- [ ] Page change fetches and renders the correct slice.
- [ ] Single page / empty list: controls disabled or hidden (no crash).

Quality:
- [ ] Rapid clicks don't cause out-of-order/stale renders (no obvious race).
- [ ] Fetch failure handled like the existing flow (error alert), not an unhandled rejection.
- [ ] Controls are accessible (button text / disabled state, not div onClick).
- [ ] No duplicated pagination state; reuses the existing list fetch.

Tests:
- [ ] e2e covers navigating forward and back across >1 page.
```

- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/experiment/phase2a/issue-21-checklist.md
git commit -m "docs(phase2a): add #21 judging checklist"
```

### Task 1.2: Implementer + resolver subagent prompts

**Files:** Create `docs/superpowers/experiment/phase2a/implementer-prompt.md`, `resolver-prompt.md`

- [ ] **Step 1: Write `implementer-prompt.md`**

```markdown
You are implementing GitHub issue #<N> for the acdc-poc full-stack template.

## Working directory
You are in a dedicated git worktree at <WORKTREE_PATH>, on branch
`run/issue-<N>`, branched from the latest `main`. Work ONLY here.

## Steps
1. `gh issue view <N>` — read the issue's acceptance criteria + scope.
2. Read `CLAUDE.md` for project conventions and the security/quality bar.
3. `npm ci` in the worktree (worktrees don't share node_modules), then
   `npm exec --workspace e2e -- playwright install chromium` (the browser may not
   be cached in this worktree/machine).
4. Implement the feature within the stated scope. Follow CLAUDE.md.
5. Add a Playwright e2e under `e2e/tests/` covering the feature (the config already
   records video — a passing e2e produces the proof-of-work artifact in CI).
6. Run the local green bar — **mirror exactly what CI gates on**, so a local pass
   predicts a CI pass:
   `npm run lint && npm run build && npm run test:cov --workspace server && npm run test:cov --workspace web && npm run test:e2e`.
7. Commit with Conventional Commits; `git push -u origin run/issue-<N>`.
8. Open a PR to `main` that closes the issue: `gh pr create --base main --title "..." --body "Closes #<N> ..."`.
9. Report the PR number/URL and a summary of what you built + the green-bar results.

Do NOT merge. Do NOT touch unrelated code. Report BLOCKED if you cannot meet the
green bar.
```

- [ ] **Step 2: Write `resolver-prompt.md`**

```markdown
You are resolving reviewer findings on PR #<PR> (branch `run/issue-<N>`) for acdc-poc.

## Working directory
The git worktree at <WORKTREE_PATH>, branch `run/issue-<N>`. `git pull` first.

## Inputs (provided below)
- The current findings from Gitar, CodeRabbit, and Claude Code review (verbatim).
- Current CI / SonarCloud status.

## Steps
1. For each finding: if it is a bug, a security issue, or Medium+ severity, FIX it
   in code. If it is a pure nit/style/false-positive, do NOT change code — instead
   note a one-line dismissal rationale in your report.
2. Keep changes minimal and within the PR's scope.
3. Re-run the same local green bar CI gates on:
   `npm run lint && npm run build && npm run test:cov --workspace server && npm run test:cov --workspace web && npm run test:e2e`
   (run `npm exec --workspace e2e -- playwright install chromium` first if the browser isn't present).
4. Commit (Conventional Commits) and push.
5. Report: which findings you fixed (with the commit), which you dismissed (with
   rationale), and the green-bar results.

Do NOT merge. Report BLOCKED if a finding requires a decision you can't make.
```

- [ ] **Step 3: Commit**
```bash
git add docs/superpowers/experiment/phase2a/implementer-prompt.md docs/superpowers/experiment/phase2a/resolver-prompt.md
git commit -m "docs(phase2a): add implementer + resolver subagent prompts"
```

### Task 1.3: Scorecard template

**Files:** Create `docs/superpowers/results/phase2a-scorecard.md`

- [ ] **Step 1: Write the scorecard template**

```markdown
# Phase 2a — Reviewer Bake-off Scorecard (issue #21)

**PR:** #<PR> · **Reviewers:** Gitar · CodeRabbit · Claude Code review

## Per-reviewer summary
| Metric | Gitar | CodeRabbit | Claude |
|--------|-------|-----------|--------|
| Findings (count) | | | |
| True positives | | | |
| False positives / noise | | | |
| Unique real catches | | | |
| Precision (TP/total) | | | |
| Latency (PR open → review) | | | |
| Verdict (approved/commented/changes) | | | |

## Unified findings (deduped; judged vs issue-21-checklist)
| # | Finding (file:line) | Raised by | Severity | TP/FP | Resolver action (fixed/dismissed + rationale) |
|---|---------------------|-----------|----------|-------|-----------------------------------------------|

## Notes
- Resolve iterations used (≤3): 
- Dismissals (audit): 
- Caveats: Claude implements + Claude reviews (self-review dynamic); n=1 (this is a
  plumbing/format dry-run — the real comparison is Phase 2b's aggregate).
```

- [ ] **Step 2: Commit + push**
```bash
git add docs/superpowers/results/phase2a-scorecard.md
git commit -m "docs(phase2a): add reviewer scorecard template"
git push origin experiment-control
```

---

## Chunk 2: The run runbook (ORCHESTRATOR, in-session)

> The orchestrator (this session) performs these steps directly, spawning subagents via the Agent tool with `isolation: worktree`. Polling waits use a background `gh` loop (as in Phase 1), not foreground sleeps.

### Task 2.1: Pre-flight

- [ ] **Step 1: Verify reviewers are connected**
```bash
gh api repos/gradionai/acdc-poc/installation 2>/dev/null >/dev/null  # app access sanity
# Confirm CodeRabbit + Gitar apps installed (operator confirmed); Claude Code review enabled org-side.
```
If CodeRabbit is not installed, STOP and ask the operator to install it (only 2 of 3 reviewers would fire otherwise).

- [ ] **Step 2: Confirm main is green + clean** (check the CI workflow's latest *completed* run, not just any run)
```bash
git checkout main && git pull
gh run list --repo gradionai/acdc-poc --branch main --workflow CI --status completed --limit 1 \
  --json conclusion,headSha --jq '.[] | "\(.conclusion) @ \(.headSha[0:7])"'  # expect: success @ <tip sha>
git rev-parse --short HEAD   # confirm the sha above matches main's tip
```

- [ ] **Step 3: Pin the three reviewer identifiers** (so "all reviews in?" is deterministic). From a recent PR (e.g. the Phase-1 PR #9), record how each reviewer appears so the poll can match them exactly:
```bash
gh api repos/gradionai/acdc-poc/issues/9/comments --jq '.[].user.login' | sort -u
gh pr checks 9 --repo gradionai/acdc-poc
```
Expected from Phase 1: `gitar-bot[bot]` (issue comment + check "Gitar"), `sonarqubecloud[bot]`, and CodeRabbit/Claude once they're on a PR. Record the exact logins/check-names for Gitar, CodeRabbit, and Claude Code review; the poll in Task 2.3 keys off these. If CodeRabbit/Claude haven't appeared on any PR yet, note that the #21 PR will be their first.

### Task 2.2: Implement (worktree subagent)

- [ ] **Step 1: Create the worktree off fresh main**
```bash
git worktree add /Users/dung.nguyen/Projects/gradion/acdc-poc-wt/issue-21 -b run/issue-21 main
```
Expected: a linked worktree on branch `run/issue-21`.

- [ ] **Step 2: Dispatch the implementer subagent**
Spawn an Agent (model: sonnet) whose prompt = the contents of
`implementer-prompt.md` with `<N>`=21 and `<WORKTREE_PATH>`=the path above, run
with that worktree as the working directory. The subagent does NOT receive
`issue-21-checklist.md`.
Expected report: PR number/URL, green-bar pass, summary.

- [ ] **Step 3: Record the PR number** as `$PR` for the steps below.

### Task 2.3: Review (bake-off) — poll until all three post

- [ ] **Step 1: Poll for the three reviewers** — run a **background** bounded loop (NOT a foreground sleep), 30s interval, ~10 min cap, keyed off the identifiers pinned in Task 2.1 Step 3:
```bash
for i in $(seq 1 20); do
  logins=$( { gh api repos/gradionai/acdc-poc/issues/$PR/comments --jq '.[].user.login';
              gh api repos/gradionai/acdc-poc/pulls/$PR/reviews  --jq '.[].user.login'; } | sort -u )
  have_gitar=$(echo "$logins" | grep -qi gitar && echo 1 || echo 0)
  have_rabbit=$(echo "$logins" | grep -qi coderabbit && echo 1 || echo 0)
  have_claude=$(echo "$logins" | grep -qiE 'claude' && echo 1 || echo 0)
  echo "iter $i: gitar=$have_gitar rabbit=$have_rabbit claude=$have_claude"
  [ "$have_gitar$have_rabbit$have_claude" = "111" ] && { echo "all three in"; break; }
  sleep 30
done
```
Run via `run_in_background`. If one reviewer is still silent at the cap, proceed and record it as "no review in time" in the scorecard. (Claude Code review may post as a PR *review* or a *check* rather than an issue comment — match against both reviews and check-runs per the Task 2.1 pinning.)

- [ ] **Step 2: Capture all findings verbatim** (issue comments + PR reviews + inline review comments) for the scorecard and the resolver input.

### Task 2.4: Resolve (Solve loop, ≤3 iterations)

- [ ] **Step 1: Dispatch the resolver subagent**
Spawn an Agent in the same worktree whose prompt = `resolver-prompt.md` with
`<PR>`=$PR, `<N>`=21, plus the captured findings + current CI/Sonar status pasted in.

- [ ] **Step 2: Wait for CI + re-review on the new commits** (background poll)
```bash
gh pr checks $PR --repo gradionai/acdc-poc
```
Expected: lint/tests/e2e/SonarCloud re-run on the pushed fixes.

- [ ] **Step 3: Evaluate the gate**
Read all checks: `gh pr checks $PR --repo gradionai/acdc-poc`. SonarCloud's quality
gate surfaces as the **"SonarCloud Code Analysis"** check (confirmed in Phase 1 — it
showed `fail` when new-code coverage dropped, `pass` when restored), and the
pipeline check is **build-test-scan**; both plus **lint** must be `pass`.
Gate met when: **all those checks pass AND no unresolved blocking finding**
(bug/security/Medium+, per the spec's normalization rule) remains. If not met and
iterations < 3, re-capture findings and repeat Task 2.4 Step 1. If still not met
after 3, STOP and record the remaining findings in the scorecard (do not merge).

### Task 2.5: Auto-merge

- [ ] **Step 1: Merge programmatically once the gate is met**
```bash
gh pr merge $PR --repo gradionai/acdc-poc --merge   # closes #21
```
Expected: PR merged; issue #21 closed; board moves it to Done.

### Task 2.6: Score + clean up

- [ ] **Step 1: Fill the scorecard** (`phase2a-scorecard.md` on `experiment-control`): dedupe findings, judge each TP/FP against `issue-21-checklist.md`, attribute to reviewer(s), record resolver actions/dismissals, per-reviewer metrics, and the caveats. Commit + push.

- [ ] **Step 2: Remove the worktree**
```bash
git worktree remove --force /Users/dung.nguyen/Projects/gradion/acdc-poc-wt/issue-21
git branch -D run/issue-21 2>/dev/null || true   # branch is merged via the PR
```

---

## Done criteria (Phase 2a)
- Issue #21 went implement → 3-reviewer review → resolve → **merge with no human in the per-issue loop**.
- The merged PR has a Playwright **proof-of-work video** artifact, and the resolve loop's commits/dismissals visibly incorporated reviewer findings.
- `phase2a-scorecard.md` is filled for the #21 PR (with the self-review + n=1 caveats).
- The machine is proven, ready for Phase 2b (fan out to the remaining 5 issues + aggregate comparison).
