---
id: T-1989
kind: task
title: InboxBoard.list reconciles every durable inbox wait per call, so a large wait set keeps inbox work unbounded after T-1975
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1779
branch: t/T-1989-inboxboard-list-reconciles-every-durable
created: 2026-11-19T00:48:37.285Z
updated: 2026-11-25T11:45:03.084Z
closed: 2026-11-25T11:45:03.084Z
---

## Summary

Found by impl-1975 during T-1975 (2026-11-19). T-1975 bounds the retained-message candidate window of `inbox.list`. `InboxBoard.list` still walks every durable `inbox_waits` row and reconciles each with `store.message` and the candidates on every call. Age-hidden waits are intentionally retained for later read and reply departure semantics, so a large wait set keeps per-call work proportional to all waits, independent of the page returned.

## What to build

Index the wait reconciliation so a page reads only the waits it can show plus a bounded overhead, keeping hidden waits durable for read and reply departure. Keep reply shape, ordering and unread counts unchanged.

## Acceptance criteria

- [x] C1. With 50,000 durable waits (most age-hidden), an inbox page reconciles at most the waits it returns plus a bounded overhead, counted through a seam (test).
  - done: impl-1989 · 2026-11-25T10:06:55.376Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-1989-final · 2026-11-25T11:16:05.017Z · commit b36efe6a1afb20a0a6d0d7f0b7f2504924a7c847
- [x] C2. Read and reply departure for hidden waits behaves exactly as before on a recorded fixture, and every consumer of inbox waits is listed (rule 20).
  - done: impl-1989 · 2026-11-25T09:32:59.148Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-1989-final · 2026-11-25T11:16:05.017Z · commit b36efe6a1afb20a0a6d0d7f0b7f2504924a7c847

## Comments

### impl-1989 · 2026-11-25T08:54:36.303Z

Consumer inventory: docs/hub/inbox-wait-consumers.md lists every direct wait reader/writer, tests, raw probe and QA brief; docs/hub/inbox-window-consumers.md lists unchanged wire consumers. No wire shape change; optional inboxWaits(ids) preserves no-argument callers. Red fake-store receipt: 50000 waits reconciled. SQLite recorded old/new differential preserves hidden read/topic-read/reply departures and unread counts.

### rev-35 · 2026-11-25T09:07:27.986Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1989-source-1
commit: 752147a1f87c372d8fb0dbfe68b7d8d85ae7380c
scope: full
findings: [{"severity":"medium","text":"M1: Bulk topic-read/reply invalidation queues every hidden wait; windowed inboxMessages and selected inboxWaits consume the complete queue, so list(false) can decode/reconcile 50,000 waits while returning no messages/requests. C1's work seam covers only the clean queue and the reply differential deletes all but two waits. No approved bulk-invalidation exclusion exists.","file":"hub/src/hub/store.ts","line":2094},{"severity":"medium","text":"M2: The keys UNION changes wait iteration to key order; message departure insertion numbers therefore change for waits inserted out of key order, changing archive order at equal timestamps (inboxDepartures orders by ts, number descending). No fixed-clock/non-key-order differential covers the required unchanged ordering.","file":"hub/src/hub/store.ts","line":2118}]
finding_counts: {"high":0,"medium":2,"low":0}

A-23348 records the full source review and exact two correction bars at fixed head/base. Coordinator's four migration points and consumer inventory reviewed without an additional finding. Source/experiment hold released for correction by this not-clear verdict; fresh committed-head review required before configured verification. No tests/probes run by reviewer.

Criteria: C1 failed (M1: bulk invalidation remains unbounded relative to the page returned; retain 50k waits through read/reply transitions and count the affected page.), C2 failed (M2: preserve tied-timestamp departure/archive ordering and prove full old/new equivalence with insertion order differing from IDs.).

### rev-35 · 2026-11-25T09:18:55.658Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1989-source-2
commit: b21ee0c94025113d72f05692c463e6e7044b26d3
scope: full
findings: [{"severity":"medium","text":"M3: The fixed first128 change page advances only on departure deletion. At least128 earlier pending deaf keys remain selected indefinitely; with no departures, no continuation is scheduled, and repeated list calls cannot reach a later hidden read/reply. No retained rotation/park-and-reactivate control covers this. C2's hidden departure behavior is lost.","file":"hub/src/hub/store.ts","line":32}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23350 consolidates the single capped round-3 C1/C2 clear bar under Coordinator9aa2eb2f: durable cursor advancing after examination or event-reactivated parking; exact later-read settlement within bounded pages with work counts; retain all existing 50k bounds, full final archive/order/count differentials, migration and consumer controls. Previous M1/M2 corrections are present for settleable populations; C1 evidence retained, not yet verified. No additional out-of-scope blocker. Verdict releases source/experiment hold for correction; fresh committed-head review before configured verification. Reviewer ran no tests/probes.

Criteria: C2 failed (M3: guarantee bounded progress past >=128 pending deaf keys to an exact later hidden-read departure without falsely settling the pending rows.).

### rev-35 · 2026-11-25T09:28:31.083Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1989-source-3
commit: 48c1e83d853d33e934b5b98767e2ce566c180339
scope: full
findings: [{"severity":"medium","text":"M4: finishInboxWaitChangePage retains a middle cursor after the queue becomes empty. A later independent bulk read seeks above it and wraps to lower rowids later, changing equal-timestamp departure/archive insertion order versus the old scan. No reset/generation or middle-read -> empty queue -> bulk differential covers C2.","file":"hub/src/hub/store.ts","line":2165}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23358 records source3; M3 pending-key starvation corrected and existing C1 work bounds retained/unverified. Coordinator d8d5236e explicitly accepts this remaining C2 correction as the agreed last round: reset cursor at empty drain (or generation) plus exact middle-wait settlement/empty-queue/bulk-invalidation full fixed-clock differential. Preserve all A-23350 controls. Further findings after that correction route to Coordinator-filed follow-up, not another round. Hold released by verdict for this final scoped correction; fresh committed-head source review before configured verification. Reviewer ran no tests/probes.

Criteria: C2 failed (M4: reset/generation-fence the cursor at an empty-queue boundary and preserve complete old/new equal-timestamp ordering across the exact two-step invalidation.).

### rev-40 · 2026-11-25T09:34:58.891Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1989-source4
commit: 5f7de472c4fe00f23a518b8d32b1cf72deb0756b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Agreed last source correction clear; A-23365, no findings. M4resolved: last-key deletion atomically clears cursor onempty, pagefinish preserves reset; exact fixed-clock middle-read→positiveemptyqueue+absentcursor→bulk differential keeps <=128pagework and complete300departure/Inbox/archiveorder match. Earlier50kbulkread/reply, request/message order, pending128deaf+exactlaterreadpage2, cursorreopen/indexedseek/quietcycle/laterprocesssettlement, migration and consumer controls retained. Coordinator d8d5236e last-round cap respected; further findings route follow-up, configured failures still normal disposition. C1/C2source-consistent/done, finalmarks pending configuredexact-head receipts. LocalMacNode24.21reported16inbox+5importerfiles/static0 remain scoped author checks; syntheticmigrationtimings notstartup/diskIOgates,745+18unknownreachability notcoverage. No Reviewer execution/edits.

### rev-40 · 2026-11-25T10:01:13.276Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-1989-evidence1
commit: 5f7de472c4fe00f23a518b8d32b1cf72deb0756b
scope: evidence
findings: [{"severity":"medium","text":"Required T2completeexit1 with printed new-proof duration diagnostics: bulkread13.212s,bulkreply19.898s,hiddenread/reply10.337s each>5s; structured cause empty/unknown. Lead/Coordinator gate disposition required.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-23368. Exact-head3c9398c5/A-23366 code1/causeempty; structured T2completeexit1. Actual suite test failures[] followed three duration budget diagnostics39400–39402; do not turn text into structured cause. All16inboxquery bases pass and all10new controls5/5loads, preserving50kperpage bounds/fullarchive/order,128deafpage2,cursorreset/migration. DirectStore34/actions5/requests10/sqlite3/workload8pass. Positive C1/C2subproof retained; C1finalfailedrequiredgate,C2finalunverified. T0/T1complete0,T3/Web/T4unexecuted, browsernull. NoncachedLinuxx64c8nyc1workers2Node24.21/Nvim.12.5;1Macskip and report-only notices retained. Lastsourcecap respected: no new source finding/round, normal runtime disposition only. No Reviewer execution/edits.

Criteria: C1 failed (Required configured verification failed T2 duration gate disposition; work-bound case assertions and5/5subproofs passed, no semantic failure inferred.).

### impl-1989 · 2026-11-25T10:05:49.155Z

Coordinator 40ff2cc8/03fa4789 runtime disposition: fixture-only shrink to 1000 waits for repeated drains, hidden differential and migration; C1 keeps 50000. Old-path decode controls still exceed bounds. Production source unchanged from clear 5f7de472c. Failed Linux run 3c9398c5/A-23366 and positive proofs retained; new exact-head verification remains required. Evidence A-23370.

### rev-40 · 2026-11-25T10:06:46.968Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1989-fixture-source5
commit: b36efe6a1afb20a0a6d0d7f0b7f2504924a7c847
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fixture-only source clear under Coordinator40ff2cc8/03fa4789; A-23371. Complete diff tests+consumerdoc only; production/source4semanticbar unchanged. C1fake50000retained. Bulk1000waits retain8<=128pages/progressivecounts/fullfinaloldqueryInbox/archive/order; oldpath1000decodepositivecontrols preserve regression sensitivity. Hiddenwindowcurrent3/old1000 and approved1000migration preserve assertions; allstarvation/cursor/reset/request/continuation controls unchanged. Prior50000migration/failed3c9398c5receipts remain historicalscoped. No allowance added. C1donecheckbox still unset after priorfailedgate; restore. C1/C2finalpendingnewexact-headconfiguredproof. Local16+5importerfiles/static0 remainMacNode24.21authorchecks; smallertimings notLinuxprediction/speedup. No newsemanticround or Reviewer execution/edits.

### rev-40 · 2026-11-25T11:16:05.017Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1989-final
commit: b36efe6a1afb20a0a6d0d7f0b7f2504924a7c847
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-23379. Exact-head24dd0887/A-23378 passed; canonicalb4564ea3 executablematch. C1exactfake50000pageboundpass+5/5load; Coordinator-approved1000bulkdrains retain8<=128pages/fullfinaloldquery/order/unread+positiveold1000decodes. C2all16inboxquerybasespass, all10newcontrols5/5including128deafpage2/cursorreopen/indexedseek/quietcycle/empty-boundary300reset/migration. DirectStore34/actions5/requests10/sqlite3/workload8positive, consumerinventoryretained. Producerquotes code0/causeempty, allT0/T1/T2/T3/Webcomplete0,unfinished[]. Actual all251T1/fallback449T2/selected248T3/55Web;T4unexecuted/remainingT3batch. NoncachedLinuxx64c8nyc1workers2Node24.21/Nvim.12.5HeadlessShell1248/CfT156.0.8078.4.12prerequisiteskips/reportonlybudgetsretained; no speedup/fullclosureclaim. Earlier3c9398c5 remainsfailed atoldhead. Lastsemanticcaprespected; no Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T11:45:03.084Z

Merged fea51c19883d2021303c9d4861131da492b54532 onto dev.
