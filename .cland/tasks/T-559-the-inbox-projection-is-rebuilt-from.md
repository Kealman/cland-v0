---
id: T-559
kind: task
title: The inbox projection is rebuilt from SQLite after every change, about 70% of the hub's CPU
state: open
status: review
size: M
criterion_seq: 3
labels:
  - v0.1.3
  - hub
  - bug
assignee: null
parent: E-425
blocked_by: []
topic: topic-351
branch: t/T-559-the-inbox-projection-is-rebuilt-from
created: 2026-10-16T01:14:12.317Z
updated: 2026-10-16T01:42:38.866Z
---

## Summary
A 25 s CPU profile of the live hub (pid 12296, 2026-10-16 01:11:58Z, taken by the stand-in; A-3539) shows self time almost all in SQLite: `all` 14.95 s, `get` 3.09 s, `prepare` 2.44 s, idle only 0.64 s. Inclusive project frames:
- `Inbox.list` (hub/src/hub/inbox.ts:204): 17.38 s, of which 14.42 s comes from the setImmediate callback in `Inbox.#changed` (inbox.ts:368), which recomputes the whole inbox after every change.
- Inside `list`: `store.inboxMessages` (store.ts:1368) 10.56 s and `store.topics` (store.ts:1188, via core.topics core.ts:421) 4.61 s.
- Second path: `eventsProject` (core.ts:469) → `list`, 2.95 s.

With about 20 live sessions and steady session-usage, state and announce traffic, the hub spends most of its time rebuilding the inbox. Tracker calls queue behind it: task.hold 26 s, suite.start 12 s, task.comment 8 s. T-548's journal scan is a separate cost; it didn't appear in this window, since no task.view calls ran. Same family as T-293's inbox.observe cost.

## Acceptance criteria
- [x] C1. Inbox changes are coalesced, so a burst of N changes causes at most one rebuild per short interval (for example 250 ms), or the projection updates incrementally from the changed rows. The inbox the human sees, and its ordering and counts, stay identical.
  - done: impl-559 · 2026-10-16T01:34:19.155Z
  - verified: rev-31 [reviewer] · run rev-20261016-559-source · 2026-10-16T01:42:38.866Z · commit 60f372722471d7f44f365f697f1a5cf604018a4a
- [x] C2. `store.inboxMessages` and `store.topics` don't rescan all rows per rebuild: an index, a bounded query or a cached topic list, with the query plan recorded.
  - done: impl-559 · 2026-10-16T01:34:20.613Z
  - verified: rev-31 [reviewer] · run rev-20261016-559-source · 2026-10-16T01:42:38.866Z · commit 60f372722471d7f44f365f697f1a5cf604018a4a
- [x] C3. A scratch load test (20 fake sessions, each sending usage, state and announce once a second for 5 s, against retained history of about 3k messages and 300 topics) shows p95 task.hold and task.comment under 250 ms, hub CPU at least 50% lower than the recorded baseline, and the inbox rebuild count per burst bounded by the coalescing window, not by the number of changes. Before and after numbers are recorded on the item.
  - done: impl-559 · 2026-10-16T01:34:24.479Z

## Comments

### impl-559 · 2026-10-16T01:19:42.831Z

Read task/epic/spec and A-3539. Profile replay: Inbox.list 17.379336 s / 25.192084 s (68.99%). Coordinator approved C3 bars in topic-351: 20 sessions, usage/state/announcements once per second for five seconds, ~3k retained messages/300 topics, hold/comment p95 <250 ms, CPU >=50% lower, record rebuild count. C1 cross-turn protocol regression prepared; Mac window currently free but 1-min load 15.61 >15, so baseline deferred.

### impl-559 · 2026-10-16T01:41:15.112Z

Implemented and pushed 60f372722471d7f44f365f697f1a5cf604018a4a on t/T-559-the-inbox-projection-is-rebuilt-from. A-3572 records reproductions, actual query plans, the retained-request-index limitation and loaded-comparison caveat (Coordinator accepted 67a82ba0). Before→after: CPU 9766.749→1240.284 ms (-87.3%); wall11.5439→4.9997s; rebuilds294→17; hold p95 97.062→0.501ms; comment p95 208.116→8.014ms. A-3574 is the raw 46/46 green compatibility log across all 3 hub inbox files, 2 topic files and all 3 nvim inbox files. Typecheck and diff check green. Fetched/merged origin/dev before first review, including shared2149fe33 manifest and T-547. New stable timestamp/departure test name has a measured16.2393s allowance for real project setup/publication/teardown. qaPolicy none/after-stage, no per-item QA criteria.

### rev-31 · 2026-10-16T01:42:38.866Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-559-source
commit: 60f372722471d7f44f365f697f1a5cf604018a4a
scope: full

Source clear at60f372722471d7f44f365f697f1a5cf604018a4a against90f4eb447938c375afeaeebbc55e3faa569c8bb6. Standards: no findings; existing machine classification, stable renamed test with reasoned16.2393s allowance, cancelled/unrefed timer, diff check clean. Spec: no findings. Fixed250ms publication window bounds cross-turn rebuilds; explicit reads/actions remain fresh. Lazy journal projection only materializes inbox for wait/plan suppression. Indexed candidate union retains unread human-addressed ranges, latest eligible topic rows, unanswered requests independent of read watermark, and durable waits needing departure. Final predicates/order/read/reply/visibility semantics preserved. Topic aggregation preserves unread/latest/standing/activity semantics and role warning sets while avoiding message scans.

C1/C2 verified using source and A-3574 actual query plans/protocol tests. All8 compatibility files46/46 green, including all3 Neovim inbox files, original timestamps/single transient departure, cross-topic request replies, restart/read/ordering and topic prune/migration. A-3572 scratch comparison inspected:CPU -87.3%,294→17 rebuilds,wall11.54→5.00s,hold/commentp95 0.501/8.014ms. Coordinator67a82ba0 accepts reported loaded-machine caveat; partial retained-request index scan is explicit. C3 remains unverified pending same-head post-source gate. No per-item QA criteria.

Full analysis A-3575: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3575-t-559-source-clear-bounded-inbox-publication-and-indexed-candidates.md. Proceed with Coordinator482c79e8 explicit droplet/fresh verify at this exact head. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified.
