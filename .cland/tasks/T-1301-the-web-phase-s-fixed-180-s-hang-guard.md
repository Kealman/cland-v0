---
id: T-1301
kind: task
title: The Web phase's fixed 180 s hang guard kills healthy slow runs
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1051
branch: t/T-1301-the-web-phase-s-fixed-180-s-hang-guard
created: 2026-10-25T11:59:19.395Z
updated: 2026-10-25T12:38:48.386Z
closed: 2026-10-25T12:38:48.386Z
---

## Summary

`hub/test/run-suite.ts` kills the Web phase after a fixed 180 s of total wall time. The guard was sized when Web had 16 files (A-9371, A-9419); it now has 44 files and a healthy Linux c-8 Web phase takes 140–164 s, so ordinary droplet variance (about 40 % on Linux Web timings) crosses the guard. T-543's mode-free run a311c2d5 (A-11862) was killed at 186 s mid-file with no assertion failure, its Web tests uniformly 20–30 % slower than the green A-11845.

Make the guard detect a hang, not a slow run: fire on no test progress (no start/finish event from the Web runner) for a bounded window, keeping a generous total ceiling derived from the projected Web wall rather than a constant.

## Acceptance criteria

- [x] C1. A Web phase that keeps emitting test progress is never killed by the hang guard before the total ceiling, and the ceiling is derived from the projected Web wall (at least 2.5× it), not a 180 s constant; a test with a fake clock proves a slow-but-progressing phase survives past 180 s.
  - done: impl-1301 · 2026-10-25T12:14:41.810Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1301-final · 2026-10-25T12:31:19.546Z · commit 56221f8e0e37994deae00d3c35d9c793e67db3d9
- [x] C2. A Web phase that stops emitting progress for the no-progress window is killed with a message naming the stalled file and the window, and its owned processes are cleaned up; a test with a held Web child proves it.
  - done: impl-1301 · 2026-10-25T12:14:41.900Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1301-final · 2026-10-25T12:31:19.546Z · commit 56221f8e0e37994deae00d3c35d9c793e67db3d9

## Comments

### impl-1301 · 2026-10-25T12:00:51.585Z

Initial inspection: clean worktree; fixed guard remains at hub/test/run-suite.ts:267–273. Rule 20 consumer inventory for internal hang-policy change: runSuite (sole timeout owner), skip-reporter execution-order TestProgress producer, unfinished-map/suiteProgress diagnostics, cleanupOwnedProcesses/sweep ownership, planTierReport/projectedWall and durations.json baseline, runPackageSuite phase/workers setup; no protocol or persisted-record shape changes. Clients/log readers suite-log.ts, suite-summary/hub/suites.ts, executor worker and suite-timeouts/progress tests consume existing exit/progress/incomplete receipts and remain unchanged. Search covers hub/src, hub/test (all tiers), web/nvim tests, QA briefs, docs and shipped skills: guidance changes needed in hub/README.md, docs/agents/tests.md, implement skill; test-specific guidance goes in existing suite-runner and web-phase docs. Older progress wire shape remains unchanged. Tests: brief-authorized T1 fake-clock watchdog at existing Web seam, T3 held Web child through actual runSuite for process cleanup.

### impl-1301 · 2026-10-25T12:05:51.127Z

TDD receipts (local macOS/darwin, Node v24.21.0, local executor; no browser launched): C1 positive control reproducing legacy 180 s logic failed with `AssertionError: progress survives at 200 seconds`, actual `Web phase exceeded 180 s gross hang guard`; updated fake-clock Web test file passed 16/16. C2 silence-policy test failed before implementation; held-child regression failed waiting for the 60 s diagnostic before wiring, then passed (latest 0.603 s test time) through real runSuite with runner/worker/descendant reaped and run root removed. Targeted native invocation selected only `a stalled Web child`; the whole suite-runner file's CPU-load case was not run locally. npm run typecheck passed. Tests use simulated Web time, not measured browser/phase latency; no Linux result yet. Source commit 679e77ee; merging freshly fetched origin/dev before review.

### rev-26 · 2026-10-25T12:10:18.373Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1301-source-1
commit: 73eece36e866100f8a8f03a2b2e4ca5db58e00aa
scope: full
findings: [{"severity":"medium","text":"M1: watchdog sentence changes SUITE_USAGE without updating its owning frozen commands.json row; immutable decoded strings differ. Reproduce/fix through unchanged compatibility/full-help guards.","file":"hub/src/cli/usage.ts","line":11},{"severity":"medium","text":"M2: new native regression's later raw after hook runs after ownDirectory cleanup and unboundedly awaits outer-child close after SIGTERM, without owned descendant fallback. Register shared-phase bounded tree/pipe drain before acquisition and prove assertion/setup failure cleanup.","file":"hub/test/suite-runner.test.ts","line":77},{"severity":"medium","text":"M3: watchdog-forced code1 for zero-exit child is set before quarantine's complete/only-excused branch, which can clear it to0 at319. Keep guard failure independent of quarantine and add runner outcome control.","file":"hub/test/run-suite.ts","line":296}]
finding_counts: {"high":0,"medium":3,"low":0}

Consolidated full Standards/Spec audit complete, A-11885, M1/M2/M3 only. Progress-reset policy and >=3x selected-file projected ceiling otherwise match source scope; no additional finding. Standards two medium, Spec one medium. Fix at existing seams without deadline/assertion/guard relaxation, restore done and request fresh pushed-head full source review before verification. Local A-11876 remains summary with source/capture limits, no configured/Linux/browser proof; preserve original available outputs without transcription reruns. No reviewer execution/delegation or QA/landing claim.

Criteria: C1 failed (Changed help disagrees with existing frozen compatibility guards; fresh corrected source/configured evidence required.), C2 failed (Native regression failure cleanup ordering is unsafe and watchdog failure can be cleared by quarantine handling.).

### impl-1301 · 2026-10-25T12:10:36.199Z

Source-1 M1/M3 test-first controls (macOS/local, same Node; no browser): existing `cli-usage-compatibility.test.ts` failed with the added Web watchdog sentence only; existing `cli-help.test.ts` full-help test also failed with that sentence while its two command-help checks passed. Changed only frozen commands.json SUITE_USAGE row; compatibility 1/1 and real CLI help 3/3 now pass. New `Web watchdog failure survives zero exit and an otherwise excused quarantine receipt` initially failed `timeout is fatal even after native zero exit: 0 !== 1` at extracted production runner-outcome seam. Moved guard failure after quarantine excuse normalization; web-phase file now 17/17 passes. M2 uses pre-acquisition onCleanup, full owned-tree discovery/snapshot via cleanupProcesses, captured identities for held runner/worker/descendant, and bounded child-close before directory phase; final behavioral assertions retained. Selected native case passed 0.577 s. Verification remains held pending fresh source review.

### rev-34 · 2026-10-25T12:16:14.804Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1301-source2
commit: 56221f8e0e37994deae00d3c35d9c793e67db3d9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-11894 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11894-t-1301-corrected-source-review-at-56221f8e.md), carrying A-11885. M1: exact frozen SUITE_USAGE equality restored without guard changes. M2: shared pre-acquisition cleanup discovers complete owned tree, bounds/observes termination and outer close, retains root if incomplete; setup/assertion fault controls preserve final PID/root checks. M3: production phaseExitCode applies watchdog fatality after quarantine normalization, including native zero exit, retaining ordinary assertion excuses. Progress/silence/projected-ceiling policy and test assertions remain intact; no later dev merge. A-11891 local source/capture limits retained, not configured/Linux proof. C1/C2 remain unverified pending same-head configured receipt; item QA none.

### rev-34 · 2026-10-25T12:31:19.546Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1301-final
commit: 56221f8e0e37994deae00d3c35d9c793e67db3d9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear: aee389d2/A-11906; audit A-11907 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11907-t-1301-final-watchdog-evidence-at-56221f8e.md), carrying source2/A-11894. Parsed3215 ordinary passes plus15 load passes. C1 progressing/silence/quarantine policy cases each ordinary+5/5load; fake-clock >180s/600s-ceiling proof is simulated policy, not real Web timing. C2 held-child, setup-failure and assertion-failure native controls pass with exact diagnostic/PID/root assertions,0.778/1.101/1.129s; full suite-runner49/49 includes CPU-load control. HostT0 plus LinuxT1/allT2/changedT3once/Web complete; otherT3/T4 absent. Help/docs guards pass; prepared-tree host check not repeated remotely. Report-only budget/lint/ratchet warnings preserved; no new-case duration allowance required. C1/C2 verified, no findings.

Criteria: C1 verified, C2 verified.

### impl-1301 · 2026-10-25T12:32:08.615Z

Configured same-head proof: mode-free run aee389d2-da50-4d93-90d3-33a5c64b0bcd, log A-11906, reviewed head 56221f8e0e37994deae00d3c35d9c793e67db3d9; auto exit 0, 3215/3215 ordinary passes, none failed/cancelled/skipped/todo. Host T0 check; Linux droplet T1/all T2 fallback, changed T3 suite-runner 49/49, Web 44 files completed. Other T3 and all T4 absent, deferred to periodic/integrated occasions. Droplet c-8 lon1, Linux x64 6.8.0-142-generic, Node v24.21.0, Chrome Headless Shell 156.0.8078.4 (Playwright v1248); two suite workers/four Web workers; lifetime 804 s/cost $0.0559. Web measured phase wall 154.887 s (suite duration 155.04 s), separate from 160 s Web command duration; budgets/lint report-only and noted existing warnings remain. Fake-clock >180 s survival is policy proof, not this real phase wall. Named ordinary policy receipts all pass: Web watchdog failure survives zero exit and an otherwise excused quarantine receipt 0.0013 s; Web hang guard permits progress past 180 seconds and retains a projected total ceiling 0.0079 s; Web hang guard resets on start and finish receipts and reports silence including before first progress 0.0044 s. New native receipts pass: a stalled Web child names its file and silence window and reaps owned processes 0.7781 s; held Web fixture reaps its tree after setup failure 1.1015 s; held Web fixture reaps its tree after assertion failure 1.1292 s. None new >=3 s, no new-test duration allowance needed. Final evidence review rev-34-20261025-1301-final clear at same head, C1/C2 verified, A-11907; no per-item QA.

### coord · 2026-10-25T12:38:48.386Z

Merged 78cb813d327f93bbf4e0f206e8e65e66d962c9ee onto dev.
