# AC/DC Proof-of-Concept — Design

**Date:** 2026-06-08
**Status:** Approved (brainstorm) — pending spec review
**Author:** dung.nguyen@gradion.com (with Claude Code)

## Purpose

Validate Sonar's **Agent-Centric Development Cycle (AC/DC)** by proving its
end-to-end loop works on a real repository — specifically its distinctive claim
that **pre-commit, sandbox self-verification** produces a cleaner, lower-rework
outcome than a traditional post-PR AI-review loop.

**Thesis under test:** *Does pre-commit self-verification (the AC/DC ideal)
produce a cleaner, lower-rework outcome than a post-PR AI-review loop — on the
same bug fix?*

This is a structured observation (n=1 bug), not a statistical benchmark. It
proves the **mechanics** of the loop and produces a credible narrative plus a
comparison scorecard.

## Scope

### In scope
- A single public **TypeScript/Node** OSS repo, forked, with one chosen open bug.
- Running that same bug fix through **two loop shapes side by side** (see below).
- The Sonar-native AC/DC stack on **GitHub**: Claude Code (agent), SonarQube
  Cloud (deterministic Verify), Gitar (agentic review + remediation), GitHub
  Actions (tests/CI).
- A scorecard capturing the comparison.

### Out of scope (YAGNI)
- Building any automated pipeline or AC/DC "product."
- Self-managed GitLab (deferred; the available instance is GitLab 14.0.5-ee,
  below tool support thresholds).
- CodeRabbit in the main loop — it is an **optional side-test** only, on its own
  branch/PR, kept out of the main comparison to avoid confounding the thesis.
- Multi-language support; only TypeScript/Node.

## The AC/DC stages and tool mapping

| Stage | Tool(s) | Role |
|-------|---------|------|
| **Guide** | `CLAUDE.md` + coding-standards doc | Inject repo context/standards into the agent, **held constant across both loops** |
| **Generate** | Claude Code | Write the bug fix |
| **Verify** | SonarQube Cloud (deterministic) + Gitar (agentic AI review) | Analyze the change |
| **Solve** | Claude Code + Gitar remediation / SonarQube AI CodeFix | Fix what Verify surfaces, then re-verify |

Gitar is the **canonical** AI reviewer for this PoC (it is Sonar's own AC/DC
review/remediation product). CodeRabbit, if used, is a separate side experiment.

## Architecture & Flow

### Shared setup — the Guide stage (done once)
- Fork the chosen TS/Node OSS repo.
- Author a **`CLAUDE.md`** plus a short coding-standards doc encoding the
  project's conventions, architecture notes, and constraints. This is the Guide
  context for **both** loops, so Guide is held constant and only the loop
  *shape* varies.
- Connect a SonarQube Cloud project to the fork.
- Install Gitar on the fork.
- Confirm the repo's existing test suite runs in GitHub Actions.

### Loop 1 — Pre-commit self-verify (the AC/DC ideal)
1. **Guide** — Claude Code reads `CLAUDE.md` + the bug.
2. **Generate** — writes the fix on a branch.
3. **Verify (self)** — the agent runs SonarQube analysis on its *own* branch
   *before* opening any PR, plus the test suite.
4. **Solve** — the agent fixes whatever Verify surfaced; repeat steps 3↔4 until
   clean.
5. Opens the PR **only when green**. Record what was already clean at PR time.

### Loop 2 — Post-PR review (traditional + AI)
1. **Guide + Generate** — same context; writes the fix on a *separate* branch.
2. Opens the PR **immediately** (no self-check).
3. **Verify** — SonarQube Cloud PR analysis + Gitar review fire on the PR.
4. **Solve** — the agent reacts to their comments (Gitar may also propose/commit
   fixes); iterate until green.

Both loops begin from the identical Guide context and identical bug. The **only
deliberate variable is when verification happens** (before vs. after the PR).

## Measurement — the scorecard

For each loop, record:

| Metric | Why it matters |
|--------|----------------|
| **Rework cycles** — # of Verify→Solve iterations before green | Core AC/DC claim: self-verify front-loads fixing |
| **Issues caught & when** — quality/security/bug issues, and at which stage | Shows whether pre-commit catches what post-PR finds later |
| **Regressions / test failures** — and which stage caught them | Did self-verify prevent a broken PR ever existing? |
| **Escaped issues** — anything still present at the end of each loop | Final quality of the merged result |
| **Human-attention events** — times a human would need to intervene | Tests AC/DC's "humans govern, not author" claim |
| **Rough effort / wall-clock** — qualitative | Sanity check on cost |

The writeup will explicitly state the n=1 limitation: this proves loop mechanics
and yields a narrative + table, not statistical superiority.

## Subject repo & bug — selection criteria

Shortlist 2–3 candidates during planning, then pick one together. Each must:
- Be an active TS/Node OSS repo with **clean SonarQube onboarding** and an
  existing test suite that runs in GitHub Actions.
- Have an open bug that is **real but bounded** (fixable in one focused session)
  and ideally touches **quality/security-sensitive code** (input validation,
  parsing, auth, file handling) so Verify has something substantive to engage.

## Risks & open items (to resolve during planning)

1. **Pre-commit self-verify mechanism (biggest unknown).** Confirm how Claude
   Code calls SonarQube on an un-PR'd branch — via the Sonar MCP server /
   SonarQube Agentic Analysis, or via a local/CI branch scan with
   `sonar-scanner`. The chosen mechanism must let the agent read results back
   and act on them within a session.
2. **Gitar on a fork.** Confirm Gitar installs and reviews on a forked public
   repo under the user's GitHub account.
3. **Comparison fairness.** The same bug fixed twice by the same agent risks the
   second run "learning" from the first. Mitigate by running the two loops in
   **separate, fresh agent sessions** and considering randomized loop order.
4. **n=1 caveat.** One bug proves mechanics, not statistical superiority.
   Stretch goal: a second bug if time allows.

## Deliverables

- The forked subject repo with the `CLAUDE.md` + standards (Guide artifacts).
- Two PRs (one per loop) on the fork.
- A filled-in scorecard table comparing the two loops.
- A short written narrative of findings, including the n=1 caveat and the
  resolution of the open items above.

## Success criteria

The PoC succeeds if it demonstrates, end to end, that:
- The full Guide→Generate→Verify→Solve loop can be executed with the named tools
  on a real repo, **and**
- The two loop shapes can be run on the same bug and compared on the scorecard,
  producing a defensible answer to the thesis (whichever direction it points).
