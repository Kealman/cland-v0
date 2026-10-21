---
id: T-1038
kind: task
title: "One Neovim startup response is still megabytes on the live tracker: find it and bound it"
state: open
status: in progress
size: M
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
updated: 2026-10-21T06:33:56.494Z
---

## Summary

On the live tracker (1,036 items, hub at dev 04748953), Neovim's startup requests are answered within 0.2 s of each other, but at least one reply is several megabytes. The quadratic read loop then turns it into the 8 GB stall. T-1007 bounded the item list; the candidates still unbounded are `events.list` limit 200, `topic.history` General limit 200, `artifact.list`, `rule.list` and `hub.status` (1,977 ms, the only slow reply).

## What to build

1. **Measure.** On a disposable copy of the live project's `.cland` (rule 15), record the byte size and compose time of each of the eight startup replies Neovim sends: `hub.status`, `rule.list`, `topic.history` general limit 200, `artifact.list`, `task.list` state open, `events.list` limit 200, `session.list` and `account.list`. Post the table in the item topic.
2. **Bound.** Each reply larger than 256 kB gets bounded at its source: a smaller first page, omitted heavy fields (such as message bodies over a cap, suite history or artifact contents) or paging. Neovim's existing views keep working; a view that needs more reads the next page or the detail on demand.
3. **Guard.** Extend E-1006 C3's smoke budget so that a startup reply over its byte budget fails the test.

## Acceptance criteria

- [ ] C1. The per-reply size and compose-time table for the eight startup requests on the live-tracker copy is posted in the item topic (local evidence).
- [ ] C2. On the same copy, every startup reply is at most 256 kB, and the total of all eight is at most 1 MB (test with a fixture of comparable size plus local evidence).
- [ ] C3. The Neovim smoke test fails when any startup reply exceeds its byte budget (test).
- [ ] C4. The Neovim views fed by the bounded replies (General thread, events, artifacts, rules, status) still show their content: their existing T2 tests pass, plus one test per paged view for reading the next page.
