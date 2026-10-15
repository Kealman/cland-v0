---
id: T-397
kind: task
title: suite.test held-ps admission failure leaves its spoke alive and keeps the file running (cleanup hook ordering)
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
topic: topic-270
branch: t/T-397-suite-test-held-ps-admission-failure
created: 2026-10-14T12:31:34.692Z
updated: 2026-10-15T05:17:53.108Z
---

## Summary

The live held-ps admission case in `hub/test/suite.test.ts` (originally line 1083) failed in run 6a9dce81 and then kept its test file alive after all its cases finished. The file's runner and a child `cland-spoke` sat idle for 55 minutes. The suspected cause: the fixture registers `spoke.close` as a separate `t.after` after an ownership hook, so a failing ownership hook can skip the spoke's close.

## Evidence

- Run 6a9dce81 (T-359 at 0d6a85a7), log A-2347. The held-ps case failed after 2017 ms with an incomplete assertion stack, and the run then went silent after 1228 tests.
- At 12:21Z the Coordinator saw `node --test` (pid 48725, 0% CPU, 58 min) and its child `hub/bin/cland-spoke.ts` (pid 77520, the T-359 worktree, 55 min). No `ps -o` snapshot of the spoke's session or ownership was kept beyond that.
- A-2348 is impl-385's analysis. The attribution of pid 77520 to this fixture is a hypothesis, not proven.
- Run alone, both held-ps cases pass (2/2, 10 s).

## Acceptance criteria

- [x] C1. The failing case's cause is reproduced (a forced ownership-hook failure or the original held-ps race), and the fixture closes every spoke and hub it opened even when an earlier cleanup hook throws.
  - done: impl-397 · 2026-10-15T03:56:08.512Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-397-2 · 2026-10-15T05:17:51.387Z · commit f7ce94496bd79f27744fb0fe930efe05ee51329c
- [x] C2. A regression forces an ownership-hook failure and proves the file exits with no child processes left.
  - done: impl-397 · 2026-10-15T03:56:09.967Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-397-2 · 2026-10-15T05:17:51.388Z · commit f7ce94496bd79f27744fb0fe930efe05ee51329c
- [x] C3. The held-ps case's original failure after 2017 ms is recorded as undiagnosable from the retained evidence (A-2347/A-2348 keep no stack; Coordinator amendment 2026-10-15 03:49Z); the original live and stale held-ps cases pass 5/5 serially at the head, and the ownership-failure cleanup they share is proven red before and green after with real fixture subprocesses.
  - done: impl-397 · 2026-10-15T03:56:11.260Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-397-1 · 2026-10-15T03:57:03.344Z · commit f7ce94496bd79f27744fb0fe930efe05ee51329c
  - verified: rev-23 [reviewer] · run rev-2026-10-15-397-2 · 2026-10-15T05:17:51.388Z · commit f7ce94496bd79f27744fb0fe930efe05ee51329c

## Comments

### impl-397 · 2026-10-15T03:48:29.238Z

Reproduced C1/C2 with a real suite-fixture subprocess: forcing the first ownership ps probe to throw makes the test fail but leaves the file running beyond 10 seconds (red). Registering fixture UI and spoke disposal with existing onCleanup preserves the error while exiting normally and proving hub/spoke PIDs dead (green, 1.27 s). Both original live/stale held-ps tests pass; original 2017 ms assertion has not reproduced and A-2347 has no retained stack. Coordinator confirmed no alternate raw log and directed proving the observed hook ordering without inferring an assertion from duration. Typecheck passed; full touched-file targeted run underway.

### rev-23 · 2026-10-15T03:57:03.344Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-397-1
commit: f7ce94496bd79f27744fb0fe930efe05ee51329c
scope: full

Source clear at f7ce94496bd79f27744fb0fe930efe05ee51329c. Standards and Spec: no high or medium findings. Independently compared fixture extraction: only UI/spoke cleanup registration changes; original held-ps assertions and deadlines remain intact. Existing onCleanup continues disposal after ownership errors and preserves errors. The real subprocess regression injects one ownership-probe failure, restores builtin probing, requires exit 1 with original error and both hub/spoke PIDs absent; fallback ownership protects the test's own failure path. A-2664 preserves deterministic red/green and states the lost historical assertion cannot be diagnosed. Under Coordinator 9cd5fa26's C3 amendment, checked A-2670 exact-head five serial live/stale pairs, all 2/2 with no skips/failures; C3 verified. A-2668 whole file 68/68 checked. C1/C2 remain pending complete exact-head no-mode local gate. A-2671 details review. No production changes or per-item QA requirement; no claim that the reproduced cleanup error identifies the historical 2017 ms assertion.

Criteria: C3 verified.

### rev-23 · 2026-10-15T05:17:51.388Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-397-2
commit: f7ce94496bd79f27744fb0fe930efe05ee51329c
scope: evidence

Final clear at unchanged source-reviewed f7ce9449. Standards and Spec: no high or medium findings. Local no-mode full gate d44d4c22/A-2691 passes root typecheck and 2086/2086 (37 free hub, 1662 machine hub, 387 Neovim), zero failures/cancellations/skips/todos, exit 0. Real fixture ownership-failure subprocess regression passes: preserves forced error, exits 1 within bound and proves recorded hub/spoke PIDs gone; C1/C2 established with retained A-2664 red/green. Both original live/stale held-ps cases pass again; C3 amended evidence A-2670 five serial pairs remains valid. Historical 2017 ms assertion and original spoke attribution remain undiagnosed because retained logs lack the stack; forced cleanup reproduction is not claimed to identify them. Source A-2671 unchanged, all done marks checked, exact head confirmed. A-2692 details evidence; C1-C3 verified.

Criteria: C1 verified, C2 verified, C3 verified.
