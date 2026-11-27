---
id: T-2116
kind: task
title: claude-code-remote 'late SessionEnd after the recovery snapshot never grants an adopted closed receipt' fails with 'process authority unknown; stop requires host reboot or recycling' under Linux batch load
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1802
branch: t/T-2116-claude-code-remote-late-sessionend-after
created: 2026-11-27T00:29:03.616Z
updated: 2026-11-27T05:03:51.309Z
closed: 2026-11-27T05:03:51.309Z
---

## Summary

Merge batch b8983412 (T-2114 alone, run 68e9a39a, A-23669/A-23672 line 30367, 2026-11-27) failed `hub/test/claude-code-remote.test.ts::late SessionEnd after the recovery snapshot never grants an adopted closed receipt` in its base run and its load repetitions with `Error: process authority unknown; stop requires host reboot or recycling` (hub/src/host/agent-client.ts:27). impl-2114 showed that the host-agent stop path (AgentPrepared.prepare → AgentProcesses.captureForStop/#capture → its own ps group) does not import hub/src/system-processes.ts, so the T-2114 change is unrelated. The error originates at processes.ts:341/369 when retained process authority is unknown. The case passed 5/5 locally, and it passed in every earlier Linux run checked (A-23653, A-23657, A-23658, A-23661, A-23662).

## What to build

Find why the host agent's retained authority becomes unknown under Linux load in this case (a capture timing out, or a process group not observed) and make the stop resolve it, or report a named cause, rather than requiring a host reboot in a fake-backed test.

## Acceptance criteria

- [x] C1. The cause of "process authority unknown" in this case is named with a deterministic reproducer that fails first (test).
  - done: impl-2116 · 2026-11-27T03:45:40.630Z
  - verified: rev-35 [reviewer] · run rev-35-2116-evidence-1 · 2026-11-27T04:20:54.438Z · commit 7b7cfc073e054c4f3574a4f0a18abe6665491784
- [x] C2. The case passes in the item's Linux droplet verify (test).
  - done: impl-2116 · 2026-11-27T04:18:59.036Z
  - verified: rev-35 [reviewer] · run rev-35-2116-evidence-1 · 2026-11-27T04:20:54.438Z · commit 7b7cfc073e054c4f3574a4f0a18abe6665491784

## Comments

### impl-2116 · 2026-11-27T03:34:57.244Z

Deterministic red on macOS/Node 24.21.0: hold restore-claude recovery checkpoint, start prepare-stop, kill root and observe late TERM-resistant SessionEnd hook plus positive root exit, release checkpoint. Original reply-only assertion fails with exact `Error: process authority unknown; stop requires host reboot or recycling` (agent-client.ts:27). Cause is snapshot ownership ordering, not a ps timeout: capture can wait behind recovery, then reconcile persists unknown for the unowned writer before #capture. Coordinator decision a83a3352 retains production safety: after agent restart an uncaptured writer may detach descendants, so known-PID absence cannot grant closure. Implementing two deterministic orderings, keeping the unknown row/no closure/no unowned signal/private settings assertions. No production/shared contract change; test-file import search found zero importers (merge-queue.test.ts mentions a different case's metadata only).

### rev-35 · 2026-11-27T03:41:44.349Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2116-source-1
commit: 4fc22c6b1cf5251e4a7d0946534a61b7e9f2c8a2
scope: full
findings: [{"severity":"medium","text":"M1: both deterministic subcases observe only the entire proof; the complete fixture/turn/restart/connect/adopt/initial-restore setup has no separate named load-scaled deadline. Individual eventually waits do not cover that sequence; retain/join the original setup producer and late acquisitions when adding the bound (rule9).","file":"hub/test/claude-code-remote.test.ts","line":546}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-23711 records the consolidated review and correction bar. One medium standards finding M1, confirmed by Implementer62c81045. Coordinator a83a3352's intentional permanent-refusal safety disposition is respected; both checkpoint orderings and exact unknown-birth/removal-refusal/private-settings/no-hook-signal assertions are retained. Add a named shared load-scaled full setup observation that keeps the original continuation owned through late completion; preserve whole-proof owner, release-before-join, action bounds and final assertions. A-23710 remains authored local red/check evidence without independent raw/source-epoch receipts; no Linux execution is claimed. C1 failed for M1, C2 remains pending/unverified. Hold released for this correction; request fresh committed-head source review before configured verification. No Reviewer edits or runs.

Criteria: C1 failed (M1: deterministic reproducer subcases need a separate complete setup-observation bound while retaining the existing whole-proof/late-acquisition join.).

### rev-35 · 2026-11-27T03:47:01.020Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2116-source-2
commit: 7b7cfc073e054c4f3574a4f0a18abe6665491784
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23713 records the delta audit. M1 resolved by the complete named load-scaled setup wait through existing stageCase.wait: the original setup stays enrolled after observation expiry and is joined before fixture hooks, including late acquisitions. Whole-proof owner, pre-enrolled checkpoint release, action bounds and both orderings' exact unknown-birth/removal-refusal/private-settings/no-hook-signal assertions remain. Coordinator a83a3352's intentional permanent-refusal policy remains unchanged. A-23712 native output independently contains both subcase passes and55/55 file summary on the reported local macOS Node24.21 occasion; native exit/source epoch and fresh lint/typecheck exits remain reported scope. Original red A-23710 remains authored/transcript-backed, not reconstructed raw proof. Findings []; C1/C2 remain unverified pending exact-head Linux configured receipts. Hold released; request Coordinator window for normal mode-free verification. No Reviewer edits or runs.

### rev-35 · 2026-11-27T04:20:54.438Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2116-evidence-1
commit: 7b7cfc073e054c4f3574a4f0a18abe6665491784
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; A-23717 records independent b0722eed/A-23716/result.json audit. Producer code0/empty cause, unfinished[], complete exit0 T0/T1/fallback allT2/selected8T3/Web at recorded tree9460b85563593511cbff6fb5003cbba19b474ea4. Both fully qualified ordering subcases have paired pass finishes41827/41836; parent41838 pass7.764382804 test-seconds, changed file55/55. Supervisor timeout/abort, close-repair, partial-acquisition and five closest related files also pass. C1 cause/intentional-refusal proof combines reviewed deterministic source, original retained Linux fail24783/literal authority error30367 in A-23672 and current corrected passes; pre-fix test blob independently matches old failing run. A-23710 remains authored local red summary, not reconstructed raw epoch. C2 exact item Linux pass verified. One macOS prerequisite skip;268 otherT3/18T4 unexecuted, no load repetitions. Paired7857pass/1skip; known3 finish-only records separate. Advisory budgets/lint, cache unknown; no new allowance or source change. Findings []; C1/C2 verified, earlier run68e9a39a remains failed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-27T05:03:51.309Z

Merged 9db633e72e4d6a89762494fce17b7e1c5e228e28 onto dev.
