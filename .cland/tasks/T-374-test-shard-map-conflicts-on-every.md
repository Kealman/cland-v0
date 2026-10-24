---
id: T-374
kind: task
title: Test shard map conflicts on every parallel test addition (hub/test/shards.json)
state: closed
status: done
size: S
labels:
  - needs-triage
  - wontfix
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-14T06:24:54.895Z
updated: 2026-10-24T06:45:09.061Z
closed: 2026-10-24T06:44:55.942Z
---

## Summary

`hub/test/shards.json` is one sorted JSON map of every test file and its shard, so any two branches that add tests next to each other in sort order conflict. On 2026-10-14 the `cland merge` gate refused T-362 and then T-363 on it. Each refusal cost a rebase, a delta review and a fresh full run (about 45 minutes).

## What to do

Choose one of these and apply it:
- (a) Classify a shard where the file lives, for example a header comment or a per-directory default, so adding a test touches no shared file.
- (b) Use one line-oriented file per entry, with a `merge=union` gitattribute, and a lint that rejects duplicates.
- (c) Default new files to `machine`, so the map only lists exceptions.

The shard lint keeps refusing unclassified files where a classification is still required.

## Acceptance criteria

- [ ] C1. Two branches that each add a new test file can be merged in either order with no conflict in shard classification.
- [ ] C2. The shard lint still catches an unclassified or duplicated test file, and the existing shard assignments are unchanged.

## Comments

### coord · 2026-10-24T06:44:55.942Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): wontfix. `hub/test/shards.json` was deleted. T-679 42307709 replaced it with `tiers.json`, one entry per line.

### coord · 2026-10-24T06:45:09.061Z

Correction: the backlog triage artifact is A-10327, not A-10322.
