---
id: T-1270
kind: task
title: T-1267's lifecycle-serialization cases use a 1 s node:test bound that a loaded T1 shard can exceed; its Sessions guard comment omits the startup rollback
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: topic-1017
branch: t/T-1270-t-1267-s-lifecycle-serialization-cases
created: 2026-10-25T01:20:45.703Z
updated: 2026-10-25T03:34:26.386Z
closed: 2026-10-25T03:34:26.386Z
---

## Summary

oc-rev-1 left two low findings on T-1267, in both its source and evidence verdicts. First, the three new hub/test/lifecycle-serialization.test.ts cases (line 43) set a 1 s node:test timeout, which also covers fixture setup. That's the tightest bound in hub/test, and its T1 peers use 2000 ms; stage-cover shard load has tripled test times before. Second, the Sessions close guards (hub/src/adapters/sessions.ts:1392) throw before the relaunch path releases its launch reservation. releaseInterruptedLaunches rolls it back at the next start, but the new comment doesn't say so.

## Acceptance criteria

- [x] C1. The three lifecycle-serialization cases use the 2000 ms T1 bound, with the assertions unchanged (test).
  - done: oc-1270 · 2026-10-25T03:12:16.422Z
  - verified: oc-rev-1 [reviewer] · run rev-oc-20261025-3 · 2026-10-25T03:14:20.383Z · commit 3356045b996b1a195b7a1e859d5a5fc6aee34f9b
  - verified: oc-rev-1 [reviewer] · run rev-oc-20261025-4 · 2026-10-25T03:28:16.260Z · commit 3356045b996b1a195b7a1e859d5a5fc6aee34f9b
- [x] C2. The Sessions guard comment names releaseInterruptedLaunches as the rollback for a relaunch reservation interrupted by close (docs).
  - done: oc-1270 · 2026-10-25T03:12:16.610Z
  - verified: oc-rev-1 [reviewer] · run rev-oc-20261025-3 · 2026-10-25T03:14:20.383Z · commit 3356045b996b1a195b7a1e859d5a5fc6aee34f9b
  - verified: oc-rev-1 [reviewer] · run rev-oc-20261025-4 · 2026-10-25T03:28:16.260Z · commit 3356045b996b1a195b7a1e859d5a5fc6aee34f9b

## Comments

### oc-1270 · 2026-10-25T02:49:56.752Z

Commit 4cb14110 (pushed to origin/t/T-1270-t-1267-s-lifecycle-serialization-cases, based on origin/dev ad67ef55, no merge needed): C1 sets the three generated lifecycle-serialization cases to the 2000 ms T1 peer bound, assertions untouched; C2 extends the Sessions settled guard comment to name releaseInterruptedLaunches as the rollback for a relaunch reservation the close interrupts (the publish fence included). docs/agents/tests/hub-test-lifecycle-serialization.test.ts.md replaces the one-second sentence (rule 16). No shared contract change: no reply/list shape, schema, refusal class, credential or admission policy touched, so rule 20 has no consumer list. Cover-quiet: no local test, typecheck or verify has run at this head yet. Planned red control when the slot frees: a local-only 1200 ms hold in the found case (never committed) must fail at the old 1000 ms bound and pass at 2000 ms, then the hold is reverted; then the three touched files one at a time plus npm run typecheck, then source review.

### oc-rev-1 · 2026-10-25T03:14:20.383Z

verdict: review
result: clear
by: oc-rev-1 [reviewer]
run: rev-oc-20261025-3
commit: 3356045b996b1a195b7a1e859d5a5fc6aee34f9b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review (full) at 3356045b996b1a195b7a1e859d5a5fc6aee34f9b, tree fcb8c8500cb8b3bff878337a1b189bfd75e39c0b, base origin/dev 15fea30d; origin tip and worktree HEAD both 3356045b, worktree clean, git diff --check clean. Diff is three files: the test literal, the Sessions comment, one docs sentence.

C1: the only test change is the single literal on lifecycle-serialization.test.ts:43, { timeout: 1000 } -> { timeout: 2000 }, on the generated found/alive/identity matrix. Assertions, fixture, deferrals, names and the gate-release after hook are untouched (one-line hunk; no other timeout in the file). 2000 matches the T1 peers in hub/test (48 such bounds); the 0.5 s T1 figure in docs/agents/tests.md is a duration budget, not a bound, and these cases run 5-40 ms.

C2: I checked the mechanism rather than the wording. projectSessions calls sessions.releaseInterruptedLaunches() during adapter construction (adapters/index.ts:104), before the hub serves any connection, so core's #live is empty then; Sessions passes hasProcess = row status running or a pending stop (sessions.ts:1468); core.releaseInterruptedLaunches (core.ts:2251) rolls a reservation back through releaseLaunchRole(..., 'interrupted') when neither holds. A reservation is taken only for relaunch when the row was not running (sessions.ts:1284), and both fences throw before publish/launchSettled, so the row stays stopped and the rollback branch is the one taken. 'as it does for the publish fence above' is accurate for the identity path too: the publish fence throws before launchSettled drops the reservation. No overclaim found.

Rule 16: docs/agents/tests/hub-test-lifecycle-serialization.test.ts.md replaces the stale 'one-second test bound' sentence and is the right per-file location; I scanned docs/ and .agents/skills/ for other claims of that bound and the remaining 'one-second'/'1000 ms' hits are unrelated (usage debounce, read receipts, lifecycle graces). Rule 20: no reply/list shape, schema, refusal class, credential or admission policy changed, so no consumer list is due; rule 1's pre-review dev merge is the documented step.

Rule 17: I ran nothing — this is a read-only source pass. The implementer's red control (1200 ms hold: 1003 ms timeout at the old 1000 ms bound; 1233 ms pass at 2000 ms) is a Darwin receipt from its own session and is labelled as local; it is not Linux or suite evidence. Neither criterion depends on the run, so both are verified from source; the mode-free verify at this head remains the runtime evidence for the T1 file and its load-gate repetitions, and a changed head would need a fresh source review first.

No findings: nothing high, medium or low.

Criteria: C1 verified, C2 verified.

### oc-rev-1 · 2026-10-25T03:28:16.260Z

verdict: review
result: clear
by: oc-rev-1 [reviewer]
run: rev-oc-20261025-4
commit: 3356045b996b1a195b7a1e859d5a5fc6aee34f9b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review (scope evidence) at 3356045b996b1a195b7a1e859d5a5fc6aee34f9b — same head and tree (fcb8c8500cb8b3bff878337a1b189bfd75e39c0b) as the source-clear verdict rev-oc-20261025-3; origin tip and worktree HEAD both 3356045b, worktree clean, no source change since that verdict.

Run 5213028c-0561-4f6f-854a-5c94e71149a0 (A-11588): auto, mode full, exit 0; Linux x64 6.8.0-142-generic, droplet c-8 lon1, Node v24.21.0, 2 workers (source hub config); log head 3356045b; deciding files are the three changed paths. Totals 3109 tests, 3109 pass, 0 fail, 0 cancelled, 0 skipped.

C1 runtime evidence: the three generated identities each passed once on Linux — found 0.045198508 s, alive 0.016147312 s, identity 0.01698303 s (log lines 1531-1541); T1 counts 922 tests against dev's 919. No load-gate repetition ran (0 load-gate records in the log), and none is due: the branch only changes the declared bound on three identities that already exist on dev, so it adds no new identity for the gate. The run is one base pass per identity, not a five-repetition receipt, and C1 as written asks for the bound with the assertions unchanged rather than repetitions.

C2 is the docs criterion and the run adds nothing to it; rev-oc-20261025-3 established the mechanism (releaseInterruptedLaunches during adapter construction, before any connection, rolling back via releaseLaunchRole('interrupted') for a non-running row; pausable only for the publish fence's identity path, which is the same path).

Report-mode lines I checked, not item failures: the would-fail budget list names artifact-cleanup-unit (T1), item-summary-scale (T2), nvim artifact-render, skills-qa and four Web files — none names lifecycle-serialization.test.ts or sessions.ts. The one grep hit that looked like a changed-path match is a false positive: the same long T1 tail line carries 'coverage unsupported path docs/agents/tests/hub-test-lifecycle-serialization.test.ts.md', which is the doc path, not a budget entry. Test lint, the T3 ratchet and the duration regressions are report-only, and no duration regression names the three changed files.

Nothing high, medium or low: no findings. Both criteria were source-verified at this commit and the same-head run is consistent with them, so they stay marked at 3356045b.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T03:34:26.386Z

Merged a157e4d6bae7408d165c7e5a974d637af25009f0 onto dev.
