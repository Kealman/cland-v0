---
id: T-733
kind: task
title: "lead-routing-process: the death step waits for a pid poll that now runs on the test's FakeClock"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
regression_of: T-696
topic: topic-431
branch: t/T-733-lead-routing-process-the-death-step
created: 2026-10-17T10:29:48.524Z
updated: 2026-10-17T10:37:42.986Z
closed: 2026-10-17T10:37:42.986Z
---

## Summary

Dev defect from integrated cover 7c3aa637 (A-4460) at 601d9cde. It fails 5/5 alone on the Mac. T-696 moved the Claude Code adapter's pid-check poll onto the hub Clock. T-701's `lead-routing-process.test.ts` runs its hub on a FakeClock, SIGKILLs the implementer and then waits 5 s of real time for `impl died`. The FakeClock is never advanced past the poll, so the death is never seen. Each item was green alone; together they fail.

## What to build

Make the death step drive the hub's time the way the idle step already does: after the SIGKILL, advance the FakeClock by the adapter's poll interval (until the death event, if needed) instead of waiting on real time. Check whether any other test hosts a hub on a FakeClock and waits on real time for an adapter's pid poll, and fix those the same way.

## Acceptance criteria

- [x] C1. `long idle and death climb from item to epic to release; stopped Leads leave inherited routing` passes 5/5 alone on the Mac and in the task's droplet verify, with every assertion unchanged.
  - done: impl-733 · 2026-10-17T10:37:28.686Z
  - verified: rev-30 [reviewer] · run rev-20261017-733-final · 2026-10-17T10:37:37.136Z · commit 3daa59c8f58b8551b89c3383a46b13eccc3700cf
- [x] C2. The review request lists every test found that hosts a FakeClock hub and waits on an adapter pid poll, each with its fix or the reason it's unaffected.
  - verified: rev-30 [reviewer] · run rev-20261017-733-source · 2026-10-17T10:33:47.213Z · commit 3daa59c8f58b8551b89c3383a46b13eccc3700cf
  - done: impl-733 · 2026-10-17T10:37:29.114Z
  - verified: rev-30 [reviewer] · run rev-20261017-733-final · 2026-10-17T10:37:37.136Z · commit 3daa59c8f58b8551b89c3383a46b13eccc3700cf

## Comments

### impl-733 · 2026-10-17T10:31:10.477Z

Reproduced the pre-fix failure alone on Mac: death notification absent after the 5000 ms frame deadline (file wall 7.70 s). Test-only fix advances the shared FakeClock by the configured adapter poll interval until the exact death notification is observed, retaining all original assertions. Typecheck and tier lint pass; isolated serial repetitions underway. C2 sweep covers every FakeClock import and its projectHub/startHub/remote-fixture callers.

### rev-30 · 2026-10-17T10:33:47.213Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-733-source
commit: 3daa59c8f58b8551b89c3383a46b13eccc3700cf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review T-733 at 3daa59c8f58b8551b89c3383a46b13eccc3700cf, fixed point pre-review dev f3a9f7d7. Origin matches; only hub/test/lead-routing-process.test.ts changes. Reviewed criteria, full test, production Claude poll ownership, the relevant FakeClock callers and A-4461. Read-only review; no Reviewer execution.

Standards
No findings. The same pollMs=50 config value now drives the existing fake Claude adapter and the test's shared FakeClock. After SIGKILL, each bounded condition step advances that clock by the configured interval and looks for the exact item-correlated impl death notification. The production PID checker is scheduled by #clock.setInterval at #pollMs, so this drives the missing owner timer rather than enlarging the native process deadline. eventually retains its5000ms real deadline and yields between checks, allowing asynchronous signal exit, native identity I/O and frame delivery to complete. It awaits each advance serially; no overlapping clock advance is introduced. This explicitly requested positive lifecycle poll is separate from lower-tier tests that assert virtual deadline arithmetic.

All original assertion lines are independently identical to the fixed point. The T3 native-SIGKILL rationale, exact death recipient, idle escalation, stopped-lead recipient, inherited release routing, Coordinator fallback and final stopped-context assertion remain intact. The predicate keeps the original exact death text including item id. No production or manifest change, weakened assertion or longer timeout.

Spec and criteria
The source change addresses the documented composition defect: a real-time frame wait cannot itself trigger an interval owned by the FakeClock. A-4461 records the old isolated5000ms failure and five serial final-base whole-file Mac passes, no failure/cancellation/skip; test2.279–2.499s, file2.529–2.760s, admission loads3.46–3.66<15. Static typecheck/tier-lint/diff checks are recorded green. C1's unchanged-assertion and Mac portion is established; exact-head droplet evidence remains pending, so C1 is not verified yet.

C2 verified. Independent search finds30 FakeClock-containing hub test/helper files. The request/audit enumerates the native PID/liveness matches and exclusions. The corrected routing test is the unmatched death wait. claude-code-accounts discovery/watch/restart already advances its agents/restart schedule before positive native PID receipts; the late-PID stop test releases publication, advances the agents interval, then waits on its explicit native probe receipt. Its default-realClock delayed-PID and controlled hidden-worker cleanup tests intentionally keep real-time lifecycle ownership. Account poller/limited cases observe explicit refresh, command/hook/usage or OS cleanup rather than an unadvanced adapter PID interval. Remaining relevant fixtures use in-process harnesses/peers or executor-scripted time, including the Codex scripted transport; native adapter contract hubs retain default real clocks. No further unmatched adapter-PID wait was found.

Source clear, no findings; C2 verified. Required exact-head droplet verification may proceed. C1/final settlement waits for that receipt. QA scope none; no per-item QA criterion.

Criteria: C2 verified.

### rev-30 · 2026-10-17T10:37:37.136Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-733-final
commit: 3daa59c8f58b8551b89c3383a46b13eccc3700cf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-733 at unchanged source-reviewed 3daa59c8f58b8551b89c3383a46b13eccc3700cf. Origin and hub record match. Source review A-4462 / rev-20261017-733-source applies. Exact-head mode-free droplet ce12309e-7264-4d9a-8a6c-20156bd8b65f / A-4465 finishes exit0. Read-only audit; no Reviewer execution.

Standards: no findings. The changed native lifecycle case passes ordinarily in10.076647843s and5/5 fresh load-gate repetitions. Its reviewed5000ms death-observation deadline and all original routing/lifecycle assertions remain intact; the ordinary timing is whole-case time including native launches, idle steps, stops and inherited routing, not a measurement of that single deadline. The10.077s>10s budget notice is explicitly report-only; no functional or failing load gate appears.

C1 verified: A-4461 records five serial final-base Mac whole-file passes at2.529–2.760s file time, loads3.46–3.66, retaining every original assertion; the exact-head Linux ordinary pass plus5/5 repetitions now supplies the task gate. Source review independently established assertion-line equality and exact item-correlated death receipt while the configured50ms poll is advanced on its owning FakeClock. C2 remains current and is refreshed: the native FakeClock/PID-poll sweep and justified exclusions are documented in the request/A-4461, with the one unmatched death wait corrected.

Counts independently reconcile: selected hub23/23 and Neovim smoke12/12, total35 tests/35 pass, zero failures/cancellations/skips. Mode is hub-selected based on lead-routing-process.test.ts and coverage A-4397 at010c9955; no full-suite execution is claimed. Host typecheck succeeds with candidate-tree receipt c69d254ebc1c574cd3166bca1ccd7712171bbd28 reused remotely. Linux x64 c-8 lon1,Node24.21.0/Neovim0.12.5,two workers; suite91.31s,peak1m load3.96,load-gate extra wall0.04s,lifetime178s,cost$0.0124.

Final review clear, no findings; C1/C2 verified at this exact head. QA scope none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-17T10:37:42.986Z

Merged 20e71b3e76e3db73f11bafacdc3cd1232ab74862 onto dev.
