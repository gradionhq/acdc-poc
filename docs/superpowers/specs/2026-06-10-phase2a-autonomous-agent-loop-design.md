# Phase 2a — Autonomous Agent Loop (prove on one issue) — Design

**Date:** 2026-06-10
**Status:** Approved (brainstorm) — pending spec review
**Author:** dung.nguyen@gradion.com (with Claude Code)

## Purpose

Phase 2 turns the `gradionai/acdc-poc` template (Phase 1, `v0.1.0`) into a working
demonstration of **autonomous, agent-driven development with a 3-way AI reviewer
bake-off**: coding agents take GitHub `agent-ready` issues to merged PRs — with
Playwright video proof-of-work — entirely without a human in the per-issue loop,
while **Gitar, CodeRabbit, and Claude Code review** each PR so we can compare them.

This spec covers **Phase 2a**: stand up and **prove the full autonomous loop on a
single issue** end to end. Scaling to all 6 issues + the aggregate reviewer
comparison is **Phase 2b** (separate spec), de-risked by 2a.

## Decisions locked during brainstorming
- **Generator = in-session subagents in git worktrees.** I (this Claude Code
  session) am the orchestrator; I spawn subagent workers, each in its own git
  worktree, to implement issues. (Not `claude-code-action`/GitHub Actions — lower
  infra, reuses the multi-agent capability from Phase 1.)
- **Reviewers (all three on every PR):** Gitar (installed), CodeRabbit (to install),
  **Claude Code review** (the org-managed feature; enabled in the Claude org admin
  and connected to the repo). Same PR held constant → clean apples-to-apples.
- **Scope:** all 6 seeded `agent-ready` issues — sequenced as 2a (one issue) then
  2b (the rest + aggregate scorecard).
- **Governance:** fully autonomous with **auto-merge**, gated on CI + SonarCloud
  green AND the agent having resolved each reviewer's blocking findings (the full
  Solve loop). Humans govern by setting the standards, not by reviewing each PR.
- **Conflict strategy:** implement in parallel (worktrees isolate working trees),
  but **merge sequentially** — each subsequent branch rebases onto the new `main`
  and re-greens before its turn (Approach A; avoids the 6-way merge-conflict mess
  and a GitHub merge queue).
- Spec/plan/scorecard/findings live on `experiment-control`, never on the template's
  `main`.

## Scope

### In scope (Phase 2a)
- Run **one issue** (#21 "pagination controls" — frontend-only, self-contained,
  low-conflict, easily e2e-tested) through the complete loop:
  implement (worktree subagent) → PR with Playwright e2e/video → 3 reviewers →
  resolver subagent → CI+Sonar green + findings resolved → programmatic merge.
- Capture the reviewer scorecard for that one PR.
- Install/verify the three reviewers fire on the PR.

### Out of scope (Phase 2b or YAGNI)
- The remaining 5 issues + the aggregate cross-reviewer comparison (Phase 2b).
- Parallel fan-out of multiple issues + sequential-merge rebasing (2b; 2a is single).
- Native GitHub branch-protection auto-merge / merge queue (we merge via `gh` for
  observability in 2a).
- `claude-code-action` / any new Anthropic API key (generation is in-session;
  Claude review is org-managed).
- Changing the template app beyond what issue #21 requires.

## Architecture — the autonomous loop

The session orchestrates; subagents do the work. For the one 2a issue:

1. **Pick the issue** — #21 (pagination controls).
2. **Implement** — spawn an implementer subagent in a **git worktree** off fresh
   `main`. It: reads the issue's acceptance criteria + `CLAUDE.md`; implements the
   feature; **adds a Playwright e2e covering it (proof-of-work)** — the Phase 1
   `playwright.config.ts` already sets `video: 'on'`, and CI uploads the
   report/video as an artifact + comments the link on the PR, so the implementer
   just needs a passing e2e for the proof video to be produced; runs the green
   bar locally (lint + tests + e2e); commits (Conventional Commits); pushes the
   branch; opens a PR that closes the issue.
3. **Review (bake-off)** — Gitar + CodeRabbit + Claude Code review auto-review the
   PR. The orchestrator **polls** until all three have posted (bounded timeout).
4. **Resolve (Solve loop)** — spawn a **resolver subagent** given all three reviews
   + CI/Sonar status. It addresses every **blocking** finding (bug / security /
   Medium+) by editing code, or records an explicit dismissal with rationale for
   non-actionable ones; pushes; CI + reviewers re-run. Repeat until **CI +
   SonarCloud gate green AND no unresolved blocking findings**, capped at **≤3
   resolve iterations** (then stop and record anything remaining).
5. **Auto-merge** — once the gate is met, the orchestrator **merges via `gh`**
   (merge commit), closing the issue.
6. **Score** — record what each reviewer found (see Scorecard).

**Roles (clear boundaries):**
- *Orchestrator (this session):* selects the issue, spawns workers, polls
  reviews/CI, enforces the gate + iteration cap, performs the merge, records the
  scorecard. Holds no implementation context itself.
- *Implementer subagent:* one issue, one worktree, one PR. Inputs: issue text +
  `CLAUDE.md`. Output: a green PR with e2e/video.
- *Resolver subagent:* one PR. Inputs: the PR + all current review findings + CI
  status. Output: pushed fixes (or recorded dismissals) toward the gate.

## Reviewer bake-off scorecard

Per PR, collect every finding from all three reviewers, **dedupe into one unified
list**, judge each, and record per reviewer:

| Metric | Meaning |
|--------|---------|
| Findings (count + severity) | Volume + how they triage |
| True positives | Real issues — judged vs the issue's acceptance criteria + a per-issue "what could go wrong" checklist prepared up front |
| False positives / noise | Wrong or irrelevant findings |
| Unique catches | Real issues only that reviewer found (strongest value signal) |
| Precision | TP ÷ total findings |
| Latency | PR-open → review-posted |
| Verdict state | approved / commented / changes-requested; gave applyable fixes? |

Plus a per-PR cross-reviewer summary (most real issues, noisiest, unique catches,
signal-to-noise). **Dedup rule:** two findings are "the same" if they target the
same file + overlapping lines OR the same root cause; "unique catch" = a real issue
no other reviewer raised under that rule. Findings stay on the PR (durable
evidence); the scorecard + narrative go on `experiment-control`. **Any dismissals
the resolver makes are surfaced in the scorecard (and remain visible on the PR)**
so the autonomous loop's judgment is auditable after the fact — governance by
review of record, not per-step approval.

**Recorded caveats:** the implementers are Claude (this session) and the Claude
Code reviewer is also Claude — independent instances, same model family, so
Claude-on-Claude review may be softer (a real finding). n is small.

## Prerequisites
- **Install CodeRabbit** on `gradionai/acdc-poc` (operator; the one missing
  reviewer). Gitar + Claude Code review already connected.
- A per-issue **"what could go wrong" checklist** for #21, prepared up front by the
  orchestrator (kept off the implementer/resolver inputs so it doesn't leak), used
  only to judge reviewer true/false positives.
- CI on `main` already gates lint + tests + e2e + SonarCloud (Phase 1).

## Risks / open items
1. **Async review timing** — "all three in?" is polled with a bounded timeout; if a
   reviewer is slow/silent, proceed and record it (don't block forever).
2. **Resolve-loop ping-pong** — a fix can spawn new findings; capped at ≤3
   iterations, then stop and record what remains.
3. **"Blocking" threshold** — bug / security / Medium+ are must-resolve; nits are
   optional (dismissal recorded). Reviewers' severity scales differ, so the
   orchestrator normalizes by this rule: **any reviewer-flagged bug or security
   issue is blocking regardless of its label**, and for graded findings,
   Gitar/Claude "high/medium" and CodeRabbit's non-nit findings map to "Medium+".
   Pure style/nit/typo findings are non-blocking.
4. **Auto-merge safety** — autonomous merge into `main`; for 2a it is one
   fully-reviewed-and-resolved, green PR, merged via `gh` (observable). 2b will
   serialize merges.
5. **Cost/time** — subagents + polling; bounded for one issue.
6. **CodeRabbit must be installed before the run**, else only two reviewers fire.

## Success criteria
Phase 2a succeeds when issue #21 goes **implement → review (3 reviewers) → resolve
→ merge with no human in the per-issue loop**, producing:
- a merged PR that closes #21, with a Playwright **proof-of-work video** artifact,
- evidence the **resolve loop incorporated reviewer findings** (commits addressing
  them, or recorded dismissals), and
- a filled **scorecard** for that PR comparing the three reviewers.
This proves the machine before Phase 2b turns it loose on the remaining issues.
