---
id: T-1919
kind: task
title: Each injection completion rebuilds every unconfirmed delivery through an OR query that scans the session's whole delivery history (~13 s hub CPU per call with 74 pending)
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1566
branch: t/T-1919-each-injection-completion-rebuilds-every
created: 2026-11-16T16:27:53.597Z
updated: 2026-11-16T16:42:08.452Z
---

## Summary

cland-impl profiled hub 88226 on 2026-11-16 at 16:23Z (inspector, 0.5 ms sampling, 2,403 samples over 8 s). 62% of inclusive time was in `hub/src/adapters/sessions.ts` around line 3101: the `.finally` of `#inject` calls `store.uninjected(name)`, which rebuilds every 'delivered' row with a null digest_id for that session through `deliveryMessage` → `deliveryIds`. coord had 74 such rows (unconfirmed injections since restart #76; 76 more inject-unconfirmed after #77). `deliveryIds` (`hub/src/store.ts` around line 1369, `where d.session = ? and (d.message_id = ? or d.digest_id = ?)`) took 0.18 s per call: the OR makes the planner use `deliveries_recent (session=?)`, scan coord's 22,188 delivery rows, then sort. One `uninjected()` therefore costs about 13 s of hub CPU. During six Implementer launches, MCP calls timed out at 10 s and one `cland merge` at 60 s.

## What to build

Make `uninjected()` cost proportional to the pending rows rather than to the session's history. For example, `deliveryIds` becomes a UNION of the two indexed lookups (primary key and `deliveries_digest`), and the completion path checks with one indexed `select 1` whether its message is among the pending rows before it rebuilds anything. Rule 20: list every caller of `deliveryIds`, `deliveryMessage` and `uninjected`.

## Acceptance criteria

- [x] C1. With a session holding 20,000 delivery rows and 75 unconfirmed deliveries, one injection completion runs a bounded number of indexed queries, none of them a scan over the session's delivery history, and its delivery results are unchanged (test, red before the fix; query plan or a counted fake store as the measure).
  - done: impl-1919 · 2026-11-16T16:38:52.371Z
- [x] C2. `deliveryIds` returns the same ids as before for message-id matches, digest-id matches and both together (test).
  - done: impl-1919 · 2026-11-16T16:38:53.597Z

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
