---
id: T-1306
kind: task
title: publish.test.ts's plan-stage case commits the root before the plan's status write lands
state: closed
status: done
size: XS
criterion_seq: 1
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
updated: 2026-10-25T14:31:12.432Z
closed: 2026-10-25T14:31:12.432Z
---

## Summary

`hub/test/publish.test.ts` "a task published through cland publish counts as merged and closes its plan stage" (from T-1276) failed in the Linux stage cover 5689e281 (A-11990) at dev 31e63e92 with `cland: publish-state: publish needs a clean project root on dev` (exit 1). It passes 9/9 locally on macOS (plain, with CLAND_TEST_SOAK=1, and as the whole file). Cause, from reading the test: `task plan set` makes the fixture hub move the task to `planned` and write its tracker file asynchronously; the test's `clean(root)` commit can run before that write, leaving the root dirty when `cland publish` checks it. On the slower Linux droplet the write lands after `clean`.

Fix the test, not the product: after `task plan set`, wait on the task's `planned` status (or the tracker write receipt) before `clean(root)`.

## Acceptance criteria

- [x] C1. The case waits for the plan's status write before committing the root, with its assertions unchanged; it passes in the item's mode-free verify on the Linux droplet and 5/5 locally, and a negative control that commits before the status write fails with the dirty-root refusal.
  - done: impl-1306 · 2026-10-25T14:24:33.597Z
  - verified: rev-31 [reviewer] · run rev-20261025-1306-final · 2026-10-25T14:25:21.051Z · commit 00c2107c3cc0dac6265f19553bb1377af5bd59cd

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

### impl-1306 · 2026-10-25T14:24:33.534Z

Same-reviewed-head mode-free configured verify 5fb41d25-d8b5-4d92-a954-d5445be44b61 at 00c2107c passed (A-11996): T0, all T1, fallback all T2, changed publish T3 file once, Web; 3215 pass, 0 fail/skip. Actual named case `a task published through cland publish counts as merged and closes its plan stage` finish receipt at log line 16149: outcome pass, 2.205110603 s. All four publication identities passed; no new identity/process/allowance. Linux x64 6.8.0-142-generic droplet c-8 lon1, snapshot cland-v0-5160e995, Node v24.21.0, Neovim v0.12.5; 817 s droplet lifetime, $0.0567. Web used Chrome Headless Shell 156.0.8078.4 (Playwright v1248). Report-only lint/duration findings are retained, not enforced; remaining T3 and T4 did not run. C1 local 5/5 + negative reconstruction evidence preserved in A-11995/A-11993. No source changes after clear review; clean tree.

### rev-31 · 2026-10-25T14:25:21.051Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1306-final
commit: 00c2107c3cc0dac6265f19553bb1377af5bd59cd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence CLEAR, C1 verified; A-11997 carries source A-11994 at unchanged treeb45efcdaef2dc2b8ad8f8954c63abf5d5f1d1e9e. Independently audited original mode-free 5fb41d25/A-11996:3215 ordinary passes, no additional load receipts/failure/cancellation/skip/todo. Exact plan-stage identity passes2.205110603s; all4 publish identities pass once. Persisted planned-status barrier and original publication/push/merged/stage assertions unchanged. A-11995 retains original local5/5 pass outputs with loop-exit/transcription/precommit-source capture limits; A-11993 replay control gives exact dirty-root refusal/native exit1, explicitly reconstructed late-write ordering rather than a held writer. HostT0/allT1/fallbackallT2/changedT3/Web pass; remainingT3 deferred/noT4/allclaim. Linux droplet/browser provenance, reused host gate TREEe841f9e6, selected wall vs case/file/phase/lifetime distinctions retained. Report-only lint133/60, ten duration warnings/five missing baselines/Webwall179.331s vs40 and unchanged ratchet with incomplete baseline disclosed; not an enforced-budget pass. No new identity/allowance or post-review source change. Ready/conflict check next; Coordinator owns enqueue and separate pre-merge verification. Reviewer read-only.

Criteria: C1 verified.

### coord · 2026-10-25T14:31:12.432Z

Merged 1229c80d7981089123d62526583a24bf692aa293 onto dev.
