---
id: T-1106
kind: task
title: subscription-frame test reads a torn journal line right after flushLogs
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T11:55:11.188Z
updated: 2026-10-22T11:55:11.188Z
---

## Summary

Periodic dev T3 run c9d66ec4 (A-9142, dev 733afdba, Linux droplet) failed `hub/test/subscription-frame.test.ts` "Claude Code consumes one ordered subscription digest through the native frame" with `SyntaxError: Expected ':' after property name in JSON at position 159` at line 61. The test reads `.cland/journal.jsonl` right after `hub.status { flushLogs: true }` and parses every line, but the journal's last line was still incomplete, so it read a torn write. The test passed in 14 other runs today.

## Acceptance criteria

- [ ] C1. The test waits, with a bound, for the journal entries it asserts (the `event-delivery` and `injected` records for the message id), parsing only complete lines, or `flushLogs` guarantees the journal's last line is complete before replying, with a regression for whichever side is fixed; every existing assertion stays (rule 9) (test).
- [ ] C2. The test passes 20/20 under a parallel CPU load on Linux through `cland verify` or locally under rule 15, and the samples are listed in the item topic (test).
