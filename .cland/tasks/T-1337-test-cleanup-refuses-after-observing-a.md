---
id: T-1337
kind: task
title: Test cleanup refuses after observing a native exit because it cannot confirm the exited process's descendants
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
regression_of: T-543
topic: topic-1213
branch: t/T-1337-test-cleanup-refuses-after-observing-a
created: 2026-10-26T10:49:09.893Z
updated: 2026-10-29T19:45:31.315Z
closed: 2026-10-29T19:45:31.315Z
---

## Summary

Since T-543, the test harness's process cleanup sometimes refuses at teardown with "native process identity unavailable for pid N; fixture preserved; captured: known; current: native exit observed; listed descendants are not confirmed gone". The cleanup observes the process's native exit, but cannot then confirm its listed descendants, so a passing test fails in its after-hook. It hit hub/test/init-process.test.ts::"a Claude Code session launched in the initialised project gets the project hooks and reads AGENTS.md…" in T-1328's rule 6 run d8110385 (A-12357, Linux). The same message appears in A-12067 and A-12158. The case passed 5/5 alone.

## What to build

When cleanup observes a recorded process's native exit, confirm each listed descendant by its own captured identity (gone, or a different birth), instead of refusing because the parent's identity is no longer readable. Keep refusing when a descendant is still alive with the captured identity. The precise identity rules from T-543 stay intact.

## Acceptance criteria

- [x] C1. A recorded process that exits during teardown, with descendants that exited too, is cleaned without a refusal, while a descendant still alive under its captured identity is still reported, shown with injected process facts (test).
  - done: impl-1337 · 2026-10-29T19:14:55.684Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1337-final · 2026-10-29T19:38:31.498Z · commit b0c4066d0f9d1eaf268b54f45e51ce7706b1f6c4

## Comments

### impl-1337 · 2026-10-29T19:08:12.623Z

Scope/seam: existing synthetic OS boundary in hub/test/process-cleanup.test.ts, explicitly required by C1 (injected process facts). Consumer search: process-cleanup.ts is test-only; requireIdentities serves recorded and discovered cleanup and final signal waits. process table retention is also used by production system-processes.ts; leave that contract unchanged. Existing process-cleanup tests cover native exit, unreadable birth, replacement PID, group/ancestry ownership; preserve these and add final-wait captured-descendant controls. No wire/schema/credential or production permission change.

### rev-34 · 2026-10-29T19:14:47.983Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1337-source1
commit: f97521a5a2d0029450c4e7eb4a9f0f6ce401672a
scope: full
findings: [{"severity":"high","text":"M1: !alive(pid) treats unexpected kill(pid,0) errors such as EIO as absence. With unreadable descendant birth this newly settles an exited-parent branch without exit proof. Require ESRCH/native exit/different captured birth, retain EPERM and propagate unexpected errors; injected EIO refusal controls are required.","file":"hub/test/process-cleanup.ts","line":85}]
finding_counts: {"high":1,"medium":0,"low":0}

A-14024: Consolidated Standards 0/Spec 1 high M1. Claimant reports EIO red and successor fix, outside this fixed-head verdict. Native-exit branch design otherwise preserves captured births/refusals; original local summaries are not configured/Linux evidence. Fresh source review before verification.

Criteria: C1 failed (Unexpected descendant liveness errors can settle an unproved live/unreadable branch; EIO controls reproduce missing refusal.).

### rev-34 · 2026-10-29T19:22:00.678Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1337-source2
commit: b0c4066d0f9d1eaf268b54f45e51ce7706b1f6c4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14030: M1 resolved by ESRCH-only absence/EPERM-live/unexpected-error propagation; Linux/Darwin injected EIO/EPERM refusal controls retain original positives/signals/identity safeguards. Standards/Spec clear. Local 58/58/typecheck are macOS claimant evidence, not configured/Linux proof. C1 runtime unverified pending exact-head verify.

### rev-34 · 2026-10-29T19:38:31.498Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1337-final
commit: b0c4066d0f9d1eaf268b54f45e51ce7706b1f6c4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14044: Original A-14042 confirms 4256 ordinary passes, changed T3 58/58 once, all12 new injected OS/outcome identities and original root/reuse controls pass. C1 verified. Linux executor versus injected Darwin facts distinguished; host reuse, report-only ratchet/duration/lint warnings and absent remaining T3/T4 retained. No historical full-run reproduction claim.

Criteria: C1 verified.

### coord · 2026-10-29T19:45:31.315Z

Merged a1f2fe09623999bbdff12223563b5eeae92a33fa onto dev.
