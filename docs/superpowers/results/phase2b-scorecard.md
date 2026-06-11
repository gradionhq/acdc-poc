# Phase 2b — Autonomous Run + Reviewer Bake-off (aggregate)

**All 6 `agent-ready` issues were implemented, reviewed, resolved, and auto-merged
fully autonomously** (in-session worktree subagents; no human in the per-issue loop).
Run sequentially (each branched from the latest `main` after the prior merged → zero
merge conflicts).

| Issue | PR | Feature | Resolve iters | Outcome |
|------|----|---------|:-------------:|---------|
| #21 | 27 | pagination controls (Phase 2a) | 1 | merged |
| #15 | 28 | edit a note | 2 (commitlint) | merged |
| #17 | 29 | search/filter | 1 (+CI e2e fix) | merged |
| #18 | 30 | tags | 1 | merged |
| #19 | 31 | attachments upload/download | 1 (security) | merged |
| #20 | 32 | pin/favorite | 1 (+CI e2e fix) | merged |

**Reviewers:** Gitar + CodeRabbit on all 6. **Claude Code review** participated on
**#27 only**, then was **disabled (cost)** — so the aggregate comparison below is
**Gitar vs CodeRabbit**; Claude is reported separately as an n=1 data point.

## Aggregate: Gitar vs CodeRabbit (6 PRs)

| | Gitar | CodeRabbit |
|---|------|-----------|
| Total findings | ~11 | ~11 |
| True positives | ~11 | ~10 |
| False positives / noise | ~0 | 1 (a test-dedup nit on #27 — helper was already reused) |
| "Changes requested" used | yes (#31 security) | no (comments only) |
| Strongest at | **security & runtime/UX edge cases** | **test quality, contracts & type-safety** |

### What each was distinctively good at
- **Gitar** — behavioral correctness, **security**, and edge cases:
  - #31 attachments: **3 real security/robustness findings** (Content-Disposition header
    injection, filename-collision overwrite, no per-note attachment cap/DoS) — and it
    **requested changes**, the only blocking verdict in the run.
  - #27 the top UX bug (new note hidden after create), #29 create-while-filtered,
    #32 pin-on-page-2-vanishes, #28 edit-input validation, #30 untrimmed/duplicate tags.
- **CodeRabbit** — code/test hygiene and rigor:
  - #28: server PUT payload validation, **missing test assertions**, `api.ts` type-safety.
  - #27: the unique **NaN `X-Total-Count`** catch. #31: test-mock 404-contract mismatch.
  - Slightly higher volume + the only noise (1 nit).
- **Overlap:** both independently caught the big shared issues (the #27 race condition,
  the #29 create-while-filtered bug, the #30 tag trimming).
- **Claude (n=1, #27 only):** most concise, best severity calibration (🔴 on the top bug),
  caught the same 2 as Gitar. Disabled after for cost.

## Cross-cutting findings (the important ones for the "perfect setup")
1. **Layered verification is the headline result — each layer caught a class the others
   missed:**
   - **AI review (esp. Gitar)** caught **security + semantic** issues that **CI and the
     SonarCloud gate passed** (the #31 attachment vulnerabilities are the clearest case).
   - **CI (Playwright e2e)** caught real **integration/concurrency** bugs that **neither
     AI reviewer flagged** (#29 and #32 failed in CI on shared-server/pagination races).
   - **SonarCloud + lint/commitlint** caught deterministic rule/coverage/commit issues.
   No single layer would have shipped clean code; together they did.
2. **The autonomous loop is real and robust:** the resolver subagents successfully fixed
   every blocking finding and re-greened; 5 of 6 issues needed 1 resolve pass, and the
   loop self-recovered from genuine CI failures (commitlint body length, e2e flakes)
   within the ≤3-iteration cap — with **no human in the per-issue loop**.
3. **Harness fragilities the run surfaced and fixed (now baked into the template):**
   - Agents must **wrap commit bodies ≤100 chars** (commitlint) — bit #15.
   - The e2e suite shares ONE in-memory server + paginates → tests must use **unique
     per-run tokens / scoped locators**, and the suite is now pinned to **`workers: 1`,
     `fullyParallel: false`** for deterministic runs (bit #17 and #29/#32).
4. **Cost is the real constraint:** the run consumed substantial tokens (6 implementers +
   ~7 resolvers + polling). Claude Code review was disabled mid-run for cost. For a
   standing setup, weigh per-PR review cost vs value — Gitar + CodeRabbit together gave
   strong, complementary coverage.

## Verdict for the company's OSS setup
- **Keep both reviewers** — they are **complementary, not redundant**: Gitar for
  security/behavioral edge cases, CodeRabbit for test/type/contract rigor.
- **Keep the deterministic layer (CI e2e + SonarCloud gate)** — it caught integration
  bugs the AI reviewers didn't.
- **The autonomous implement→review→resolve→auto-merge loop works** under a gate of
  CI + SonarCloud green + reviewer blocking-findings resolved, governed by humans setting
  the standards rather than reviewing each PR.

**Caveats:** small n (6 PRs, 1 each); implementer + resolver are Claude (self-review
dynamic vs the Claude reviewer, which only ran on #27); reviewer "severity" normalized by
judgment. Directional, not statistical.
