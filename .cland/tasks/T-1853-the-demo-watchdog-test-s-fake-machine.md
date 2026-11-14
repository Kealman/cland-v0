---
id: T-1853
kind: task
title: The demo watchdog test's fake machine readiness deadline expires under a loaded macOS full run
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1505
branch: t/T-1853-the-demo-watchdog-test-s-fake-machine
created: 2026-11-14T05:51:47.591Z
updated: 2026-11-14T08:36:56.102Z
closed: 2026-11-14T08:36:56.102Z
---

## Summary

`hub/test/demo-release.test.ts` "the detached demo watchdog confirms an active droplet losing tags during its delete" failed in the T-1849 + T-1851 local batch 6fe26f5d (A-19286, head ba94089e5, darwin arm64, 1 worker), with `AssertionError: machine readiness deadline reached` from the `startDemo` helper (hub/test/demo-start.ts:38). It passed in all three of the hub's failing-file reruns, in about 4–5.3 s. The case runs entirely on fakes (fake DigitalOcean API and fake droplet).

## What to build

Find what the fake machine's readiness wait depends on under load: a fake-provider poll interval, a production readiness deadline that the helper consumes, or fixture startup. Then make setup readiness use `testWaitMs()` scaling or a named bound sized for a loaded one-worker full T3 run. Any behaviour bound the case asserts stays exact. If a production readiness deadline is being cut by a held fixture step, name it rather than widening it.

## Acceptance criteria

- [x] C1. The cause of "machine readiness deadline reached" under load is named on this item, and the helper's readiness wait no longer depends on an unscaled real-time bound (test).
  - done: impl-1853 · 2026-11-14T06:44:00.869Z
  - verified: rev-36 [reviewer] · run rev-36-1853-source-2 · 2026-11-14T06:51:34.604Z · commit bd8a072f08f65a2aa8d85914ffc1d9f9eb7fdac1
  - verified: rev-36 [reviewer] · run rev-36-1853-final-1 · 2026-11-14T07:29:01.436Z · commit bd8a072f08f65a2aa8d85914ffc1d9f9eb7fdac1
- [x] C2. The case passes five lone repetitions and one paired run on macOS, plus the task's mode-free verify (test).
  - done: impl-1853 · 2026-11-14T06:51:39.101Z
  - verified: rev-36 [reviewer] · run rev-36-1853-final-1 · 2026-11-14T07:29:01.436Z · commit bd8a072f08f65a2aa8d85914ffc1d9f9eb7fdac1

## Comments

### impl-1853 · 2026-11-14T05:55:11.559Z

Diagnosis (source): the watchdog case alone overrides the process fixture readiness default remoteWaitMs(10_000) with an unscaled 2000 ms. waitForMachine starts after acquire and snapshot persistence; native fake SSH startup/image marker read spends this cap, not earlier fixture preparation. Controlled-delay red will target only cat "$HOME/.cland-image.json" at 2300 ms. No production deadline or deletion assertion is widened. startDemo consumers searched: demo-release, demo-release-component, demo, demo-cap, demo-provisioning; only failure diagnostics change in the shared helper, with no wire/return shape changes.

### rev-36 · 2026-11-14T06:47:54.469Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1853-source-1
commit: cc91b6b6747bbb879ca7f36474bca5b4ef9852e2
scope: full
findings: [{"severity":"medium","text":"New hub-test-demo-release.test.ts.md is absent from generated index; existing test-docs.test.ts:16 requires membership/exact link for every guide. Regenerate index for the new document before verification. Author confirmed omission; no other source defect found.","file":"docs/agents/tests/index.md","line":74}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear for one medium generated-index omission. Readiness removes onlyfixed2s override, retains controlled2300ms real fake-SSH marker delay, sharedscaled setup and exact8s watchdog/singleDELETE assertions. Sharedhelper failure-only diagnostics preserve positive reply/lease contract;5 consumers listed. A-19310 retained red/5lone/11paired and two-sample report-mode replay read with source/native/inventory limits;16s arithmetic correct. No reviewer execution; no native rerun requested. Commit index correction/request fresh source review before mode-free verify.

Criteria: C2 failed (Required mode-free T1 membership would fail because the new test guide is unindexed; corrected-source review and configured run required.).

### rev-36 · 2026-11-14T06:51:34.604Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1853-source-2
commit: bd8a072f08f65a2aa8d85914ffc1d9f9eb7fdac1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0. A-19312 records the exact one-row generated-index repair resolving A-19311. Runtime/helper/allowance bytes unchanged; scaled readiness, controlled 2300 ms marker delay, exact 8000 ms watchdog and single DELETE remain intact. A-19310 retained evidence qualifications remain. C2 still needs its implementation-done mark restored and the exact-head mode-free result; source clearance is not final runtime verification. No reviewer execution or further native campaign requested.

Criteria: C1 verified.

### rev-36 · 2026-11-14T07:29:01.436Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1853-final-1
commit: bd8a072f08f65a2aa8d85914ffc1d9f9eb7fdac1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards 0 / Spec 0. A-19316 independently reconciles same-head 2251d829/A-19315: 6256 base test passes,692 base file passes;125 load test/file passes separate. T0/T1/all fallback T2/changed T3 once/Web exit0. Watchdog named finish passes6.696931083s,archived stop3.855080917s; repaired guide membership and all lower-tier shared-helper consumers positively pass. C1 source/controlled red and C2 five lone plus11/11 pair retained in A-19310; index-only final delta changes no executable bytes. Exact local darwin arm64/Node24.21/Neovim0.12.5/HeadlessShell1248-CfT156 provenance read. Report-mode advisories and native/source/inventory limitations remain explicit; no Linux/fullT3/T4/QA execution claim, fullT3 landing separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-14T08:36:56.102Z

Merged 65814140f8f74f5e8c88e96a96783bc3eea22148 onto dev.
