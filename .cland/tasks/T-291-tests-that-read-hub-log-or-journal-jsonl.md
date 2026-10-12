---
id: T-291
kind: task
title: "Tests that read hub.log or journal.jsonl right after an event race the hub's asynchronous writes: audit them and wait on the flushLogs barrier"
state: open
status: backlog
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T13:45:45.431Z
updated: 2026-10-12T13:45:45.431Z
---

## Summary

Under a full run's load, tests that read `.cland/log/hub.log` or `journal.jsonl` as soon as an event or reply arrives can see the file before the hub's queued write lands. Three such cases failed in one hour on 2026-10-12, each passing alone; this item audits the rest and makes them wait on the existing `hub.status` `flushLogs` barrier (or an `eventually` on the expected record), keeping every assertion exact.

## Parent

T-216 Tech debt. Found during the v0.1.2 build (T-277's census, T-283's verify): codex-adapter.test.ts:396 (harness-exited log line, fixed on T-277 as 7cb55c6), codex-adapter.test.ts's recovery journal read (fixed on T-283 as aed0622 with the flushLogs barrier), and handover.test.ts's audit line (part of T-281). `Journal.write` queues without a durability acknowledgement by design.

## What to build

Find every hub test that reads hub.log or journal.jsonl directly after an action (grep for the two file names and for `readFile`/`readJournal` near them), classify each as already synchronized or racing, and add the barrier where it races: the `hub.status` `flushLogs` barrier where the hub is live, an `eventually` on the expected record otherwise. Exact counts stay exact (assert after the barrier, recheck "exactly once" where the test means once). No production change; no skip, retry or loosened assertion. List the audited files with their classification in the item.

Out of scope: the three cases already fixed (7cb55c6, aed0622, T-281's handover fix); changing `Journal.write`'s durability.

## Acceptance criteria

- [ ] Every hub test reading hub.log or journal.jsonl after an action is listed in the item as synchronized or fixed.
- [ ] Each fixed test waits on the flushLogs barrier or an `eventually` on the expected record, with its assertions unchanged in strength.
- [ ] Each fixed file passes 20 runs under four concurrent workers; `npm run typecheck` passes and `cland verify` is green.
