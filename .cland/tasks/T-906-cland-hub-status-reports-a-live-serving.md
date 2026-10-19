---
id: T-906
kind: task
title: cland hub status reports a live, serving hub as 'does not answer' (hub.status slower than the probe timeout)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-647
branch: t/T-906-cland-hub-status-reports-a-live-serving
created: 2026-10-19T20:06:03.703Z
updated: 2026-10-19T20:53:21.402Z
closed: 2026-10-19T20:53:21.402Z
---

## Summary

On 2026-10-19, with about 40 sessions, `cland hub status` reported "pid … holds hub.json but does not answer" for a live, serving hub (pid 14662 before restart #21 and pid 98217 after it). Other requests (`session list`, `merge queue`, `verify queue`) answered within 0.15 s. The CLI's `hub.status` request (socket-client `probe`) exceeds its timeout, so `hub status` and `hub start`'s live check misreport a healthy hub as mute.

## Acceptance criteria

- [x] C1. (T1/T2) `hub.status` answers within the probe's timeout for a hub with 40 sessions and a 200 MB log, or the probe uses a lightweight liveness request and `hub status` fetches the full status separately. A test with a slow status computation shows that `inspect` still reports the hub live.
  - done: impl-906b · 2026-10-19T20:32:59.960Z
  - verified: rev-30 [reviewer] · run rev-20261019-906-final · 2026-10-19T20:48:17.254Z · commit 3cb226a2637c16d1ed31a1a7fe452944abd8cee0
- [x] C2. The slow part of `hub.status` is identified and named in the item (for example executor or session probing), with its measured time.
  - done: impl-906b · 2026-10-19T20:33:00.443Z
  - verified: rev-30 [reviewer] · run rev-20261019-906-source · 2026-10-19T20:34:22.037Z · commit 3cb226a2637c16d1ed31a1a7fe452944abd8cee0
  - verified: rev-30 [reviewer] · run rev-20261019-906-final · 2026-10-19T20:48:17.254Z · commit 3cb226a2637c16d1ed31a1a7fe452944abd8cee0

## Comments

### impl-906b · 2026-10-19T20:32:17.457Z

C2 diagnosis: slow part is shared/socket-client.ts accumulated-string response framing, not server status computation. Live status had ~13.16 MB across 1,226 suites, ~12.19 MB historical selections. Original shared reads took 2,715 / 6,825 / 4,114 ms; raw socket received in 191 ms plus 14 ms JSON parse. Patched reader: 211 ms full status; authenticated handshake liveness 54 ms. Original live CLI repro now succeeds. No live hub lifecycle actions performed. Regression evidence is posted in the item topic.

### rev-30 · 2026-10-19T20:34:22.037Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-906-source
commit: 3cb226a2637c16d1ed31a1a7fe452944abd8cee0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6646. Existing authenticated hello/welcome now establishes boolean liveness; full status is fetched separately with running:true/statusError fallback. Shared parser scans new chunks and joins complete frames once, retaining actor/auth/id/error/timeout behavior and required probe callers. C2 named/measured client-framing diagnosis is recorded in task/A-6642 (qualified claimant measurements). C1 awaits exact-head mode-free overall green and all3 fresh T2 controls ordinary/five repetitions within budget/no owned resource trip; targeted/startup/import results reported but raw not independently audited. QA none.

Criteria: C2 verified.

### rev-30 · 2026-10-19T20:48:17.254Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-906-final
commit: 3cb226a2637c16d1ed31a1a7fe452944abd8cee0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6678. Independent raw A-6676/b0ed9f76 audit: 1846/1846, zero fail/cancel/skip/TODO; all 254 load groups 5/5, no tier/resource mismatch or owned overrun. Three fresh liveness/timeout/fragmented-response T2 controls each pass ordinary+five repetitions, maximum .367760190 s. Source A-6646 establishes lightweight authenticated welcome alternative and separate full status, settling C1. C2's named client-framing bottleneck and measured times remain recorded as qualified claimant measurements; no new benchmark claim. Covered report-only rows follow Coordinator 798ff31d. C1/C2 verified; QA none; no Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T20:53:21.402Z

Merged be65ee85b11e5cf51395b4deafedf17bff83ddfb onto dev.
