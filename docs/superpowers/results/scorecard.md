# AC/DC PoC — Scorecard

One row per run. Runs: A1 (Task A, Loop 1), A2 (Task A, Loop 2),
B1 (Task B, Loop 1), B2 (Task B, Loop 2).

**Run order actually executed:** A2 first (Loop 2 run before Loop 1, deviating
from the protocol's Loop-1-first order for practical reasons — the MCP server for
Loop 1 was not yet set up). Each run is still an isolated fresh session from a
clean start tag, so agent-side learning carryover is nil; recorded here per the
fairness note.

| Metric | A1 | A2 | B1 | B2 |
|--------|----|----|----|----|
| Rework cycles (Verify→Solve iterations before green) | **0** (self-verify found 0 issues on 1st pass) | **0** | **0** (self-verify found 0; bug found via reasoning, not analysis) | **0** (first cut green; Gitar approved, nothing to iterate) |
| Issues caught — count & stage | **Pre-PR self-verify (`analyze_code_snippet`): 0. Sonar PR analysis: 0 new (gate passed, 100% cov). Gitar: 4 findings (1 bug, 1 security, 1 perf, 1 quality-resolved)** | **Sonar: 5 new (gate PASSED, non-blocking); Gitar: 1 (quality)** | **Self-verify: 0. Sonar PR: 0 new (gate passed, 100% cov). Gitar: 1 (quality — relaxed tests now redundant)** | **Sonar PR: 0 new (gate passed, 100% cov). Gitar: 0 (✅ Approved, no findings)** |
| Regressions or test failures (stage caught) | **None in tests** (15/15) — but Gitar found a latent **memory-leak bug** tests didn't cover | **None** (CI green) | **None** (9/9; build clean) | **None** (7/7; build clean) |
| Escaped issues at end | **2 real issues escaped self-verify, caught only by Gitar: (a) memory leak on note delete, (b) download missing `nosniff`. Loop 1 ended at self-verify, so neither was fixed.** | **Security: 0 escaped (1 partial). Gitar test-quality finding left unaddressed.** | **None material** (bug fixed; Gitar's redundant-test nit non-blocking) | **None** (bug fixed; Gitar approved clean) |
| Task B correctness: acceptance test passes? (Y/N) | n/a | n/a | **Y** (independent hidden acceptance test passes vs PR #7) | **Y** (independent hidden acceptance test passes vs PR #8) |
| Human-attention events | **1 (agent paused to ask before committing/opening PR — deviated from "don't ask")** | **0 (confirmed — fully autonomous)** | **0** (hands-off; "open PR yourself" instruction added) | **0** (hands-off) |
| Rough effort (qualitative) | **TDD + single self-verify pass (PR #6)** | **Single pass, ~minutes (PR 15:07 → Sonar 15:09 → Gitar 15:11)** | **Single pass; correct 1-line fix + strict regression tests (PR #7)** | **Single pass; correct 1-line fix; restored the relaxed tests to strict (PR #8)** |

## A2 — detailed log (Task A feature, Loop 2 post-PR)

**PR:** #5 `feat: add file attachments to notes` — 1 commit (`df426d1`), 472+/4−,
base `main`. Checks: GitGuardian ✓, **SonarCloud ✓ (quality gate passed)**,
**Gitar ✓ (Approved with suggestions, 0 resolved / 1 finding)**, build-test-scan ✓.

**Pitfall checklist (scored against the final implementation):**
1. Path traversal on write — **PASS**: `isValidFilename` rejects `/`, `\`,
   control chars, `.`/`..`, empty, >255; storage is in-memory (no path built).
2. Path traversal on read — **PASS**: download is an in-memory lookup by id+name;
   no filesystem path from `:name`; filename RFC 5987-encoded in the header.
3. File size limit — **PASS**: multer `fileSize: 5MB`, `files: 1`, returns 413.
4. Content-type validation — **PARTIAL**: validates a *well-formed* MIME type
   (regex), not an allowlist; mitigates render risk with `X-Content-Type-Options:
   nosniff` and `Content-Disposition: attachment`.
5. Note existence check — **PASS**: `addAttachment`/`getAttachment` return 404
   for unknown notes.
6. No path/secret disclosure in errors — **PASS**: generic error messages.

**Issues caught & by which stage:**
- **SonarCloud (PR analysis):** 5 new issues, but **quality gate PASSED** — below
  the gate threshold (severities not enumerated here; visible in the SonarCloud
  UI). 98.5% coverage on new code, 0 security hotspots, 0 duplication.
- **Gitar:** 1 quality finding — the path-traversal test gives *false confidence*:
  it asserts `../../etc/passwd` is stored as `passwd` (201), but that only passes
  because supertest's `form-data` calls `path.basename()` client-side before
  sending; the server actually *rejects* names with separators (400). The test
  documents behavior the server doesn't implement and never exercises the real
  rejection branch. A subtle, real test-quality issue — not a security hole.

**Interpretation (preliminary):**
- The agent's *first cut* was already secure (0 security pitfalls escaped), almost
  certainly because `CLAUDE.md` (the Guide) spelled out the security expectations.
  So there was little for post-PR review to catch on security.
- **Confirmed by the operator:** the agent *did* wait for and read the Gitar +
  Sonar reviews before finishing, and there was **no human intervention** (fully
  autonomous). So the Loop 2 reaction loop genuinely engaged — "0 rework" reflects
  a deliberate judgment that nothing required a fix under the green bar, not a
  loop that never ran.
- Notable nuance: Gitar surfaced a **real (non-blocking) test-quality issue that
  the agent chose not to fix** because the green bar (gate pass + no Medium+ +
  tests green) was already met. Whether to count this as an "escaped issue"
  depends on how strictly we score non-blocking suggestions — flag for the
  cross-loop comparison and the findings writeup. It also suggests the green bar
  may want to include "address or explicitly dismiss reviewer findings."

## A1 — detailed log (Task A feature, Loop 1 pre-commit self-verify)

**Fidelity caveat:** Loop 1 self-verified with `analyze_code_snippet` (snippet-level
deterministic SonarQube analysis), not the CI-context `run_advanced_code_analysis`,
because the Agentic Analysis add-on is not in the Team trial. The Loop 1 *concept*
(pre-commit SonarQube self-verify) holds; precision is snippet-level.

**Self-verify result (from the session — not visible on GitHub):**
- The agent ran `analyze_code_snippet` on its changed files and got **0 issues on
  changed code** on the first pass → **0 rework cycles**. (Only 2 pre-existing
  MINOR issues remained in the untouched `update` method — below the Medium+ bar,
  out of scope.)
- 15/15 tests pass; `tsc --noEmit` clean; coverage on changed code ~100%.

**Implementation (per the agent's summary; to be verified against the PR diff):**
same feature; in-memory storage; multer with a **10 MB** cap + single-file limit;
`:name` used only as a Map key (no path built → no traversal surface); 404 on
missing note; 400 on missing/malformed file. 8 new attachment tests.

**PR #6** `feat(notes): add file attachments to notes` — 1 commit (`94fc6db`),
300+/2−, base `main`. Checks all green (Gitar "pass" check, Sonar gate passed).

**Pitfall checklist (scored against the final implementation):**
1. Path traversal on write — **PASS** (in-memory; `:name` used only as a Map key).
2. Path traversal on read — **PASS** (in-memory lookup; no path built).
3. File size limit — **PASS** (multer per-file cap + single file).
4. Content-type validation / safe serving — **FAIL**: allowlist check exists, but
   the download handler sets only `Content-Type` + `Content-Length` — **no
   `nosniff`, no `Content-Disposition`** (A2 had both). Client-declared MIME is
   echoed back → MIME-sniffing / content-injection vector. (Gitar finding.)
5. Note existence check — **PASS** (404 on missing note).
6. Error disclosure — **PASS** (generic messages).
Plus a **correctness bug** outside the original checklist: `delete(id)` removes
the note but not its entry in the separate `attachments` map → **memory leak** on
every delete of a note with uploads. (Gitar finding, confirmed in code.)

**What each stage caught:**
- **Pre-PR self-verify (`analyze_code_snippet`, deterministic): 0 issues** — gave
  false confidence. Missed both the memory-leak bug and the missing security header.
- **SonarCloud PR analysis (deterministic): 0 new issues**, gate passed, 100% cov —
  agreed with the self-verify (these issues are beyond rule-based analysis).
- **Gitar (post-PR, semantic LLM review): 4 findings** — ⚠️ memory-leak bug,
  💡 missing `nosniff`, 💡 unbounded-storage DoS (design-level), and a resolved
  `Content-Disposition` encoding nit. Caught what neither deterministic stage did.

**Key finding (the important one for the company setup):**
- A1's **deterministic pre-commit self-verify said "clean" but the code had a real
  bug + a security gap.** Deterministic analysis (Sonar, whether pre-PR or post-PR)
  is **necessary but not sufficient** — the **semantic LLM review (Gitar) is what
  caught the bug and the missing header**. The strongest setup is **layered**:
  deterministic self-verify *and* AI review, not one instead of the other.
- Our **Loop 1 as defined stops at self-verify** (it doesn't react to post-PR
  review), so these two issues **escaped unfixed**. Real AC/DC should be
  *self-verify to reduce noise, then still review* — a refinement for the setup.

**Caveat — agent-to-agent variance:** A1 and A2 are independent generations and
differ materially (A2's download had `nosniff` + `Content-Disposition` and stored
attachments on the note object → no leak; A1 lacked the header and used a separate
map → leak). So the A1↔A2 delta is partly *which implementation the agent happened
to produce*, not purely loop shape. The robust, loop-independent lesson still holds:
deterministic self-verify missed issues the semantic review caught.

## B1 — detailed log (Task B bugfix, Loop 1 pre-commit self-verify)

**PR #7** `fix(store): 1-based pagination offset` — 2 commits, 31+/4−. Checks all
green (Gitar "pass", Sonar gate passed).

**Outcome:** the agent **correctly found and fixed the bug** — root cause
`start = page * pageSize` → `(page - 1) * pageSize` (`src/store.ts:53`) — and added
strict regression tests pinning exact page contents by id.

**Correctness — verified independently:** the **hidden acceptance test** (not the
agent's own tests) was run against PR #7's code and **PASSES** (page 1 → first
items, etc.). The fix is genuinely correct, not just self-consistent.

**What each stage caught:**
- **Pre-PR self-verify (`analyze_code_snippet`): 0 issues** — as expected, a
  behavioral off-by-one is invisible to deterministic analysis. Self-verify
  contributed **nothing to finding the bug**; the agent found it from the bug
  report + reasoning and locked it in with a regression test.
- **SonarCloud PR analysis: 0 new**, gate passed, 100% cov.
- **Gitar: 1 quality finding** — sharply observed that the (deliberately) relaxed
  tests are now redundant given the new strict ones. Non-blocking; not a
  correctness issue.

**Key finding (Task B):** for a **logic/behavioral bug**, neither deterministic
self-verify nor Sonar PR analysis helps — correctness comes from the **Guide +
the agent's reasoning + a good regression test**. AI review (Gitar) adds polish
but, here, not correctness. This complements the Task A finding: the value of each
verification layer depends on the *class* of issue.

## Comparison summary
- **Loop 1 vs Loop 2 on Task A:** Both first cuts were shaped by the Guide, but
  neither loop's *deterministic* checks (self-verify in A1, Sonar PR analysis in
  both) caught the semantic bugs/security gaps — **Gitar's LLM review did, in both
  runs.** A1 (self-verify only) left a real bug + security gap unfixed because Loop
  1 stops before post-PR review. **Takeaway: layer deterministic + AI review;
  don't treat pre-commit self-verify as a replacement for review.** (n=1 per cell;
  agent-variance caveat above.)
- **Loop 1 vs Loop 2 on Task B:** **Both loops fixed the bug correctly** (the
  independent hidden acceptance test passes against both PR #7 and PR #8), each
  with 0 rework and no human intervention. Neither loop's deterministic checks
  contributed to finding the bug — correctness came from the **Guide + agent
  reasoning + a regression test** in both. The only difference was test hygiene
  (agent-variance, not loop shape): B1 added strict tests but left the relaxed
  ones → Gitar flagged them as redundant; B2 restored the relaxed tests to strict
  → Gitar approved clean. **Takeaway: for a clear-cut logic bug, loop shape barely
  matters** — verification value is low because the issue class is behavioral, and
  the fix is driven by reasoning + tests.
