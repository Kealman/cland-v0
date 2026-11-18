---
id: T-1982
kind: task
title: waitTimeoutMs returns a fractional deadline under a local load factor, so AbortSignal.timeout throws ERR_OUT_OF_RANGE and macOS covers fail
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1889
topic: topic-1634
branch: t/T-1982-waittimeoutms-returns-a-fractional
created: 2026-11-18T18:33:45.352Z
updated: 2026-11-18T20:56:37.132Z
closed: 2026-11-18T20:56:37.132Z
---

## Summary

The macOS stage cover cf666f3c (local, dev d7050e7e2, A-21352) failed five T2 cases in discord-api, setup-remote-component and telegram-api, all with `RangeError [ERR_OUT_OF_RANGE]: The value of "delay" is out of range. It must be an integer. Received 5795.654296875`. `waitTimeoutMs` in `hub/src/suite-wait-budget.ts` returns `ms * factor`. Locally the factor is `(load + workers) / parallelism` (T-1889), so it is usually fractional, and `testSetupWaitMs()` passes the result to `AbortSignal.timeout`, which requires an integer. Droplets use a factor of exactly 2, so Linux never shows it. Every local macOS cover at a fractional factor fails these cases, which blocks E-1883 stage 1 from closing.

## What to build

`waitTimeoutMs` returns a whole number of milliseconds, rounded up so a deadline never shrinks. Check every caller that passes the result to an integer-only timer API.

## Acceptance criteria

- [x] C1. With an injected fractional load factor (for example 1.159), `waitTimeoutMs(5000)` returns an integer at least `5000 × factor`, and `AbortSignal.timeout(testSetupWaitMs())` accepts it (T1 test, red before).
  - done: impl-1982 · 2026-11-18T18:47:49.569Z
  - verified: rev-35 [reviewer] · run rev-35-1982-source-1 · 2026-11-18T19:16:05.697Z · commit fbb350118e60379842767d6b7d185a140418588d
  - verified: rev-35 [reviewer] · run rev-35-1982-evidence-1 · 2026-11-18T19:48:58.793Z · commit fbb350118e60379842767d6b7d185a140418588d
- [x] C2. The five failing cases pass locally on macOS with `CLAND_TEST_LOAD_FACTOR` set to a fractional value, with assertions unchanged (evidence).
  - done: impl-1982 · 2026-11-18T18:48:36.329Z
  - verified: rev-35 [reviewer] · run rev-35-1982-source-1 · 2026-11-18T19:16:05.697Z · commit fbb350118e60379842767d6b7d185a140418588d
  - verified: rev-35 [reviewer] · run rev-35-1982-evidence-1 · 2026-11-18T19:48:58.793Z · commit fbb350118e60379842767d6b7d185a140418588d

## Comments

### impl-1982 · 2026-11-18T18:41:23.978Z

Consumer audit before shared result change: searched waitTimeoutMs, testSetupWaitMs, suite-wait-budget, fileStartupTimeoutMs and watchFileStartup across source, all test tiers, shared, nvim, web, docs, skills, QA. Integer-only AbortSignal.timeout callers: hub/test/fakes/discord/fake-api.ts:414 waitForHold (discord-api/setup-remote-component) and hub/test/telegram-api.test.ts:501 heldSignal. Native exec timeout in project-hub-lifecycle.test.ts:22 already rounds upward; retained. Other direct waitTimeoutMs callers: until.ts condition/setup waits, file-startup-watchdog.ts (suite-command and test/run-suite envelopes), host-fixture-cleanup, login-terminal, discord-messenger, release-item, remote-discovery-host, suite-close-recovery, fakes/discord/hub, scenario-reply-owner. Other setup-helper consumers use within/fixture deadlines/test timeouts; no downward rounding. QA E-1535-stage-2 and per-test release-item/telegram-liveness/telegram-pacing docs remain valid. No help/wire bytes change. Directly reachable T1 files: until.test.ts, host-agent-storage.test.ts. Only shared function changed; positive-finite guard retained.

### impl-1982 · 2026-11-18T18:42:09.750Z

Consumer audit: integer-only AbortSignal.timeout callers are hub/test/fakes/discord/fake-api.ts:414 and hub/test/telegram-api.test.ts:501. project-hub-lifecycle.test.ts:22 already rounds exec timeout upward. Other direct callers (until.ts, file-startup-watchdog.ts via suite-command/run-suite, host-fixture-cleanup, login-terminal, discord-messenger, release-item, remote-discovery-host, suite-close-recovery, fakes/discord/hub, scenario-reply-owner) use Clock/within/test deadlines, no downward rounding. Searched waitTimeoutMs/testSetupWaitMs/module/function names across source, all test tiers, shared, nvim, web, docs, skills, QA. Other setup-helper consumers unchanged; no help/wire change. QA E-1535-stage-2 and per-test documentation references remain valid. Directly reachable T1: until.test.ts and host-agent-storage.test.ts.

### impl-1982 · 2026-11-18T18:44:27.385Z

C2 evidence (Coordinator approved 1.1591): macOS arm64 local Node v24.21.0 base d7050e7e2, unchanged discord-api/setup-remote-component/telegram-api T2 files. CLAND_TEST_LOAD_FACTOR=1.159: dev 62/62 green (5795 is integer). Factor 1.1591: dev 57 pass/5 fail, exactly A-21352 five named cases, RangeError [ERR_OUT_OF_RANGE]: The value of "delay" is out of range. It must be an integer. Received 5795.5. Same factor on fix: 62/62 green. T1 until.test.ts: before fix 7 pass/1 fail with 5795.5 !== 5796, after fix 8/8 green. Full typecheck exit 0. Configured verification not yet run.

### rev-35 · 2026-11-18T19:16:05.697Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1982-source-1
commit: fbb350118e60379842767d6b7d185a140418588d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Formal source clear after the Coordinator's hub-responsive reconciliation. The persisted hold, done marks and comments were read back once; no timed-out writes duplicated. Standards and Spec: no findings. Shared upward rounding preserves validation/defaults and fixes the integer-only consumer path; the new T1 controls and unchanged T2 red/green evidence establish C1/C2 locally. All five exact RangeError identities pass at accepted factor1.1591; dev1.159 already green is retained separately. A-21373 records the complete source/local scope and known provenance limits, superseding only A-21363's pending-verdict status. No configured verification has run; this is source clearance, not final evidence settlement. Head/tree remain fbb350118/d1a4ed03, clean. Request a configured window at this unchanged head, then same-head final review. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21373-t-1982-source-clearance-at-fbb350118-after-tracker-reconciliation.md.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-18T19:48:58.793Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1982-evidence-1
commit: fbb350118e60379842767d6b7d185a140418588d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; Standards and Spec have no findings. Producing owner c9eb69f2/A-21390 is finished/passed at unchanged fbb350118; clean origin/worktree and exact provenance checked. All716 selected files (229 T1/432 T2/55 Web) and6850 ordinary tests pass, no bad or incomplete structured outcomes;215 load test/file passes counted separately. The new integer-deadline identity has base+5/5 positive test/file receipts, and all five original consumer identities pass. Neovim44 files/385 tests completed; T3 remains merge-batch deferred, T4 unexecuted. C1/C2 retain the source/local macOS factor1.1591 red/green proof from A-21373/A-21357–59; configured Linux evidence supplements it without changing its provenance limits. Snapshot6fbd207c is distinct from Git treed1a4ed03. Linux x64 Node24.21/nvim0.12.5, isolated Headless Shell1248 Chrome156.0.8078.4; printed lint/duration advisories report-only. Verify C1/C2; hold released. Full exact receipts, scope and limits: A-21393, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21393-t-1982-final-same-head-evidence-at-fbb350118.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T20:56:37.132Z

Merged ba0e7650fe2915a88974dd5365cb9a25fa03b8ae onto dev.
