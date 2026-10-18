---
id: T-710
kind: task
title: cland merge enqueues a reviewed head into a hub-owned merge queue, behind [merge] queue
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by: []
topic: topic-488
branch: t/T-710-cland-merge-enqueues-a-reviewed-head
created: 2026-10-16T19:59:43.498Z
updated: 2026-10-18T09:19:33.870Z
---

## Summary

Decision 1: a hub-owned merge queue lands reviewed heads in batches of up to three, runs T3 once per batch and bisects red by file; the Coordinator's manual covers retire when it lands (memo §4 option c, §5.2.5). Today `cland merge` squashes a ready task onto `dev` at once, under the territory lock (`hub/src/hub/merge.ts` `TaskMerges.merge`). This ticket adds the queue's durable entries and their lifecycle; nothing lands from the queue until T-711.

## What to build

- **The switch.** `[merge] queue = false | true` in `.cland/config.toml`, default `false`. With `false`, `merge` behaves exactly as today.
- **Enqueue.** With `true`, `merge` (CLI and MCP) runs today's verdict gate and lane holds first. A task whose change touches only the override paths (tracker and docs, `MERGE_OVERRIDE_PATHS`) lands at once as today, and so does a human-shell override. Any other task becomes a durable entry `{ item, branch, head, verdict base, enqueued, by }` in the hub's database. The reply is `queued <position>`, and `task view` shows `merge queue <position> since <time>`. The item stays `ready` until it lands.
- **Visible.** `cland merge queue [--json]` lists the entries in order, and `hub status --json` includes them.
- **Dropped entries.** An entry is dropped with a `merge-queue-dropped` notice to its requester and lead, naming the reason, when its branch head changes, a not-clear verdict arrives, the item closes, or the requester's lead or the Coordinator runs `cland merge T-n --cancel`.
- **Durable.** Entries and their order survive a hub restart.

## Acceptance criteria

- [ ] C1. With `queue = true`, merging a reviewed code task replies `queued 1`, and `task view` and `cland merge queue` show the entry, proved by a merge test on `projectHub`.
- [ ] C2. With `queue = true`, a tracker-and-docs-only task and a human-shell override land at once with today's receipts, proved by merge tests.
- [ ] C3. A head change, a not-clear verdict, an item close and `--cancel` each drop the entry with `merge-queue-dropped` and the reason, proved by tests.
- [ ] C4. Entries and their order survive a hub restart, proved by a restart test.
- [ ] C5. With `queue = false` the existing merge-gate, merge-recovery and merge-checkout tests pass unchanged.
