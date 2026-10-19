---
id: T-920
kind: task
title: nvim client.test.ts 'follows its hub through a restart' still expects the CLI's 'autostart deferred' after T-911 made the deferral client-side
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-911
found_by: cover
topic: topic-670
branch: t/T-920-nvim-client-test-ts-follows-its-hub
created: 2026-10-19T23:29:18.671Z
updated: 2026-10-19T23:41:44.031Z
---

## Summary

The periodic dev T3 run at 15f9c308 (A-6796, around line 53956) fails `nvim/test/client.test.ts::the client follows its hub through a restart and keeps the thread`. The test expects the workbench's `cland hub start` to print "autostart deferred". Since T-911 (49dd7443) the workbench checks the stop marker client-side and doesn't call `hub start` inside the 30 s window. It sets the state 'waiting' with "hub autostart deferred during the deliberate-stop grace period" (nvim/lua/cland/hub.lua ~269), so the captured stdout stays empty. It fails deterministically on dev, and T-911's T0–T2 verify didn't run this T3 file.

## What to build

Update the test to the T-911 contract: after `cland hub stop`, the workbench issues no `hub start` inside the grace window, and shows the waiting state with the deferral reason. After the window, or on an explicit start, the client follows the restarted hub and keeps the thread, as before. Use the fake clock or an injected grace value if the client allows it, rather than waiting 30 s. Don't weaken the restart-follow assertions.

## Acceptance criteria

- [ ] C1. The test passes locally on macOS 5/5 serially, and fails if the client issues `hub start` inside the window (mutation check), with the receipt in the report.
  - verified: rev-30 [reviewer] · run rev-20261019-920-source · 2026-10-19T23:32:13.067Z · commit bf683e74d0007acef481332f5d275100f11701c4
- [ ] C2. A mode-free verify at the reviewed head is green.
  - failed: rev-30 [reviewer] · 2026-10-19T23:41:44.031Z · note Authorized retry dc3ab308/A-6819 exits1 at same reviewed head with identical vboard child+parent failure; hold further retries pending T-921.

## Comments

### impl-920 · 2026-10-19T23:30:42.468Z

Reproduced original failure locally (3/4 pass; restart test expects /autostart deferred/ but stdout is empty). Updated only nvim/test/client.test.ts: count attempted hub-start commands, wait for client waiting state, assert exact deliberate-stop reason and no discovery file, retain explicit restart/reconnect and exactly-one historical message. Temporary mutation bypassing hub.lua stop-marker guard fails at the zero-call assertion (actual 1); source restored. Typecheck passes. Five serial whole-file macOS repetitions running; no full suite run before review.

### rev-30 · 2026-10-19T23:32:13.067Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-920-source
commit: bf683e74d0007acef481332f5d275100f11701c4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6809. One T3 test-file correction observes zero attempted CLI starts and exact client waiting/deferral state via a bounded condition, retaining actual command/callback behavior and every explicit restart/reconnect/message/history assertion. No30s wait or production/tier change. A-6806 raw local macOS receipts independently reviewed:five serial4/4 runs (20/20, zero nonpasses); stop-guard bypass mutation fails at exact zero-call assertion, actual1. C1 verified. C2 awaits exact-head mode-free green; local native evidence is distinct from deferred periodic/integrated Linux T3 coverage. QA none; no Reviewer tests.

Criteria: C1 verified.

### impl-920 · 2026-10-19T23:36:08.292Z

C2 blocked: exact reviewed head bf683e74 mode-free run cde54197-a0d0-4216-9b9d-63fae7cee4da exited 1, 819/821 pass. T1 passed; T2 failed nvim/test/vboard.test.ts release-version display case v0.1.1 (parent also counted). Linux droplet, lifetime 179 s, cost $0.0124; full log A-6810. Reported unrelated failure to supervising lead; holding reviewed source unchanged pending coordination.

### rev-30 · 2026-10-19T23:36:24.720Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-920-runtime
commit: bf683e74d0007acef481332f5d275100f11701c4
scope: evidence
findings: [{"severity":"medium","text":"Mode-free current-head verification fails the release-versions v0.1.1 tree assertion and parent; required green gate is absent. Attribution/shared-defect status is not established.","file":"nvim/test/vboard.test.ts","line":184}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear, A-6811. Independently audited A-6810/cde54197 at exact reviewed head:821 tests,819 pass,2 fail (vboard release-versions child+parent),zero cancel/skip/TODO. Raw finishes44055/44070 and diagnostic44378 establish tree assertion failure at vboard.test.ts:184. No load groups or resource mismatches. C2 failed; C1 local Mac proof/source remains verified. No source attribution/shared-defect classification inferred. Lead/Coordinator disposition needed before diagnosis/retry/fix; changed head needs fresh source review. QA none; no Reviewer tests.

Criteria: C2 failed (Mode-free cde54197/A-6810 at reviewed bf683e74 exits1: vboard release-versions v0.1.1 child and parent fail; a green current-head receipt is required.).

### impl-920 · 2026-10-19T23:40:33.295Z

Coordinator authorized one same-head retry after classifying vboard as unrelated flake and filing T-921. Retry dc3ab308-77b3-40c2-97c3-259a4039302a at bf683e74 failed on the same vboard v0.1.1 case (819/821 pass), A-6819; Linux x64 droplet lifetime 180 s, cost $0.0125. Per Coordinator instruction, holding further runs/diagnosis and source unchanged; C2 blocked pending disposition.

### rev-30 · 2026-10-19T23:41:44.031Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-920-runtime-retry
commit: bf683e74d0007acef481332f5d275100f11701c4
scope: evidence
findings: [{"severity":"medium","text":"Authorized single same-head retry again fails release-version v0.1.1 child+parent, leaving required green gate absent; Coordinator owns disposition through T-921.","file":"nvim/test/vboard.test.ts","line":184}]
finding_counts: {"high":0,"medium":1,"low":0}

Retry evidence not clear, A-6821. Raw A-6819/dc3ab308 independently confirms821/819/2,zero cancel/skip/TODO, identical vboard ordinary failures44050/44060. Direct Coordinator history authorizes exactly one same-head retry and classifies issue as unrelated T-921-owned, then orders hold until T-921 lands; after that one requested dev merge requires fresh delta review/verify. C2 remains failed; no further unchanged-head retry authorized. C1/source retained. QA none; no Reviewer tests.

Criteria: C2 failed (Authorized retry dc3ab308/A-6819 exits1 at same reviewed head with identical vboard child+parent failure; hold further retries pending T-921.).
