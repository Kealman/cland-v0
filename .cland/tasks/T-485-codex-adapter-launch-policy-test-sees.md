---
id: T-485
kind: task
title: codex-adapter launch-policy test sees the QA process alive right after an acknowledged session.stop (Linux)
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-299
branch: t/T-485-codex-adapter-launch-policy-test-sees
created: 2026-10-15T09:57:07.055Z
updated: 2026-10-15T16:18:56.122Z
---

## Summary

`hub/test/codex-adapter.test.ts:556` (the T-65 launch-policy test) asserted `pidAlive(qa.pid) === false` right after an acknowledged `session.stop`, and saw it still alive. This was in T-483's droplet gate 7033cc6c (A-2847) at a peak load of 12.3. The stop's acknowledgement precedes the process exit, so the test should wait for the exit (its exit event or a bounded pid poll) before asserting. If the product acknowledges a stop before the process is gone, check the stop's contract.

## Acceptance criteria

- [x] C1. The test waits for the observed process exit after the acknowledged stop, keeps its assertion, and the file passes 5/5 beside a local full run and once on a droplet.
  - done: impl-485 · 2026-10-15T15:33:47.917Z

## Comments

### coord · 2026-10-15T10:54:43.753Z

Second variant, from T-454's droplet gate 93b61bfc (A-2898, confirmed by rev-23 in A-2899): codex-adapter.test.ts:570, where pidAlive(impl.launched.pid) === false fails right after an acknowledged stop. It is the Implementer assertion, not only the QA example at :556. Both are in scope.

### impl-485 · 2026-10-15T15:06:22.525Z

Baseline focused T-65 launch-policy test passed on quiet Darwin (3.23s). Confirmed stop contract: CodexAdapter.stop awaits endProcess, which considers the captured process gone once it is absent from parseProcessTable; that parser explicitly omits Z-state zombies. Test pidAlive uses kill(pid, 0), which can remain true until reaping. Keeping both final false assertions and awaiting bounded PID absence first. Existing Linux receipts in the task identify the flake; no product timing change or new timeout override is needed.

### rev-30 · 2026-10-15T15:08:48.668Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-485-source
commit: 3cfa1f2f861fac5e11d5069e19da77c240111748
scope: full

Source review clear at corrected full head 3cfa1f2f861fac5e11d5069e19da77c240111748; no high, medium or low findings.

Standards: no findings against repo bounded-positive-wait guidance or code-review baseline. The two waits reuse eventually without timeout overrides, fixed sleeps, renamed tests or assertion removal.
Spec: codex-adapter.test.ts:562 and :577 await !pidAlive for the same QA and Implementer PIDs already asserted immediately afterward. Both acknowledged-stop/status assertions and final false liveness assertions remain, along with relaunch/profile proofs. Source contract inspection confirms CodexAdapter.stop awaits endProcess; parseProcessTable excludes zombie rows, while the harness pidAlive uses process.kill(pid,0). Thus stop confirmation and PID reaping are distinct observations; waiting for the latter addresses both scoped variants without changing product timing.

Reviewed git diff 4ed82fdce80753bffcc1b3e4ebcc0d81eba10851...3cfa1f2f861fac5e11d5069e19da77c240111748, one commit/one file/three added lines. Branch resolves to the corrected SHA, not the earlier transcribed SHA. git diff --check green. Both Standards and Spec reviewed directly; role prohibits delegation.

Requester reports quiet focused baseline, typecheck and first whole-file pass 35/35 (A-3092). Four additional Mac file passes and same-head post-source Linux verify remain pending. C1 is composite and remains unverified until those runtime requirements and accepted gate evidence arrive; quiet/loaded repetition labels follow Coordinator 1ba48602. No Reviewer tests or edits.

### impl-485 · 2026-10-15T15:20:07.708Z

Five labelled quiet Darwin whole-file passes complete at reviewed head 3cfa1f2f861fac5e11d5069e19da77c240111748: each 35/35 (175/175 aggregate), durations 54.445s, 50.130s, 51.368s, 54.477s, 54.825s. No assertion removed or timeout overridden. Baseline focused case and npm run typecheck also passed. Full logs: A-3107, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3107-t-485-five-quiet-mac-whole-file-passes-and-typecheck-logs.md. E-482's 12:32Z Coordinator decision permits quiet passes instead of a concurrent local full run. Same-head Linux verification fffae7db-dd45-4c0d-9573-d42da1c8bde5 is running on cland-v0-dddec164; C1 remains pending that result.

### impl-485 · 2026-10-15T15:33:41.163Z

First droplet fffae7db/A-3126 passed all 35 codex-adapter tests, including changed T-65 launch-policy case (8.787s). Overall 1761 pass/1 fail/3 platform skips; sole failure is session-usage.test.ts:52 initial limits-only journal row, T-495 signature on a branch predating its merge. Requested lead classification. Shared heartbeat allowance commits e9578029 + 18e5c465 cherry-picked as d3e715a9 + 69bd8844; conflict in second pick resolved to only the intended heartbeat entry inside allow. JSON shape/placement and diff checked, task test file unchanged. Pushed 69bd884442ceb407707fcd2dda3b7c3b07fa34fa and requested delta review. No new verification before Coordinator restart notice.

### rev-30 · 2026-10-15T15:35:10.914Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-485-linux-first
commit: 3cfa1f2f861fac5e11d5069e19da77c240111748
scope: evidence

Evidence review not clear at reviewed 3cfa1f2f861fac5e11d5069e19da77c240111748; final gate remains pending second accepted Linux receipt.

Medium — hub/test/session-usage.test.ts:52: Codex journal includes an initial limits-only [undefined,false] row before expected totals (A-3126:3979–3996). Exact known T-495 signature on this older branch; Coordinator b1fe4457 explicitly classifies it and accepts A-3126 as first E-482 receipt. No new T-485 implementation defect or failed implementation criterion mark.

fffae7db/A-3126 matches source-reviewed head; Linux x64 c-8, exit 1, 1761 pass/1 fail/3 platform skips, no cancelled tests. All 35 Codex adapter tests pass, including changed launch-policy test at 8.786591386 s. Source verdict stands. A-3107 raw logs confirm five quiet serial Mac whole-file passes, 35/35 each (175/175), zero fail/cancel/skip, plus typecheck. Composite C1 remains unverified until accepted final gate.

Requested intermediate head 69bd884442ceb407707fcd2dda3b7c3b07fa34fa contains only the shared heartbeat duration allowance; inspection and parsed comparison confirm proper allow nesting and preservation of every prior manifest field. No source finding. Per implementer's latest message 607f6f1a, formal delta clearance is deferred to the final combined head after the planned T-495 pick and restart notice, avoiding an intermediate source verdict that would immediately need replacement. Coordinator e6ea9694 prohibits new verifies until restart. No Reviewer tests/edits.
