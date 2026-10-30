---
id: T-1487
kind: task
title: A role-addressed review request stays queued while reviewers are idle
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1426
found_by: review
topic: topic-1254
branch: t/T-1487-a-role-addressed-review-request-stays
created: 2026-10-30T13:33:21.942Z
updated: 2026-10-30T19:35:31.495Z
---

## Summary

A review request sent to the role `reviewer` was queued and never assigned for 49 minutes while all four reviewers were idle: impl-1485, msg 54536f6e, 2026-10-30 12:43:24Z, journal outcome `reviewer:queued`. It moved only when the Coordinator messaged rev-26 directly at 13:32Z. rev-26 confirmed the request never reached it; its previous T-1485 request had settled at 12:38Z. That was the same class T-1426 fixed, and it held a shared fix that blocked six items.

## Acceptance criteria

- [x] C1. A role-addressed review request queued while at least one reviewer is idle, including one that just settled a verdict on the same item, is assigned within the queue's stated bound, shown by a fixture that reproduces the 12:38→12:43 sequence and fails before the fix.
  - done: impl-1487 · 2026-10-30T19:34:19.518Z
- [x] C2. A queued request that stays unassigned past the bound posts one Agents notice naming the request, the idle verifiers and why each was not chosen.
  - done: impl-1487 · 2026-10-30T19:34:19.590Z

## Comments

### coord · 2026-10-30T13:37:48.308Z

Scope at 13:40Z: four more role-addressed review requests were queued and never assigned while reviewers were idle: T-1483 e556c7ff (12:42:39Z), T-1454 0f86ab3c (12:48:47Z), T-1462 94ba546d (12:51:09Z), T-1474 78ea2f63 (13:04:51Z), plus T-1485 54536f6e (12:43:24Z). Requests at 12:20–12:36Z were assigned normally. Assignment appears to have stopped around 12:40Z on hub 17875. Coordinator assigned each by direct message to a named reviewer at 13:40Z as the workaround.

### coord · 2026-10-30T13:46:53.020Z

13:46Z: the hub assigned the queued T-1462 request 94ba546d (sent 12:51:09Z) to rev-31, 55 minutes late, after rev-34 had already reviewed that item by direct address. So queued requests are released late, not lost, and they can land on a second reviewer after the work is done. The fix must cover stale assignment of already-served requests.

### coord · 2026-10-30T19:15:56.656Z

Live probes after hub restart #64 (hub pid 79176, serving 19:05:27Z, dev a10718ea5). Both role-addressed requests were delivered at once, with no stall:
1. Msg e9646889 (impl-1471, 19:07:42.200Z, topic-1223): sent to the idle previous verifier of T-1471. Outcome `reviewer:delivered`, rev-26 acked at 42.205 and injected at 42.238.
2. Msg 2c197891 (impl-1461, 19:13:51.527Z, topic-1250): `review request T-1461` on a new item with no previous verifier. Outcome `reviewer:delivered`, rev-26 hold at 19:14:04Z.

The original failure (msg 54536f6e, 12:43:24Z, `reviewer:queued`, 49 min) followed a verdict that had just settled on the same item at 12:38Z, on hub #63, which had run since 11:00Z. Reproduce that shape: same item, settle, then a new role request within minutes. Also try an uptime or queue-state precondition, such as an earlier queued entry or a hold left by the settled verdict. Neither fresh-hub shape reproduces.

### impl-1487 · 2026-10-30T19:18:24.855Z

Rule 20 inventory before changes: HubCore #requestVerifier/#drainVerifierRequests/#rememberVerification/clearPendingVerification and heartbeat/prune scheduling; Store queuedVerifierRequests/assign/drop/hasPendingWork/pendingVerifications; server.ts verdict callback; tracker lastVerifier/index authenticated verdict writers; adapters/sessions pool handoff and pending projection. Production notice consumers: generic Message.kind/detail, topic/history/presence/session.list, web and Neovim generic message rendering. Test consumers include verifier-routing (T2), verifier-resolver (T1), session-holds (T3), inbox-archive-workload and inbox-verifier-load (T4); docs issue-tracker/tests/verifier-routing/hub README and implement request procedure; QA briefs searched. No required wire field or old pending {item,kind} shape changes planned; new diagnostic uses generic verifier-request notice/detail and old clients continue generic rendering. C2 red: node --test --test-name-pattern=overdue hub/test/verifier-routing.test.ts fails expected notice count 1, actual 0 (macOS isolated projectHub/FakeClock; no browser/full suite). C1 basic verdict (clear and not clear) +5-minute same-item sequence passes, incident investigation continues.

### impl-1487 · 2026-10-30T19:22:14.385Z

C1 red reproduced at the public production frame seam: both 'a delayed request accepted after verdict cannot reserve an idle reviewer' and '...after newer request...' fail original behavior, actual to ['reviewer'], expected ['rev-a']. Refined 12:38→12:43 setup includes previous same-item not-clear plus a delayed different-item request already served by another verifier. Ordered-receipt retirement authorized by Coordinator decision b61b1113. Persisting request provenance beside unchanged pending {item,kind}; newer accepted requests and later same-kind durable verdicts retire stale reservations. Legacy rows begin at hub load time. Head-exact retirement needs pinned request head admission (follow-up idea; no prose parsing). No verifier-available explicit decline tool exists; no new tool/clause added.

### rev-31 · 2026-10-30T19:28:38.336Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261030-1487-source1
commit: a1ea485c999137cb4db2cb4338cbed1494b2c451
scope: full
findings: [{"severity":"medium","text":"M1: acknowledged free-text named request writes global supersession without authorized item-lead/Coordinator admission or matching verifier kind; unrelated sender can retire another reviewer's legitimate reservation. Capture and require authorized durable admission before global effects.","file":"hub/src/hub/core.ts","line":1907},{"severity":"medium","text":"M2: deterministic stalled diagnostic id advances AGENTS_JOURNAL_CHECKPOINT despite no agentsNotice journal row, suppressing pending lifecycle replay after crash/reopen. Separate deduplication/checkpoint semantics and preserve native Store reopen/pruning proof.","file":"hub/src/hub/core.ts","line":2897},{"severity":"medium","text":"M3: 1000ms queue/diagnostic maintenance sits inside serialized async heartbeat; held Coordinator durationWarnings keeps #heartbeatWork busy and skips subsequent ticks. Maintain queue independently and prove diagnostic before held warning release.","file":"hub/src/hub/core.ts","line":382}]
finding_counts: {"high":0,"medium":3,"low":0}

Consolidated source1 A-14648: three medium findings. Ordered-receipt/legacy/head-exclusion scope otherwise matches Coordinator b61b1113; source and diagnostics share candidate facts. A-14642/local26case/typecheck/lint summaries retain scope; no configured/Reviewer workloads. Correct same base, preserve original assertions/red-green, refresh marks and request source review before Coordinator-owned full verification.

Criteria: C1 failed (Global reservation retirement can be triggered by an unauthorized named first-line message.), C2 failed (Stalled diagnostic corrupts lifecycle replay boundary and can miss its bound behind async heartbeat work.).

### impl-1487 · 2026-10-30T19:30:52.680Z

Source1 M1–M3 fixed on the same reviewed base, no dev merge. M1 captured private messages.verifier_admitted receipt before delivery; only authorized matching-kind acceptance can update global supersession. Legacy queued requests without that field are reauthorized at assignment; old accepted pending projection is unchanged. Schema consumer inventory: Store migration/additive column, admission setter/getter, HubCore send/queue/ack only; toMessage/wire/startup/QA clients never expose/read the column. Existing role-queue restart controls explicitly NULL it and retain accepted-pending assertions. M2 dedup is an independent meta marker while queued, cleared at settlement, with no foreign Agents checkpoint id. M3 maintenance runs before the async heartbeat work guard on the owned timer.
Red receipts: unrelated named message removes rev-a pending (expected live reservation); persisted stalled diagnostic changes Agents checkpoint to verifier-stalled id (expected original lifecycle id); held warning control has 0 diagnostics before release (expected1). All three now green: verifier-routing27/27, agents-checkpoint8/8, heartbeat18/18, each file run sequentially locally on macOS arm64; root typecheck passes. No browser/full suite/remote run. T-1493/T-1494 are the separately filed head-pinning and decline Ideas.

### rev-31 · 2026-10-30T19:32:59.423Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261030-1487-source2
commit: dbedc3c16830e1ef4b9bfc3abe05ccfedd9b65dc
scope: full
findings: [{"severity":"medium","text":"M1 legacy named migration: pre-upgrade authorized Coordinator request queued by name has NULL verifier_admitted and bypasses role-queue upgrade on reconnect; ack is ignored, losing its live reservation. Preserve authorized NULL named admission using durable identity while rejecting unrelated legacy/current denied text; retain positive/negative reconnect regressions.","file":"hub/src/hub/core.ts","line":1900}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source2 A-14650: one remaining M1 legacy named migration gap. M2 checkpoint isolation and M3 maintenance before async heartbeat guard now source-sound with retained independent regression assertions. Private current-message admission/matching-kind negative control otherwise sound. Local routing27/checkpoint8/heartbeat18 summaries not configured proof. Correct same base, preserve red/green, refresh C1 and request source before Coordinator-owned full run; no Reviewer workloads.

Criteria: C1 failed (Authorized pre-upgrade named review delivery can be accepted without reserving its reviewer, allowing unrelated assignment.).

### impl-1487 · 2026-10-30T19:34:19.446Z

Source3 closes the remaining legacy named-delivery gap (source2 M1). Before fix, authorized pre-upgrade named delivery was durably delivered with pending undefined instead of {item,kind}; unrelated legacy control passed. New sends now store explicit0/1. Only legacyNULL is reauthorized using captured senderSessionId, current send permission, current item-lead/Coordinator authority and stored topic; missing durable identity remains ordinary delivery. Valid Coordinator legacy named delivery now reserves on reconnect; unrelated named legacy delivery remains unreserved. No wire change, same private-column consumers as source2, no dev merge. Source3 079b65a130a49372cc992585a0aa87d63a98105c pushed. Sequential local macOS focused files: routing29/29, checkpoint8/8, heartbeat18/18; root typecheck passes; no browser/full-suite/remote run.

### rev-31 · 2026-10-30T19:35:19.429Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261030-1487-source3
commit: 079b65a130a49372cc992585a0aa87d63a98105c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear A-14652. Current0/1 vs legacyNULL admission resolves M1: stable stored sender identity, current permission/item authority, matching recipient kind and persisted decision before supersession; authorized/unrelated legacy named tests retained. M2 independent diagnostic dedup/checkpoint and M3 maintenance before held heartbeat guard remain fixed. All original ordered-receipt/legacy and negative controls retained. Standards/Spec0 findings. A-14651 local routing29/checkpoint8/heartbeat18/typecheck/lint summaries not configured proof; no Reviewer workload. C1/C2 runtime pending. Report ready for Coordinator-owned verify all exact head, then final original-record review.

### impl-1487 · 2026-10-30T19:35:31.495Z

Ready for Coordinator full verification at frozen source3-clear head 079b65a130a49372cc992585a0aa87d63a98105c. Fresh fetch origin/dev=66cf804fb584f5630f0955f4baf1c8b07904587f; merge-tree exit0/tree fc8a25431b2c26a3f19ebf0e249e5348eb3f7af2, clean branch/pushed, no post-review merge. Source clear A-14652; local final evidence A-14651. Per routing launch exception, no Implementer suite enqueue: Coordinator owns full verification, then Reviewer owns original-record final evidence review. C1/C2 runtime verification pending; claim retained.
