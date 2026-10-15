---
id: T-483
kind: task
title: "Hotfix: T-253's fail-fast exits on the 5 s stall warning threshold; a slow tracker operation under load kills the hub"
state: open
status: in progress
size: S
rank: 2930
criterion_seq: 3
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
regression_of: T-253
topic: topic-282
branch: t/T-483-hotfix-t-253-s-fail-fast-exits-on-the-5
created: 2026-10-15T09:18:55.709Z
updated: 2026-10-15T09:56:41.749Z
---

## Summary

The hub exited at 09:14:40Z on 2026-10-15 through T-253's fail-fast. A "planned check" on T-467 had run for about 5.2 s under load. `onStorageStall` (hub/src/hub/daemon.ts:144) fires at the stall-detection threshold STORAGE_STALL_MS = 5000 (tracker.ts:73), the threshold that before T-253 only logged a `tracker-storage-stalled` warning, as one did at 05:03Z for T-390's ready check. A slow but finishing operation under load now takes down the hub and every session's connection. This is a hotfix, rank top.

## What to fix

Separate the two thresholds. At STORAGE_STALL_MS the hub keeps warning (`tracker-storage-stalled`, `hub status`). The fail-fast fires only when the same operation is still outstanding at a fatal deadline, for example 60 s, configurable as `[tracker] fatal_stall`, with the test knobs kept separate. A slow operation that completes before the fatal deadline costs a warning, never an exit.

## Acceptance criteria

- [x] C1. An operation held for 6 s and then released logs `tracker-storage-stalled` and completes, and the hub keeps serving, proven by a test.
  - done: impl-483 · 2026-10-15T09:27:57.330Z
- [x] C2. An operation still held at the fatal deadline triggers T-253's fail-fast exactly as before, proven by T-253's tests with the fatal deadline set.
  - done: impl-483 · 2026-10-15T09:27:58.056Z
- [x] C3. hub/README.md describes both thresholds and the setting.
  - done: impl-483 · 2026-10-15T09:24:42.080Z
  - verified: rev-26 [reviewer] · run rev-20261015-483-source-2 · 2026-10-15T09:30:36.828Z · commit 09c915201d3aadb4d28b99dda3bd7f864bcc7c21

## Comments

### impl-483 · 2026-10-15T09:22:34.141Z

Regression reproduced before the fix through the hub frame protocol: a held write past six seconds killed the daemon (assertion: 'a warning must not terminate the hub'). Implementing separate admitted-operation warning and fatal timers, with 60 s default [tracker] fatal_stall and independent fatal test override. Existing T-253 shutdown tests will exercise both configured and overridden fatal deadlines.

### rev-26 · 2026-10-15T09:27:21.479Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-483-source-1
commit: 164d1eca8384bbb70cd371491e3d85edf0ba5910
scope: full

High — hub/src/init/config.ts:191 / hub/src/tracker/tracker.ts:1707: fatal_stall accepts 30d but setTimeout values above 2147483647ms become 1ms (installed Node timers.d.ts:214–215); configured long deadlines can immediately kill serving operations. Bound or safely schedule the duration and cover/document the limit. rev-23 also independently reported it.
Medium — hub/test/tracker-async.test.ts:585/598: add flushLogs:true to status barriers before both hub.log assertions, per T-291; preserve the six-second hold.
The core timer separation/fencing otherwise looks sound: warning does not stop, both timers belong to one admitted operation and clear on completion/rejection/abandonment, fatal callback retains T-253 shutdown. A-2817 reports genuine pre-fix death, 39/39 tests and typecheck green. Replacement head requested; no Reviewer tests run.

Criteria: C1 failed (New six-second regression reads asynchronous hub.log twice without required flushLogs barriers.), C2 failed (Accepted fatal_stall above 2147483647ms overflows setTimeout to 1ms, firing far before the configured deadline.).

### rev-26 · 2026-10-15T09:30:36.828Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-483-source-2
commit: 09c915201d3aadb4d28b99dda3bd7f864bcc7c21
scope: full

No high or medium findings remain. hub/src/init/config.ts:194 rejects fatal durations beyond Node's 2147483647ms maximum; boundary proof accepts 2147483s and rejects 2147484s/30d. daemon.ts bounds the independent fatal override, falling back to config/default when invalid. Both tracker-async log reads now use flushLogs:true barriers. README/generated config document range and independent thresholds.
Production timer ownership/cancellation and T-253 fatal fencing remain sound. A-2823 records boundary red→green and complete 39/39 tracker-async tests, including six-second serving recovery and configured/override fatal paths. C3 source verified; C1/C2/final settlement await accepted exact-head verification. No Reviewer tests run.

Criteria: C3 verified.

### rev-26 · 2026-10-15T09:56:38.865Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-483-evidence-1
commit: 09c915201d3aadb4d28b99dda3bd7f864bcc7c21
scope: evidence

Medium — hub/test/claude-code-sessions.test.ts:251: initial clause-injection wait times out (known T-447 family).
Medium — hub/test/codex-adapter.test.ts:556: acknowledged stopped QA process still satisfies pidAlive; cause/identity attribution unresolved.
Medium — hub/test/codex-adapter.test.ts:903: initial idle wait times out before recovery exercise.
Exact-head full receipt 7033cc6c/A-2847 exits 1: 1722 tests, 1716 pass, 3 fail, 3 platform skips; Neovim not reached. Hotfix Linux cases pass: six-second serving recovery, fatal configuration boundary, held/released fatal shutdown and timer cancellation. Droplet c-8 lifetime 1468s, cost $0.1020, peak load 12.27. C1/C2 proof is positive but final accepted execution remains pending; C3 source mark retained. No unrelated criterion failed. No tests run by Reviewer.

### impl-483 · 2026-10-15T09:56:41.749Z

Exact-head Linux full gate 7033cc6c/A-2847 at 09c91520 failed outside this diff: claude-code-sessions :251 clause-injected timeout (T-447), codex-adapter :556 original QA PID remains alive after acknowledged session.stop, and codex-adapter :903 initial idle timeout. 1716 passed/3 failed/3 platform skips; Neovim not reached. All tracker warning/recovery/fatal/cancellation tests passed. Reported Bugs/S and requested lead disposition before adopting shared fixes or retrying; no further verification submitted.
