---
id: T-306
kind: task
title: 'Archive by rule and prune: stopped crew sessions archive themselves, the "more" fold shows the latest 20, and cland session prune --older-than'
state: open
status: review
labels:
  - v0.1.2
  - ready-for-agent
  - hub
  - nvim
assignee: null
parent: T-275
blocked_by:
  - T-305
topic: topic-189
branch: t/T-306-archive-by-rule-and-prune-stopped-crew
created: 2026-10-12T21:34:31.521Z
updated: 2026-10-13T02:31:06.589Z
---

## Summary

The hub archives stopped crew sessions by rule. A session archives one hour after its item merged or closed, and otherwise 24 hours after it stopped. The human's Aides never archive automatically. The background "more" fold shows the latest 20 stopped sessions and the archived count. `cland session prune --older-than <duration>` deletes the hub's records of archived sessions and never the journal.

## Parent

T-275: Sessions: stopped sessions, verifiers' items, the queue line. Spec: `docs/spec/v0.1.2.md` §3.5, Cleanup (decided in T-257).

## What to build

**The rules.** For each stopped or exited, unarchived process-table row:

- **Implementer, Reviewer and QA.** The row archives one hour after its item merged or closed. Without such an item, it archives 24 hours after it stopped.
  - An Implementer's item is its launch item or its claim.
  - A Reviewer's or QA's item is the latest item it held. The hub records that item on the row when the session stops, since the holds are released then. A pool Reviewer's item is likewise the latest it held.
- **Lead and Coordinator.** These follow the 24-hour rule: they hold no item that merges.
- **Aides.** An Aide never archives automatically. Only `d` archives it.
- **Other sessions.** A row with no role follows the 24-hour rule.

An item "merged or closed" at the time of its merge record, or of its close when it never merged. Take that time from the tracker or the merge receipt, not from a scan of the journal per sweep. An item reopened before the window ends stops the clock.

**The windows.** They are configured in `.cland/config.toml`, for example `[sessions] archive_after_item = "1h"` and `archive_after_stop = "24h"`, read in `hub/src/init/config.ts` as `[verification]` is. The defaults are one hour and 24 hours. The test configuration shortens them to seconds. Use the same duration syntax as `--older-than`: `<n>s`, `m`, `h` or `d`.

**The sweep.** The rules run on a timer that the hub sets to the earliest due time, capped at once a minute, so that shortened windows archive within seconds without a test seam. They also run once at hub start.

- An item merge or close, and a session stop, schedule one sweep for the next tick. These triggers are coalesced, never one sweep per event (T-293).
- A sweep archives every due row in one write, journals one `session-archived` record per row with `by: "rule"` and the rule that applied, and publishes each changed row's `session.process` once.
- On the live store, about 250 stopped rows, the first sweep at start archives most of them in that single batch.

**The "more" fold.** The background fold in the sessions panel changes in two ways:

- Unfolded, it lists at most the latest 20 stopped sessions by stop time, newest first. Older unarchived ones fold into one line, `N older`.
- Its header shows the background count and the archived count, for example `▸ more (12) · 180 archived`.

The archived count comes from ticket 03's `session.list` count and from the `session.process` frames, never from fetching the archive.

**Prune.** `cland session prune --older-than <duration>` (frame `session.prune`) deletes the hub's records of archived sessions that stopped longer ago than the duration.

- It deletes the process-table row and the per-session hub rows that only describe that row: the remembered role and presence row, its usage totals and its hold or pending bookkeeping.
- It never deletes the journal, messages, topics, artifacts or tracker files.
- It answers with the pruned names and journals one `sessions-pruned` record listing them.
- Unarchived sessions are never pruned.
- `--dry-run` lists what would go.
- Permissions: the human's shell and the Coordinator. Other roles are refused through the permission table.

**Demo** (the epic's words). With the windows shortened by the test configuration, a stopped Implementer archives an hour after its item merged while an Aide never does. `cland session prune --older-than 7d` removes old records while `cland hub journal` still lists their launches.

**Out of scope.** Changing which sessions sit in the background layer, any retention of journal records, and the accounts block.

**Constraints.**

- Tests go through the frame protocol first, with a real hub and the CLI on a temporary project. The fake harnesses come second. The Neovim UI is tested headless on the stub hub.
- No new seams inside the hub. The windows come from configuration, not from a test hook.
- Helpers stay out of `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` waits on the `hub.status` `flushLogs` barrier.
- Every hub-event-driven sweep is coalesced once per tick (T-293).
- Every key goes through the action registry.
- Suites run through `cland verify`, and only when the queue shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. With shortened windows, a stopped Implementer, and a stopped Reviewer by its latest held item, archive one window after the item merged or closed. A crew session without such an item archives after the stop window. A stopped Aide is never archived by rule. Hub tests on a real hub with fake sessions cover each case.
- [ ] C2. A regression test bounds the work. On a store with hundreds of stopped rows and thousands of items and messages, hub start runs one batched sweep. A burst of item and stop events produces one sweep per tick, never one per event.
- [ ] C3. The background fold lists at most the latest 20 stopped sessions and shows the archived count in its header. A Neovim headless test on the stub hub covers it.
- [ ] C4. `cland session prune --older-than <d>` deletes only archived records older than `<d>`, and `--dry-run` deletes nothing. After it, `cland hub journal` still lists the pruned sessions' launches. A hub test checks this after the `flushLogs` barrier.
- [ ] C5. `hub/README.md` describes the rules, the `[sessions]` windows, the sweep and `session prune`. `nvim/README.md` describes the fold of 20 and the archived count. The Coordinator's default clause names `cland session prune`.

## Comments

### impl-306 · 2026-10-13T02:01:47.806Z

Implementing archive rules and prune on T-305. Epic decisions applied: prune age is stopped_at; legacy rows receive stopped_at on first sweep with no journal backfill. session.prune will join Coordinator tools and default clause; Coordinator must relaunch after merge.

### impl-306 · 2026-10-13T02:30:27.069Z

Implementation committed and pushed at 142f058b509f7738ee5bd97728eb23d3ed6e6ac3 (branch t/T-306-archive-by-rule-and-prune-stopped-crew), with origin/dev e2a80ba fetched and merged before final suite. C1-C5 covered by real-hub/CLI/spoke cleanup tests, bounded startup/event workload test, and headless Neovim fold/count test. Targeted suites and typecheck pass; requesting review then ordinary cland verify all. Coordinator tools/default clause now include session.prune / cland session prune: relaunch Coordinator after merge.
