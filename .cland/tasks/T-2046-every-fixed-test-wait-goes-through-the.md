---
id: T-2046
kind: task
title: Every fixed test wait goes through the shared load-scaled helper, with a per-wait load factor (E-1881 C3 rework, A-22306)
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1691
branch: t/T-2046-every-fixed-test-wait-goes-through-the
created: 2026-11-21T03:32:07.872Z
updated: 2026-11-21T05:25:42.723Z
---

## Summary

E-1881's C3 wasn't met (A-22306). After T-1889 (load-aware test waits), 5 of 15 macOS covers were still red on fixed waits, against 15 of 60 before. The load factor is computed once per tier and only rises above 1 when the 1-minute load is above 8. Three of the five failing waits bypass the shared helper: the Discord test fake's 2000 ms default, Playwright's 3000 ms locator wait, and node's 5000 ms per-test timeout. The human chose on 2026-11-21 to close E-1881 with that reason recorded and to do this rework as a separate 0.4.1 task (ask cdaedf29).

## What to build

Route every fixed test wait through the shared load-scaled helper, with the factor applied per wait from the current load, not once per tier. This covers condition waits, test fakes' default deadlines, Playwright locator and expect timeouts, and per-test timeouts. Keep the assertions. Add a lint that flags new fixed waits outside the helper, in report mode first (rule 27).

## Acceptance criteria

- [x] C1. The waits behind T-2028, T-2033 and T-2034, and the helper's other bypasses named in A-22306, go through the shared helper with a per-wait load factor; each was shown failing first under injected load and now passes (test).
  - done: impl-2046 · 2026-11-21T04:52:53.462Z
- [x] C2. A report-only lint lists fixed waits outside the helper, with the current count recorded (test).
  - done: impl-2046 · 2026-11-21T04:24:17.504Z
  - verified: rev-35 [reviewer] · run rev-35-2046-source-2 · 2026-11-21T04:58:00.998Z · commit 6fab755a9f9fdf3751d8f9eb787b2f93175d21ca

## Comments

### coord · 2026-11-21T03:32:16.767Z

Post-landing check (Coordinator, not a merge criterion): two consecutive macOS full covers on dev after this lands should show no load-timing failure; record them on E-1881's successor or here as a comment. Related open items covered by C1: T-2028, T-2033, T-2034.

### impl-2046 · 2026-11-21T03:53:10.366Z

Consumer inventory before shared default changes: until/eventually/testSetupWaitMs and harness socket/channel-event defaults; remote-fixture.remoteWaitMs/remoteEventually (T-2033); Discord fakes admission/exchange plus existing fake-api setup helpers; web/test/harness.ts default Page/Locator actions (T-2034; repository uses node:assert, no Playwright expect package); run-suite.ts inherited CLAND_TEST_LOAD_FACTOR and --test-timeout; suite-command/file-startup watchdog explicit factor callers. Production waitTimeoutMs consumers retain explicit factors; suiteLoadFactor unchanged. Literal timeout sites elsewhere will be report-only census debt per Coordinator scope ruling. A-22306's Telegram setup and release-item 5s cases were already converted by T-1736/T-1951; preserve those assertions and exercise the shared paths. No change planned to prune-process-lifecycle.test.ts.

### rev-35 · 2026-11-21T04:37:00.247Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2046-source-1
commit: e289ff9740af8eb32cfeff2336af37f29bc360d1
scope: full
findings: [{"severity":"medium","text":"M1 (Standards, rules9/12): The new actual-child launch-timeout regression uses raw TestContext across fixture creation, writeFile, run() launch and done observation. Narrow directory/child hooks do not own and join the complete original setup/body before acquisition or fence root removal across cancellation/late setup. Enroll an encompassing owner with a separately bounded setup and positive child/pipe-close join before directory disposal. Keep the real child execArgv assertion and child-confined OS injection; this native T3 subject does not require a fake-only launch prohibition.","file":"hub/test/suite-runner.test.ts","line":968},{"severity":"medium","text":"M2 (Spec/C1): pollerDeadline samples testDeadlineMs while generating a numeric script. Module-level command constants in executor-run:98, executor-safety:24, suite-close-recovery:69 and suite-remote-process:17 therefore freeze import-time load for later barrier waits. No runtime resampling owner or approved exclusion covers this; the only once-per-launch exception is Node's CLI backstop. Sample when the launched producer arms its timer, or construct the command at actual admission, using the shared policy and a retained load-change control.","file":"hub/test/fakes/finish-poller.ts","line":4}]
finding_counts: {"high":0,"medium":2,"low":0}

First full Standards/Spec source review not clear: one medium Standards and one medium Spec finding, no high/low. A-22330 credits central per-operation defaults, approved launch-time Node exception and advisory C2 census, while documenting native callback ownership and generated-barrier sampling gaps. A-22328 retained red/green exports were inspected with explicit missing raw/native/source-epoch fields; no missing proof is reconstructed. C2 remains done/unverified, no partial verification on this pass. No Reviewer runtime/source edits; correct both findings together and request fresh source review before Coordinator-configured verification.

Criteria: C1 failed (The new native Node-timeout case lacks encompassing pre-acquisition/child-close ownership, and generated finish barriers freeze import-time load instead of sampling actual admission. A-22330 M1/M2.).

### impl-2046 · 2026-11-21T04:52:53.286Z

Source1 correction consumer inventory: pollerDeadline/finish-poller generated-script callers are executor-run.test.ts (module-level longTest), executor-safety.test.ts (module-level longTest, inline package test script and explicit 50ms exit-124 control), suite-candidate.test.ts (candidate barrier), suite-close-recovery.test.ts (module-level barrier), suite-remote-process.test.ts (module-level longTest), and the new until.test.ts guarded VM admission control. Existing production/native callers embed CJS JS inside shell double quotes; the encoded policy module path preserves that grammar while deferring shared budget sampling to producer timer admission. Explicit numeric bounds remain exact; expiry stderr/exit124 are unchanged. Search covered hub/nvim/web tests and fixtures, docs and skills; frozen CLI/help bytes and persisted-record readers do not consume this helper. Matching five file-specific guides and the runner/until guides updated. Source2 evidence A-22336 retains exact command argument arrays/pinned source metadata and native exit/signal results for new checks; earlier A-22328 provenance gaps remain explicit.

### rev-35 · 2026-11-21T04:58:00.998Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2046-source-2
commit: 6fab755a9f9fdf3751d8f9eb787b2f93175d21ca
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full Standards/Spec source2 clear within Coordinator-approved central-default scope. A-22337 resolves M1 with pre-acquisition original setup/body ownership and positive native result/pipe-close receipts, and M2 with shared budget sampling inside generated producers at timer admission. Real child execArgv and final receipt assertions retained. A-22336 pinned command/native code0/signal-null records support64 runner,5 targeted native and55 unit passes plus full lint/typecheck; earlier A-22328 gaps stay explicit. C2 verified: planted advisory census and1963-site current report with zero refusals. C1 final runtime evidence waits for Coordinator's actual exact-head configured result, no new full/native/Web claim. No Reviewer runs/probes/edits.

Criteria: C2 verified.
