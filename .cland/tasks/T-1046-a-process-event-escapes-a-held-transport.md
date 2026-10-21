---
id: T-1046
kind: task
title: A process event escapes a held transport after the numbered-delta emit point
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
regression_of: T-985
topic: topic-798
branch: t/T-1046-a-process-event-escapes-a-held-transport
created: 2026-10-21T11:33:00.471Z
updated: 2026-10-21T11:50:32.032Z
closed: 2026-10-21T11:50:32.032Z
---

## Summary

The periodic dev T3 run c2965396 at b970270a (A-8338) failed `hub/test/session-events.test.ts` "rename before the spoke welcome waits; after welcome its process event survives a held transport" with "the process frame escaped the transport hold" (line 53). The last green was 479178b2. The merges in between that touch event emission are T-985, numbered deltas from one emit point (aeae1f25), which moved emission to queued fan-out, and later T-986 (40d0583f, not in the red head). The regression is attributed to T-985 pending confirmation.

## What to build

A transport hold keeps holding every frame emitted while held, process events included, under the single emit point and its queued fan-out. Confirm the culprit with the failing test at aeae1f25 and at its parent, then fix the emit path rather than the test. Check the result at current dev, which includes T-986's ring and replay.

## Acceptance criteria

- [x] C1. `hub/test/session-events.test.ts` passes with its assertion unchanged in a targeted T3 run at the task head (local evidence); the next periodic dev T3 confirms it after landing.
  - done: impl-1046 · 2026-10-21T11:36:51.989Z
  - verified: rev-26 [reviewer] · run rev-20261021-1046-final-1 · 2026-10-21T11:47:07.555Z · commit 1ac1384e4cd881e4fef4836c64620d38f399521e
- [x] C2. The T-985 and T-986 frame-order tests (connection-resume, connection-resync, model-output and model-ring) still pass.
  - done: impl-1046 · 2026-10-21T11:36:52.006Z
  - verified: rev-26 [reviewer] · run rev-20261021-1046-final-1 · 2026-10-21T11:47:07.555Z · commit 1ac1384e4cd881e4fef4836c64620d38f399521e
- [x] C3. The cause is named in the item topic: the commit and the code path the frame took around the hold.
  - done: impl-1046 · 2026-10-21T11:36:52.020Z
  - verified: rev-26 [reviewer] · run rev-20261021-1046-source-1 · 2026-10-21T11:38:23.066Z · commit 1ac1384e4cd881e4fef4836c64620d38f399521e
  - verified: rev-26 [reviewer] · run rev-20261021-1046-final-1 · 2026-10-21T11:47:07.555Z · commit 1ac1384e4cd881e4fef4836c64620d38f399521e

## Comments

### impl-1046 · 2026-10-21T11:34:28.163Z

Historical red/green on local darwin Node v24.21.0, disposable independent clones and sealed shared fixture environment: node --test --test-name-pattern='rename before the spoke welcome' hub/test/session-events.test.ts passes at 102d592dadffabda064f3af376ed7cd9739acb36 (T-985 parent), fails at aeae1f25cca0c0e9d99d0575b339e06856d0ef58 with AssertionError [ERR_ASSERTION]: the process frame escaped the transport hold (session-events.test.ts:53:99). These targeted T3 runs are not suite/gate receipts.

### rev-26 · 2026-10-21T11:38:23.066Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1046-source-1
commit: 1ac1384e4cd881e4fef4836c64620d38f399521e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, Standards/Spec A-8350. Confirmed culprit aeae1f25 parent102d592d and path: sendSerialized bypassed the wrapped Peer.send holding session.process; same bypass existed in ModelOutput live/replay. Cause named in topic/A-8343 with actual historical failure. C3 verified. Single send(frame, optionalCachedJSON) boundary now covers legacy/live/replay and all four production edges, preserving cached bytes/newline framing and ModelOutput pre/post bufferedBytes checks; no sendSerialized references remain. Unchanged session-events assertion and serialization-count assertions retained; only fixture signature changed, no new tests/tiers/processes. Diff check clean, no findings. A-8346 exact-head local Darwin targeted T3 summaries2/2 and A-8347 targeted ordering/encoding23/23 audited; logs omit separate process exit statuses, original tool-status supplement requested, no rerun. No task-gate/budget/Linux/Web pass inferred. C1/C2 await final settlement from same-head configured receipt plus the criterion-authorized targeted T3 evidence. QA policy none. Proceed mode-free verification at this exact unchanged head.

Criteria: C3 verified.

### rev-26 · 2026-10-21T11:47:07.555Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1046-final-1
commit: 1ac1384e4cd881e4fef4836c64620d38f399521e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; A-8361 audits same-head A-8360/run cb57566d plus A-8346/A-8347/A-8352. C1 unchanged session-events targeted T3 file passes 2/2 locally on macOS Node24.21, exact head/tree and original process exit0 captured; periodic dev confirmation remains post-landing. C2 configured Linux x64 c-8 lon1 droplet receipt exits0 with 2,272 ordinary passes in 348 files, all T1/full fallback T2 both packages. Requested resume3/resync4/snapshot11/output2/ring3 files all pass (23 cases). Paused-reader ordinary 1.920323569s. No load-gate test finishes recorded; do not infer repetitions from setup text. C3 source-established culprit aeae1f25/sendSerialized bypass retained; historical commands/exits/tree attribution now supplied by A-8352 (parent exit0, culprit and pre-fix descendant exit1). No findings. Host check21dcfb88 not repeated remotely; duration/test lint/ratchet report-only, zero refusals. Web explicitly NOT RUN/missing Linux libraries/T-993, no browser pass. T3 absent from task gate; C1 relies only on criterion-authorized local targeted evidence. No T4/stage/QA or post-landing periodic pass claimed. All C1–C3 verified at unchanged source-reviewed head.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T11:50:32.032Z

Merged 7997d3811f3adff040e198b300f9e71a397524e6 onto dev.
