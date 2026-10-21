---
id: T-1038
kind: task
title: "One Neovim startup response is still megabytes on the live tracker: find it and bound it"
state: open
status: in progress
size: M
criterion_seq: 4
labels:
  - ready-for-agent
  - bug
  - p1
assignee: null
parent: E-1006
blocked_by: []
topic: topic-785
branch: t/T-1038-one-neovim-startup-response-is-still
created: 2026-10-21T06:33:16.684Z
updated: 2026-10-21T06:41:26.226Z
---

## Summary

On the live tracker (1,036 items, hub at dev 04748953), Neovim's startup requests are answered within 0.2 s of each other, but at least one reply is several megabytes. The quadratic read loop then turns it into the 8 GB stall. T-1007 bounded the item list; the candidates still unbounded are `events.list` limit 200, `topic.history` General limit 200, `artifact.list`, `rule.list` and `hub.status` (1,977 ms, the only slow reply).

## What to build

1. **Measure.** On a disposable copy of the live project's `.cland` (rule 15), record the byte size and compose time of each of the eight startup replies Neovim sends: `hub.status`, `rule.list`, `topic.history` general limit 200, `artifact.list`, `task.list` state open, `events.list` limit 200, `session.list` and `account.list`. Post the table in the item topic.
2. **Bound.** Each reply larger than 256 kB gets bounded at its source: a smaller first page, omitted heavy fields (such as message bodies over a cap, suite history or artifact contents) or paging. Neovim's existing views keep working; a view that needs more reads the next page or the detail on demand.
3. **Guard.** Extend E-1006 C3's smoke budget so that a startup reply over its byte budget fails the test.

## Acceptance criteria

- [x] C1. The per-reply size and compose-time table for the eight startup requests on the live-tracker copy is posted in the item topic (local evidence).
  - done: impl-1038 · 2026-10-21T06:41:26.226Z
- [ ] C2. On the same copy, every startup reply is at most 256 kB, and the total of all eight is at most 1 MB (test with a fixture of comparable size plus local evidence).
- [ ] C3. The Neovim smoke test fails when any startup reply exceeds its byte budget (test).
- [ ] C4. The Neovim views fed by the bounded replies (General thread, events, artifacts, rules, status) still show their content: their existing T2 tests pass, plus one test per paged view for reading the next page.

## Comments

### coord · 2026-10-21T06:38:05.016Z

Live data from the human's workbench run, 2026-10-21 06:26–06:37Z. cland-impl collected it read-only from the hub's audit events of the Neovim client.

- The eight startup reads were each issued 3 times within about 5 minutes: hub.status, rule.list, topic.history (general, limit 200), artifact.list, task.list (state open), events.list (limit 200), session.list and account.list. These are reconnects after the out-of-memory stall, or periodic re-reads; either way they matter for E-1006 C2.
- task.plan was called 13 times and task.view twice.
- Hub CPU was 5–12 %, except 89 % at 06:33Z and 29 % at 06:36Z. Hub RSS went from 55 MB to 1.16 GB, then to 0.7 GB. Composing a reply drives hub memory too, not only Neovim's.

Implication for T-1038: bound each reply at its source, and note in the item topic whether a reconnect re-runs all eight reads. If it does, and the bounded replies still add up to more than 1 MB per reconnect, say so: that becomes a follow-up under E-1006 C2.
