---
id: T-552
kind: task
title: doctor's probe runner resolves before a timed-out child's close event
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - hub
  - tech-debt
assignee: null
parent: E-952
blocked_by: []
topic: topic-715
branch: t/T-552-doctor-s-probe-runner-resolves-before-a
created: 2026-10-16T00:33:56.971Z
updated: 2026-10-20T10:24:50.185Z
closed: 2026-10-20T10:24:50.185Z
---

## Summary
Found aside by impl-523 on T-523 (2026-10-16 00:31Z, code reading, not yet reproduced as a failure). In `hub/src/doctor/report.ts:94–103`, `run()` kills a timed-out probe's process group, destroys its pipes, then resolves at once, without awaiting the ChildProcess `close` event. Its error handler also resolves before close. `processStartedAsync` uses this helper, so a probe timeout can leave native process resources alive briefly after the promise settles. That's the same class as T-523's watchdog stop, which T-523 keeps out of scope.

## Acceptance criteria
- [x] C1. `run()` resolves on timeout or error only after the child's `close` (bounded, with SIGKILL escalation), and callers' timeouts still hold.
  - done: impl-552 · 2026-10-20T10:08:54.809Z
  - verified: rev-32 [reviewer] · run rev-20261020-552-final · 2026-10-20T10:18:04.401Z · commit 80e956dbeba00ce3b2f258d533c6349b04007cbb
- [x] C2. A test times out a probe whose child ignores SIGTERM and shows that no PROCESSWRAP or PIPEWRAP handle remains once the promise settles.
  - done: impl-552 · 2026-10-20T09:47:33.130Z
  - verified: rev-32 [reviewer] · run rev-20261020-552-final · 2026-10-20T10:18:04.401Z · commit 80e956dbeba00ce3b2f258d533c6349b04007cbb

## Comments

### impl-552 · 2026-10-20T09:43:14.371Z

A-7125 triage confirmed: REAL-CREW/S row still applies. Reproduced exported run() timeout at current head: after await run(node, SIGTERM-ignoring script, env, 200), native PROCESSWRAP and PIPEWRAP resources still report hasRef() true. Regression will observe only probe-owned native resources and assert they are closed at promise settlement, without a post-settlement wait.

### impl-552 · 2026-10-20T09:46:44.411Z

Implemented: deadline/error records are retained until ChildProcess close; settlement then crosses a full event-loop turn so libuv native close callbacks also finish. Synchronous spawn exceptions can allocate native handles before throwing, so they share that drain. Existing group SIGKILL deadline is retained. Three lifecycle regressions cover timeout with SIGTERM ignored, asynchronous ENOENT, synchronous ENOTDIR; all assert zero probe-owned open PROCESSWRAP/PIPEWRAP handles at settlement. Red/green observed. Full doctor-cli.test.ts passes 9 tests; root typecheck passes. Fetched/merged origin/dev (tracker-only fast-forward 2bfa813b); QA policy is none.

### rev-32 · 2026-10-20T10:01:56.264Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261020-552-source
commit: 7be72d8c576326561a41f7ec6d7ea4fb635fa9f8
scope: full
findings: [{"severity":"medium","text":"After the execution timeout sends SIGKILL and destroys pipes, no cleanup deadline remains: the promise can wait indefinitely if close is delayed or never arrives. C1 explicitly requires bounded settlement/caller timeouts. Add a bounded close-drain failure path that reports incomplete cleanup and preserves ownership; do not return a normal completed result before close.","file":"hub/src/doctor/report.ts","line":87},{"severity":"medium","text":"All three new native probe regressions pass process.env and inherit the live process cwd. They therefore launch against the real project/HOME/Git/account/provider environment instead of a disposable sealed fixture (rule 15). Use scratch root/HOME/XDG/Git configuration, filter credentials last, and retain process ownership through failure/cancellation.","file":"hub/test/doctor-cli.test.ts","line":108}]
finding_counts: {"high":0,"medium":2,"low":0}

## Standards

Medium — hub/src/doctor/report.ts:87: After the execution timeout sends SIGKILL and destroys pipes, no cleanup deadline remains: the promise can wait indefinitely if close is delayed or never arrives. C1 explicitly requires bounded settlement/caller timeouts. Add a bounded close-drain failure path that reports incomplete cleanup and preserves ownership; do not return a normal completed result before close.

Medium — hub/test/doctor-cli.test.ts:108: All three new native probe regressions pass process.env and inherit the live process cwd. They therefore launch against the real project/HOME/Git/account/provider environment instead of a disposable sealed fixture (rule 15). Use scratch root/HOME/XDG/Git configuration, filter credentials last, and retain process ownership through failure/cancellation.

## Spec

The normal timeout/error paths now retain their result until ChildProcess close and two immediate turns; native handle assertions at promise settlement are relevant T3 lifecycle coverage. However C1's explicit bound is incomplete: the single execution timer performs termination, then close is the only remaining completion path. A delayed/absent close can now hold doctor forever. C2's probe and immediate native-handle assertions exist, but new native launch environments violate rule 15 and must be fixed before running them again. Original group SIGKILL and stdout/stderr timeout reporting remain intact.

Source not clear at 7be72d8c576326561a41f7ec6d7ea4fb635fa9f8. C1 failed; C2 not verified. No reviewer test/runtime execution. Supplemental A-7276 reports macOS local doctor-cli 9/9 (T3), doctor 18/18 and T0 check, with existing census in report mode. This is not mode-free same-head suite evidence, and task verification will exclude T3 under the configured queue policy.

Totals: Standards 2 medium; Spec C1 bounded cleanup incomplete.

Criteria: C1 failed (Execution timeout only terminates; close drainage has no bound or incomplete-cleanup outcome, so delayed/absent close can hang doctor.).

### impl-552 · 2026-10-20T10:08:54.779Z

Addressed rev-20261020-552-source findings at 80e956db: explicit 1 s incomplete-cleanup bound after SIGKILL (timeout and early error), sealed disposable native-probe fixtures with final credential filtering/cancellation ownership, and matching doctor docs. Added two fake-clock T2 component tests (native process mock is outside T1 source guard). Local macOS standalone targeted receipts: doctor-run 2/2, doctor-cli T3 9/9, doctor T2 18/18; root typecheck and static/test lint pass (lint report-only, existing 131 findings). A-7364 supersedes A-7276. No post-review dev merge and no full suite yet.

### rev-32 · 2026-10-20T10:09:48.618Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-552-source-2
commit: 80e956dbeba00ce3b2f258d533c6349b04007cbb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No remaining findings at 80e956dbeba00ce3b2f258d533c6349b04007cbb. Rechecked the original change and revision. Timeout and asynchronous error now start an independent one-second close bound, clearing both timers on completion. Ordinary results retain close plus native-handle drainage; the exceptional missing-close result explicitly reports cleanup incomplete/unconfirmed termination. New fake-clock T2 tests cover timeout and early-error bounds and late-close non-overwrite. Native regressions now use allowlisted scratch HOME/XDG/Git/cwd environments, final credential filtering, cancellation/process ownership and bounded close observation before removal. Both original medium findings are resolved.

## Spec

No findings. C1's forced termination, bounded close wait, explicit incomplete-cleanup result and existing error text are covered by source and the new tests. C2 retains actual native PROCESSWRAP/PIPEWRAP assertions immediately at settlement; no post-settlement wait masks them. README describes the normal close drainage and exceptional one-second bound. Native lifecycle tests remain T3; new mocked-boundary cases are T2.

Source clear only. Final criteria marks await same-head mode-free task evidence plus retained native targeted receipts. A-7364 reports local macOS standalone doctor-run T2 2/2, doctor-cli T3 9/9 and doctor T2 18/18, plus T0 checks with diagnostic census report-only. Those are targeted receipts, not Linux/full-suite evidence; task T0–T2 will not execute the native T3 file. No Reviewer runtime execution.

Totals: Standards 0; Spec 0.

### rev-32 · 2026-10-20T10:18:04.401Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-552-final
commit: 80e956dbeba00ce3b2f258d533c6349b04007cbb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear at unchanged 80e956dbeba00ce3b2f258d533c6349b04007cbb, following full source verdict rev-20261020-552-source-2 (A-7367). No findings; C1/C2 verified.

A-7404 / run 6a27e444-3394-49a2-a7fc-4041e9c3670e is a fresh mode-free task run at this head, exit 0: 1948/1948 reported passes; T1 exit 0 (42s), T2 exit 0 (276s), fallback all T2 across hub/Neovim. Linux x64 6.8.0-142-generic on droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5. Host check/typecheck at 05d2af21bcb79f12a83e3ae6f12f11be9a185808 was reused, not repeated remotely. Census/duration/T3 ratchet diagnostics remained report-only; refusal policy enforced.

The retained log has ordinary pass receipts and 5/5 passed load receipts for both new mocked-boundary cleanup tests: timeout with missing close and early error with its independent close bound. Doctor component cases also passed. New doctor-run file has no duration baseline; its actual ordinary test-time sum is about 0.006s, while the report's median-based wall estimate remains a projection.

C2's real SIGTERM-ignoring native process/pipe handle assertion is established by the reviewed T3 test and the separately retained local macOS targeted doctor-cli 9/9 result summarized in A-7364 at this source, alongside ordinary close/error coverage. That native T3 file did not run in A-7404; it is supplemental local evidence, not a Linux native-process pass. Normal settlement waits for close/native drainage, while the missing-close exception explicitly reports incomplete cleanup and unconfirmed termination.

T3/T4 remain deferred under queue policy. No Reviewer runtime execution or broader run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T10:24:50.185Z

Merged b2e3b3e5be951e184c4a37da6945cf5565703827 onto dev.
