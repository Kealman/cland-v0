---
id: T-1306
kind: task
title: publish.test.ts's plan-stage case commits the root before the plan's status write lands
state: open
status: review
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1281
blocked_by: []
regression_of: T-1276
found_by: cover
topic: topic-1056
branch: t/T-1306-publish-test-ts-s-plan-stage-case
created: 2026-10-25T14:03:43.066Z
updated: 2026-10-25T14:09:13.838Z
---

## Summary

`hub/test/publish.test.ts` "a task published through cland publish counts as merged and closes its plan stage" (from T-1276) failed in the Linux stage cover 5689e281 (A-11990) at dev 31e63e92 with `cland: publish-state: publish needs a clean project root on dev` (exit 1). It passes 9/9 locally on macOS (plain, with CLAND_TEST_SOAK=1, and as the whole file). Cause, from reading the test: `task plan set` makes the fixture hub move the task to `planned` and write its tracker file asynchronously; the test's `clean(root)` commit can run before that write, leaving the root dirty when `cland publish` checks it. On the slower Linux droplet the write lands after `clean`.

Fix the test, not the product: after `task plan set`, wait on the task's `planned` status (or the tracker write receipt) before `clean(root)`.

## Acceptance criteria

- [ ] C1. The case waits for the plan's status write before committing the root, with its assertions unchanged; it passes in the item's mode-free verify on the Linux droplet and 5/5 locally, and a negative control that commits before the status write fails with the dirty-root refusal.

## Comments

### impl-1306 · 2026-10-25T14:04:49.533Z

Seam confirmed by C1: existing hub/test/publish.test.ts native CLI/Git publication case. Wait for the persisted child tracker's planned status before clean(root); unchanged publication and closed-stage assertions. Test-only change; no shared contract/consumer migration. Plan deterministic negative control by committing before a held status write, then release and observe dirty-root publish refusal.

### impl-1306 · 2026-10-25T14:07:22.397Z

Negative control A-11993 reconstructed the delayed write using actual pre-plan/planned tracker bytes in the sealed disposable fixture; unchanged publish assertion failed with `cland: publish-state: publish needs a clean project root on dev` (native exit 1, 1.564 s macOS). Final code removes replay writes and waits on the parsed persisted child .fm.status. Five sequential targeted T3 case runs passed locally on macOS: 2.825, 2.785, 3.005, 2.925, 3.342 s. Whole touched publish.test.ts passed 4/4 (11.698 s total; target 1.969 s). No browser, no suite or Linux claim yet. Documentation-only lint passed, 0 findings. No new test case or process; existing T3 case only. Typecheck pending; Linux mode-free verify follows clear source review.

### rev-31 · 2026-10-25T14:09:13.838Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1306-source1
commit: 00c2107c3cc0dac6265f19553bb1377af5bd59cd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source CLEAR; Standards 0 / Spec 0, A-11994. Exact tree b45efcdaef2dc2b8ad8f8954c63abf5d5f1d1e9e, base e2bd628c. Two-file test/docs change waits through bounded eventually for actual returned child tracker bytes to parse with fm.status planned before clean(root) commits. Tracker background plan reconciliation supports the diagnosed reply/write gap. All publication/push/merged/stage closure assertions remain unchanged; no product/policy/shared contract/test identity/process/timeout/allowance change. A-11993 negative control replays actual pre-plan/planned bytes around commit and produces exact dirty-root native refusal, explicitly not a held live writer. Local 5/5/file4/4/typecheck/lint reports retained with source/platform/capture limits; no Reviewer execution. C1 intentionally remains runtime-unverified until ordinary unchanged-head mode-free Linux droplet verification and final named-case evidence. Preserve original local stdout/exits/timing receipts without transcription reruns; mark C1 done once all required proof is available, then request final evidence review. QA none.
