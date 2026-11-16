---
id: T-1919
kind: task
title: Each injection completion rebuilds every unconfirmed delivery through an OR query that scans the session's whole delivery history (~13 s hub CPU per call with 74 pending)
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1566
branch: t/T-1919-each-injection-completion-rebuilds-every
created: 2026-11-16T16:27:53.597Z
updated: 2026-11-16T22:04:39.043Z
closed: 2026-11-16T22:04:39.043Z
---

## Summary

cland-impl profiled hub 88226 on 2026-11-16 at 16:23Z (inspector, 0.5 ms sampling, 2,403 samples over 8 s). 62% of inclusive time was in `hub/src/adapters/sessions.ts` around line 3101: the `.finally` of `#inject` calls `store.uninjected(name)`, which rebuilds every 'delivered' row with a null digest_id for that session through `deliveryMessage` → `deliveryIds`. coord had 74 such rows (unconfirmed injections since restart #76; 76 more inject-unconfirmed after #77). `deliveryIds` (`hub/src/store.ts` around line 1369, `where d.session = ? and (d.message_id = ? or d.digest_id = ?)`) took 0.18 s per call: the OR makes the planner use `deliveries_recent (session=?)`, scan coord's 22,188 delivery rows, then sort. One `uninjected()` therefore costs about 13 s of hub CPU. During six Implementer launches, MCP calls timed out at 10 s and one `cland merge` at 60 s.

## What to build

Make `uninjected()` cost proportional to the pending rows rather than to the session's history. For example, `deliveryIds` becomes a UNION of the two indexed lookups (primary key and `deliveries_digest`), and the completion path checks with one indexed `select 1` whether its message is among the pending rows before it rebuilds anything. Rule 20: list every caller of `deliveryIds`, `deliveryMessage` and `uninjected`.

## Acceptance criteria

- [x] C1. With a session holding 20,000 delivery rows and 75 unconfirmed deliveries, one injection completion runs a bounded number of indexed queries, none of them a scan over the session's delivery history, and its delivery results are unchanged (test, red before the fix; query plan or a counted fake store as the measure).
  - done: impl-1919 · 2026-11-16T17:12:16.750Z
  - verified: rev-35 [reviewer] · run rev-35-1919-final-1 · 2026-11-16T18:27:50.858Z · commit 470f3f69922fd6bd76b6b02b6b455a8345b6e788
- [x] C2. `deliveryIds` returns the same ids as before for message-id matches, digest-id matches and both together (test).
  - done: impl-1919 · 2026-11-16T16:38:53.597Z
  - verified: rev-35 [reviewer] · run rev-35-1919-final-1 · 2026-11-16T18:27:50.858Z · commit 470f3f69922fd6bd76b6b02b6b455a8345b6e788

## Comments

### impl-1919 · 2026-11-16T16:29:45.214Z

Rule 20 inventory (rg function/field names across repository, shipped skills, QA, tests): deliveryIds callers: Store.deliveryMessage, Store release/drop pending path; HubCore injection start/confirmed/uncertain and ack handling. deliveryMessage callers: Store release delivery and uninjected; HubCore dispatch; Sessions.#inject; store.test.ts. uninjected callers: Sessions hold recheck, idle retry, injection finally; inject-stalled.test.ts. Output consumers: HubCore delivery/log emission and resolveAttachments -> Connection deliver/role -> protocol Message.digest -> adapters and spoke/web/history rendering; history retains individual messages; QA T-108 M13 asserts digest coalescing/cap. References docs/hub/adapters-and-sessions.md, docs/hub/running.md, docs/agents/tests/hub-test-host-records.test.ts.md. No wire shape, ordering, digest membership, coalescing or old-client contract changes; existing full core/store/inject and rendering/QA regressions remain applicable. New Store predicate will share uninjected eligibility SQL. No new index/schema migration.

### impl-1919 · 2026-11-16T16:32:25.555Z

Additional Rule 20 output traversal: Message.digest has consumers hub/src/adapters/{contract,opencode,codex,sessions}.ts and hub/src/spoke/spoke.ts; protocol Message remains unchanged. Regressions include hub/test/{progress,heartbeat,topic-withdraw,inject-stalled}.test.ts and hub/src/hub/store.test.ts, QA T-108 M13. Web and Neovim consume individual history/delivery-stage rows, not deliveryIds or reconstruction; no wire changes. Completion red: expected 0 unrelated deliveryMessage reconstructions, actual 74 after durable injected receipt. After predicate change targeted completion green. Entire Store file 32/32 green locally on macOS Node v24.21.0; synthetic 20k/75 uninjected wall 3.13ms (setup excluded), plans bounded by state or exact key. T3 deferred to merge/integrated cover per assignment.

### impl-1919 · 2026-11-16T16:37:56.941Z

Final implementation scope: deliveryIds and markInjected share DELIVERY_ROWS, a UNION of primary-key and deliveries_digest rowid lookups; UNINJECTED eligibility is shared by list and single-root check. The list pins deliveries_session so injected rows with null digest_id do not widen its scan. No wire/schema/default/permission change. Source remains based on current origin/dev (fetch/merge already up to date before first review). Final targeted checks: store.test.ts 32/32, inject-stalled.test.ts23/23, root typecheck exit0, macOS arm64 local Node24.21.0; browser not run. Whole-source test:lint/closed-item lint completing before commit/review. A-20259/A-20270 contain actual red failures and query plans. Suite not yet run; source review then coordinator-granted verify window; T3 deferred to batch/integrated cover as instructed.

### rev-35 · 2026-11-16T16:42:08.452Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1919-source-1
commit: c282e059aec03ebfff9bfba4726cdcd5f406ca24
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Complete four-file Standards/Spec source pass clear A-20276. Shared indexed rowid UNION preserves membership/session scope/order and confirmation identity checks; shared UNINJECTED preserves list/exact predicate equivalence; finally avoids unrelated pending reconstructions. Existing indexes/schema/API/wire/policy unchanged. New controls cover20k/75 plans, confirmation path, digest overlaps/order and one predicate/zero unrelated rebuilds after durable completion. Pure in-memory/FakeClock/registered disposal, no real lifecycle or wall deadline added. A-20259/70 red-plan/rebuild failures and A-20274 candidate32/32+23/23/static summaries retained with local synthetic timing and unknown source/raw/native provenance limits; retention supplement requested without rerun. C1/C2 done but unverified until configured same-head evidence. Hold released, mode-free verify at exacthead in Coordinator window; T3 deferred to assigned merge/integrated cover. No Reviewer runtime.

### impl-1919 · 2026-11-16T17:07:48.086Z

Final native receipt correction (Reviewer question abd76c52, A-20299 line292): markInjected state UPDATE selected deliveries_topic_waits(state=?), not an outer exact-rowid lookup. The UNION membership subquery is indexed but does not force the UPDATE planner. Existing plan regex allows state-only scans, and the20k history fixture seeds injected rows, so its green result does not establish C1 with retained uncertain or unrelated-session delivered populations. No bound on those populations has been established. Earlier 'primary-rowid outer lookup' claim is superseded. Head c282e059a remains pinned; no experiments or source changes while Reviewer classifies.

### rev-35 · 2026-11-16T17:08:35.854Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1919-evidence-1
commit: c282e059aec03ebfff9bfba4726cdcd5f406ca24
scope: evidence
findings: [{"severity":"medium","text":"Actual A-20299:292 confirmation UPDATE uses deliveries_topic_waits(state=?) outer scan, not exact membership rowids. It can traverse retained uncertain/cross-session delivered populations without a bound. Synthetic unrelated history is injected and test regex permits state-only plans, so C1 remains unproved. Bound outer update to membership and strengthen retained-uncertain/cross-session regression; implementer confirms no guarantee. Prior source claim of universal rowid outer access is superseded.","file":"hub/src/hub/store.ts","line":1257}]
finding_counts: {"high":0,"medium":1,"low":0}

Same-head evidence NOT CLEAR A-20301. Green A-20299 remains5081ordinary passes/549files+20load positives/nofail/cancel/skip; all four new identities base+5, Store/injection and selected downstream files positive. Actual plan292 exposes one source/measure gap; no Reviewer probe. C1failed,C2done/unverified. T0/all224T1/323selectedT2/1T4base/Websmoke executed;104T2/269T3/16T4/54Web unexecuted, noT4repeat. Exactprovenance27690 norm49e33db6 Linuxx64Node24.21uncached and actualbrowser27567 isolated1248/CfT156 checked. Report-only gates and A-20278 original75-vs20k/precommit/raw/hash/signal/scan limits retained. Hold released for consolidated outer-bound fix/stronger control then fresh committed-head source review before new granted-window verify; preserve green suite/contrary plan.

Criteria: C1 failed (Actual native confirmation plan is state-only, permitting unbounded unrelated retained delivered/uncertain rows that the current workload/assertion excludes.).

### impl-1919 · 2026-11-16T17:11:54.450Z

A-20303 retains revised C1 red/green: receiver20k rows (75 pending plus uncertain/injected), extra20k elsewhere-delivered rows; strict outer UPDATE plan check fails on prior deliveries_topic_waits(state=?). Source fix NOT INDEXED on both outer confirmation UPDATEs leaves shared indexed membership UNION intact. Revised query plans show exact rowid outer lookups for both state and session_id updates; unrelated uncertain and cross-session delivered rows stay unchanged. Full Store32/32 and injection23/23 pass locally; root typecheck exit0; final source lints underway. No dev merge after initial review, no schema/wire change, no new suite yet. Original A-20299 green5081 and contrary plan retained; C1 fix needs fresh review and verification.

### rev-35 · 2026-11-16T17:13:31.876Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1919-source-2
commit: 470f3f69922fd6bd76b6b02b6b455a8345b6e788
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Complete two-file outer-bound repair/context clear A-20304. Both NOT INDEXED outer UPDATEs retain shared keyed UNION membership and original state/recipient predicates. Strengthened receiver20k/75+20kcross-session state workload asserts both exact outer-rowid plans and unrelated delivery preservation, rejecting state/session history scans. A-20303 retained actual contrary-plan red/native1 then rowid-plan green/native0/Store32/32; request records injection23/23/root static exit0. Precommit/tool-excerpt/raw/hash/signal/architecture/scan limits retained A-20278; no newheadfullsuite. Old greenA-20299 and contrary292/not-clearA-20301 preserved, not C1proof. C1/C2 done/unverified. Hold released; mode-free verify exacthead in Coordinator window then inspect actual plans during final same-head settlement. No Reviewer runtime or dev merge.

### impl-1919 · 2026-11-16T17:32:39.301Z

Repair verify8ca3360e/A-20317 inconclusive: remote machine lost. T0/T1 completed; T2 interrupted; mapped T4/Web unexecuted. Linux x64 droplet c-8 sfo2, lifetime970s/cost$0.0673. Partial native receipts separately checked: lines294/295 BOTH markInjected UPDATEs outer SEARCH deliveries USING INTEGER PRIMARY KEY(rowid=?), inner UNION keyed PK/digest. All4 new case timing outcomes pass, including enlarged workload and completion; these remain partial evidence, not full green. Source470f3f699 unchanged; source-clear A-20304 current. Coordinator asked for infrastructure retry/window; no resubmission yet.

### rev-35 · 2026-11-16T17:33:47.688Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1919-evidence-2
commit: 470f3f69922fd6bd76b6b02b6b455a8345b6e788
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Failed-evidence pass complete A-20319: A-20317 autoexit1/remote machine lost, T2 interrupted at merge-recovery file and merge-queue due case306s, no completed failing test; no source defect/physical-cause classification inferred. Actual294/295 both repaired outer UPDATE plans are INTEGER PRIMARY KEY(rowid), inner keyedUNION; all4new names ordinary+5load positive. SourceA-20304 unchanged/valid, no sourcefinding. C1/C2 remain done/unverified, not failed solely for infrastructure loss.3396ordinary tests/382completefiles+20load positives=printed3416completed; T0/T1 complete, T2partial, T4/Web unexecuted,T3deferred. Exactprovenance18615 norm1c054762 Linuxx64Node24.21uncached/browsernull; report-only/original provenance limits and older contrary-plan history retained. Hold released; replacement only after Coordinator infrastructure disposition/granted window, no Reviewer retry authorization/submission or runtime.

### rev-35 · 2026-11-16T18:27:50.858Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1919-final-1
commit: 470f3f69922fd6bd76b6b02b6b455a8345b6e788
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear A-20334; complete named-plan/992manifest ledger A-20333. A-20332 independently5081ordinary passes/549files+20load positives, nofail/cancel/skip. All4new names ordinary+5; actual294/295 BOTH outer INTEGER PRIMARY KEY(rowid) with keyed innerUNION, stronger retained-uncertain/cross-session workload and durable completion/count assertions preserve semantics. Prior state-only finding resolved. C1/C2verified. T0/all224T1/323selectedT2/1mappedT4base/Websmoke complete;104T2/269T3/16T4/54Web unexecuted, noT4reps. Downstream progress/heartbeat/topic-withdraw file receipts positive; QA/native/transitive limits retained A-20278. Exactprovenance27711 norm1c054762 Linuxx64Node24.21Nvim0.12.5uncached, actualbrowser27578 isolated1248/CfT156.0.8078.4; report-only advisories not enforced gates. Old A-20299 contrary-plan green/A-20301 notclear and A-20317 infrastructure partial/A-20319 retained; Coordinator35fb5a80 infrastructure disposition accepted. Original producer/raw/hash/signal/search limits unchanged, no benchmark/liveCPU claim. Hold released; Coordinator owns ready/enqueue/landing. No Reviewer runtime or extra run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T22:04:39.043Z

Merged 2bdf1ff0f584f52e4ca28b84d0391cfd650ecc62 onto dev.
