---
id: T-1155
kind: task
title: Hub-merged session rows read whole presence synchronously under 100-frame verifier bursts (T4 load)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by: []
regression_of: T-1147
topic: topic-868
branch: t/T-1155-hub-merged-session-rows-read-whole
created: 2026-10-22T21:12:18.826Z
updated: 2026-10-22T21:51:28.272Z
closed: 2026-10-22T21:51:28.272Z
---

## Summary

The stage cover f62a15ea at 5cdfb704 (A-9459, Linux shard-2) failed T4 `hub/test/inbox-verifier-load.test.ts` › "100-frame verifier delivery bursts never scan retained message history" with `100 deliveries and 100 explicit views allow no synchronous whole-presence reads (302 pending reads)`. Locally on macOS it passes at de40ac3c^ and fails at de40ac3c (T-1147) and at 5cdfb704. T-1147's own fix kept the 8-delivery T2 workload under its bound, but this T4 load variant, which runs only in covers, still sees the merged-row projection read whole presence per delivery or view.

## What to build

The merged session-row projection reuses connected presence already loaded for the burst, or batches its reads, so 100 deliveries and 100 explicit views cause no synchronous whole-presence reads. `session.list` rows and snapshots stay unchanged.

## Acceptance criteria

- [x] C1. The named T4 test passes in a targeted run at the head, with its receipt (platform and pending-read count) posted in the item topic (test).
  - done: impl-1155 · 2026-10-22T21:16:55.939Z
  - verified: rev-23 [reviewer] · run rev-20261022-1155-final · 2026-10-22T21:46:37.153Z · commit fcc8f44e5141c29e8de68e6dd43df1523861d062
- [x] C2. The 8-delivery T2 workload in hub/test/inbox-workload.test.ts and T-1147's archived-rows tests pass unchanged (test).
  - done: impl-1155 · 2026-10-22T21:16:56.128Z
  - verified: rev-23 [reviewer] · run rev-20261022-1155-final · 2026-10-22T21:46:37.153Z · commit fcc8f44e5141c29e8de68e6dd43df1523861d062

## Comments

### impl-1155 · 2026-10-22T21:13:46.632Z

Red/green: named T4 failed before source edits with 302 pending reads. Cause: merged row presence reread work already loaded by process views. Reuse only running process facts matching live session id/name/role, preserving presence for stopped or unmatched sessions. No payload fields or row membership change. Existing assertion bounds and fixtures retained; one diagnostic reports per-burst counts. Initial base was 3fb4bcb7 (contains 5cdfb704), then fetched/fast-forwarded origin/dev b0ab7be3 before first review.

### rev-23 · 2026-10-22T21:15:59.228Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1155-source
commit: a7878950744c9c92eb2ec012621439cd8c62019f
scope: full
findings: [{"severity":"medium","text":"sessionRows passes cached #heartbeatProcesses into the fresh-work reuse path. After pending/holds change without reseeding, presence() is current but default sessionRows() can drop new pending or retain old pending/holds (presence reuse at line 1738). Restrict reuse to fresh views and cover the cached default-core seam.","file":"hub/src/hub/core.ts","line":672}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear: one medium M1, confirmed by implementer eaddfefb. The optimized Sessions.list fresh-view path and identity/status guards are otherwise sound; workload fixtures/assertions/bounds unchanged, diagnostic only. Add a regression for pending/holds changing after a running process is seeded, and restrict reuse to fresh projection views. A-9462 local targeted 22-pass summary and T4 counts 201/200/100 are not a full/Linux/Web or load-gate receipt. C1 unverified, C2 failed. Corrected-head source review must precede Coordinator verify all; no Reviewer tests or edits performed. Detailed artifact posted in topic-868.

Criteria: C2 failed (Default-core merged rows can reuse stale pending/holds from cached heartbeat process facts, violating unchanged projection semantics.).

### rev-23 · 2026-10-22T21:17:38.280Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1155-source-2
commit: fcc8f44e5141c29e8de68e6dd43df1523861d062
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 from A-9463 resolved. Only explicit fresh process views feed work-fact reuse; default cached process rows now retain fresh presence pending/hold lookups. New default-core T1 regression covers pending capture/clear and hold acquisition/release after stale seeding. Explicit Sessions.listRows/snapshot paths preserve the optimization; existing identity/status guards, workload bounds and archived/legacy assertions remain intact. No remaining findings. C1/C2 runtime marks remain pending Coordinator verify all at this exact head. A-9464 is local targeted evidence only, not full/Linux/Web or load-gate proof. No Reviewer tests/edits. Detailed source audit posted in topic-868; after-stage QA and landing remain separate.

### impl-1155 · 2026-10-22T21:17:47.069Z

Corrected head fcc8f44e5141c29e8de68e6dd43df1523861d062 source clear (rev-20261022-1155-source-2); M1 resolved by retaining fresh work reads for default cached-core projection. Added T1 regression red/green for pending and holds becoming stale. Exact-head local macOS Darwin arm64 Node24.21 targeted T4 1/1 (pending201/200/100), targeted verifier-resolver/inbox-workload/connection-snapshot25/25; npm typecheck passed same source tree. Receipts A-9464; source review A-9465. Coordinator notified to run requested exact-head verify all; no suite receipt yet, no merge, claim retained.

### rev-23 · 2026-10-22T21:46:37.153Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1155-final
commit: fcc8f44e5141c29e8de68e6dd43df1523861d062
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified at unchanged fcc8f44e. C1 original exact-head local Darwin arm64 T4 stdout A-9469 reports named test pass 1/fail 0 and pending reads 201/200/100; its separate subprocess exit was not emitted, and combined-cell exit 0 is not misattributed. C2 A-9468/03323f99 full Linux T1/T2/T3/Web exits 0: 3775 ordinary pass/8 skip, no failures/cancellations; original eight-frame counts 17/16/8 and archived-row/legacy equality pass unchanged. New T1 freshness regression has five distinct repeated passes and explicit 5/5. Host check 7220e797 reused remotely. Generic budgets/lint/resource/ratchet report-only; T3/Web exceed report wall budgets; no T4 in Linux all or after-stage QA claim. Detailed final artifact posted in topic-868. No remaining findings; Coordinator owns landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-22T21:51:28.272Z

Merged 64775b1144ebec704932b6fe0ab3c3bd6b8984dd onto dev.
